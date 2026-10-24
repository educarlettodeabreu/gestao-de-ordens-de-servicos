import assert from "node:assert/strict";
import { after, afterEach, mock, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

// Fixtures somente nos testes; nenhuma requisição deste arquivo chega ao Render.
const usuario = {
  id: 7,
  nome: "Pessoa de teste",
  email: "pessoa@example.com",
  classe: "cliente",
};

const vite = await createServer({
  configFile: false,
  plugins: [react()],
  server: { middlewareMode: true, watch: null, hmr: false, ws: false },
  appType: "custom",
});
const { rotas } = await vite.ssrLoadModule("/src/routes/rotas.tsx");
const { consultarSessao, fzLogin } = await vite.ssrLoadModule(
  "/src/services/Autenticacao.ts",
);
const { encerrarSessao } = await vite.ssrLoadModule(
  "/src/routes/autenticacao.ts",
);

after(() => vite.close());
afterEach(() => mock.restoreAll());

function json(dados, status = 200) {
  return Response.json(dados, { status });
}

function interceptar(implementacao) {
  return mock.method(globalThis, "fetch", implementacao);
}

function esperar(router, condicao = (estado) =>
  estado.initialized && estado.navigation.state === "idle") {
  if (condicao(router.state)) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cancelar();
      reject(new Error("A navegação não terminou no prazo esperado."));
    }, 3000);
    const cancelar = router.subscribe((estado) => {
      if (condicao(estado)) {
        clearTimeout(timer);
        cancelar();
        resolve();
      }
    });
  });
}

function criarRouter(t, caminho) {
  const router = createMemoryRouter(rotas, { initialEntries: [caminho] });
  t.after(() => router.dispose());
  return router;
}

function html(router) {
  return renderToStaticMarkup(createElement(RouterProvider, { router }));
}

test("login mantém JSON de credenciais e cookies pela mesma origem", async () => {
  const resposta = json({ mensagem: "sessao criada" });
  const fetch = interceptar(async () => resposta);
  assert.equal(await fzLogin("pessoa@example.com", "senha-de-teste"), resposta);
  const [url, opcoes] = fetch.mock.calls[0].arguments;
  assert.equal(url, "/api/login");
  assert.equal(opcoes.method, "POST");
  assert.equal(opcoes.credentials, "same-origin");
  assert.equal(opcoes.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(opcoes.body), {
    email: "pessoa@example.com", senha: "senha-de-teste",
  });
});

test("/me não envia ID e descarta campos extras da resposta", async () => {
  const signal = new AbortController().signal;
  const fetch = interceptar(async () => json({ ...usuario, senha: "nao-reter" }));
  assert.deepEqual(await consultarSessao(signal), usuario);
  const [url, opcoes] = fetch.mock.calls[0].arguments;
  assert.equal(url, "/api/me");
  assert.equal(opcoes.body, undefined);
  assert.equal(opcoes.credentials, "same-origin");
  assert.equal(opcoes.cache, "no-store");
  assert.equal(opcoes.signal, signal);
});

for (const classe of ["cliente", "funcionario", "admin"]) {
  for (const caminho of ["/dashboard", "/dashboard/cliente", "/dashboard/funcionario", "/dashboard/admin"]) {
    test(`${classe} em ${caminho} acessa somente seu próprio painel`, async (t) => {
      interceptar(async () => json({ ...usuario, classe }));
      const router = criarRouter(t, caminho);
      await esperar(router);
      assert.equal(router.state.location.pathname, `/dashboard/${classe}`);
      assert.equal(router.state.loaderData.sessao.classe, classe);
      assert.match(html(router), /Pessoa de teste/);
      assert.equal(router.state.errors, null);
    });
  }
}

for (const caminho of ["/", "/login", "/cadastro"]) {
  test(`${caminho} continua público sem consultar sessão`, async (t) => {
    const fetch = interceptar(async () => { throw new Error("Chamada inesperada"); });
    const router = criarRouter(t, caminho);
    await esperar(router);
    assert.equal(router.state.location.pathname, caminho);
    assert.equal(fetch.mock.callCount(), 0);
    assert.match(html(router), caminho === "/cadastro" ? /Crie sua conta/ : /Acesse sua conta/);
  });
}

test("401 em URL protegida redireciona ao login sem dados privados", async (t) => {
  interceptar(async () => json({ erro: "sem sessao" }, 401));
  const router = criarRouter(t, "/dashboard/admin");
  await esperar(router);
  assert.equal(router.state.location.pathname, "/login");
  assert.equal(router.state.loaderData.sessao, undefined);
  assert.doesNotMatch(html(router), /Pessoa de teste|Painel do/);
});

for (const [status, texto] of [
  [403, /não tem permissão/],
  [404, /verificação de sessão está indisponível/],
  [429, /Muitas tentativas/],
  [500, /servidor não conseguiu verificar/],
]) {
  test(`${status} na sessão mantém URL e mostra erro sem painel`, async (t) => {
    interceptar(async () => json({ erro: "falha" }, status));
    const router = criarRouter(t, "/dashboard/cliente");
    await esperar(router);
    assert.equal(router.state.location.pathname, "/dashboard/cliente");
    assert.ok(router.state.errors);
    assert.match(html(router), texto);
    assert.doesNotMatch(html(router), /Pessoa de teste|Painel do/);
  });
}

test("falha de rede não é confundida com sessão encerrada", async (t) => {
  interceptar(async () => { throw new TypeError("Failed to fetch"); });
  const router = criarRouter(t, "/dashboard/cliente");
  await esperar(router);
  assert.equal(router.state.location.pathname, "/dashboard/cliente");
  assert.match(html(router), /Não foi possível conectar ao servidor/);
  assert.doesNotMatch(html(router), /Pessoa de teste/);
});

for (const dados of [
  null,
  { ...usuario, id: "7" },
  { ...usuario, classe: "superadmin" },
  { ...usuario, nome: undefined },
]) {
  test(`sessão malformada é bloqueada: ${JSON.stringify(dados)}`, async (t) => {
    interceptar(async () => json(dados));
    const router = criarRouter(t, "/dashboard/cliente");
    await esperar(router);
    assert.ok(router.state.errors);
    assert.doesNotMatch(html(router), /Pessoa de teste|Painel do/);
  });
}

test("JSON inválido não libera acesso", async (t) => {
  interceptar(async () => new Response("<html>Erro</html>"));
  const router = criarRouter(t, "/dashboard/cliente");
  await esperar(router);
  assert.ok(router.state.errors);
  assert.doesNotMatch(html(router), /Pessoa de teste|Painel do/);
});

test("sessão pendente mostra apenas carregamento", async (t) => {
  const pendente = Promise.withResolvers();
  interceptar(() => pendente.promise);
  const router = criarRouter(t, "/dashboard/cliente");
  assert.match(html(router), /Verificando sua sessão/);
  assert.doesNotMatch(html(router), /Pessoa de teste|Painel do/);
  pendente.resolve(json(usuario));
  await esperar(router);
  assert.match(html(router), /Pessoa de teste/);
});

test("navegar entre painéis verifica sessão e oculta o painel anterior", async (t) => {
  interceptar(async () => json(usuario));
  const router = criarRouter(t, "/dashboard/cliente");
  await esperar(router);
  const pendente = Promise.withResolvers();
  interceptar(() => pendente.promise);
  const navegacao = router.navigate("/dashboard/admin");
  assert.match(html(router), /Verificando sua sessão/);
  assert.doesNotMatch(html(router), /Pessoa de teste|Painel do/);
  // Uma mudança de classe no servidor também deve ser respeitada.
  pendente.resolve(json({ ...usuario, classe: "funcionario" }));
  await navegacao;
  await esperar(router);
  assert.equal(router.state.location.pathname, "/dashboard/funcionario");
});

test("tentar novamente recupera a sessão após erro temporário", async (t) => {
  let falhar = true;
  interceptar(async () => falhar ? json({}, 500) : json(usuario));
  const router = criarRouter(t, "/dashboard/cliente");
  await esperar(router);
  assert.ok(router.state.errors);
  falhar = false;
  await router.revalidate();
  await esperar(router);
  assert.equal(router.state.errors, null);
  assert.match(html(router), /Pessoa de teste/);
});

test("verificação abandonada não restaura usuário depois de ir ao login", async (t) => {
  const pendente = Promise.withResolvers();
  let signal;
  interceptar((_url, opcoes) => {
    signal = opcoes.signal;
    return pendente.promise;
  });
  const router = criarRouter(t, "/dashboard/cliente");
  await router.navigate("/login");
  assert.equal(signal.aborted, true);
  pendente.resolve(json(usuario));
  await esperar(router);
  assert.equal(router.state.location.pathname, "/login");
  assert.equal(router.state.loaderData.sessao, undefined);
});

for (const status of [401, 500]) {
  test(`sessão previamente verificada deixa de exibir dados após ${status}`, async (t) => {
    let falhar = false;
    interceptar(async () => falhar ? json({}, status) : json(usuario));
    const router = criarRouter(t, "/dashboard/cliente");
    await esperar(router);
    assert.match(html(router), /Pessoa de teste/);
    falhar = true;
    await router.revalidate();
    await esperar(router);
    assert.doesNotMatch(html(router), /Pessoa de teste|Painel do/);
    assert.equal(router.state.loaderData.sessao, undefined);
    assert.equal(router.state.location.pathname, status === 401 ? "/login" : "/dashboard/cliente");
  });
}

test("logout confirmado limpa os dados e voltar exige nova sessão", async (t) => {
  let ativa = true;
  const fetch = interceptar(async (url) => {
    if (url === "/api/logout") {
      ativa = false;
      return json({ mensagem: "sessao encerrada" });
    }
    return ativa ? json(usuario) : json({}, 401);
  });
  const router = criarRouter(t, "/dashboard/cliente");
  await esperar(router);
  await router.fetch("saida", "sessao", "/dashboard", {
    formMethod: "post", formData: new FormData(),
  });
  await esperar(router);
  assert.equal(router.state.location.pathname, "/login");
  assert.equal(router.state.loaderData.sessao, undefined);
  assert.doesNotMatch(html(router), /Pessoa de teste/);
  const [, opcoes] = fetch.mock.calls.find((chamada) => chamada.arguments[0] === "/api/logout").arguments;
  assert.equal(opcoes.method, "POST");
  assert.equal(opcoes.credentials, "same-origin");
  await router.navigate(-1);
  await esperar(router);
  assert.equal(router.state.location.pathname, "/login");
  assert.equal(router.state.loaderData.sessao, undefined);
});

for (const status of [401, 403, 404, 429, 500]) {
  test(`logout ${status} não declara sucesso`, async () => {
    interceptar(async () => json({}, status));
    const resultado = await encerrarSessao({ request: new Request("http://localhost/dashboard") });
    assert.equal(typeof resultado.erro, "string");
    assert.ok(resultado.erro.length > 0);
  });
}

test("falha no logout preserva usuário e permite nova tentativa", async (t) => {
  let falhar = true;
  interceptar(async (url) => url === "/api/logout" ? json({}, falhar ? 500 : 200) : json(usuario));
  const router = criarRouter(t, "/dashboard/cliente");
  await esperar(router);
  let erroSaida;
  const cancelar = router.subscribe((estado) => {
    const dados = estado.fetchers.get("saida")?.data;
    if (dados?.erro) erroSaida = dados.erro;
  });
  t.after(cancelar);
  await router.fetch("saida", "sessao", "/dashboard", {
    formMethod: "post", formData: new FormData(),
  });
  await esperar(router);
  assert.equal(router.state.location.pathname, "/dashboard/cliente");
  assert.deepEqual(router.state.loaderData.sessao, usuario);
  assert.match(erroSaida, /Não foi possível encerrar/);
  falhar = false;
  await router.fetch("saida", "sessao", "/dashboard", {
    formMethod: "post", formData: new FormData(),
  });
  await esperar(router);
  assert.equal(router.state.location.pathname, "/login");
  assert.equal(router.state.loaderData.sessao, undefined);
});

test("falha de rede no logout não confirma encerramento", async () => {
  interceptar(async () => { throw new TypeError("Failed to fetch"); });
  const resultado = await encerrarSessao({ request: new Request("http://localhost/dashboard") });
  assert.match(resultado.erro, /encerramento da sessão não foi confirmado/);
});
