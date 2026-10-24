const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createServer } = require("node:http");
const { once } = require("node:events");
const { spawn } = require("node:child_process");
const path = require("node:path");
const { criarAplicacao } = require("./helpers/aplicacao.cjs");

async function cenario(t) {
  const { app, estado } = criarAplicacao();
  const servidor = createServer(app);
  servidor.listen(0, "127.0.0.1");
  await once(servidor, "listening");
  t.after(async () => {
    servidor.closeAllConnections();
    await new Promise((resolve) => servidor.close(resolve));
  });
  const origem = `http://127.0.0.1:${servidor.address().port}`;
  function solicitar(caminho, { metodo = "GET", cookie, dados, accept = "application/json" } = {}) {
    return fetch(`${origem}${caminho}`, {
      method: metodo, redirect: "manual",
      headers: { Accept: accept, "X-Forwarded-Proto": "https", ...(cookie ? { Cookie: cookie } : {}), ...(dados === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(dados === undefined ? {} : { body: JSON.stringify(dados) }),
    });
  }
  async function login(id) {
    const res = await solicitar("/api/login", { metodo: "POST", dados: { email: `teste${id}@example.com`, senha: "senha-de-teste" } });
    assert.equal(res.status, 200);
    const cookie = res.headers.get("set-cookie");
    assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Lax/);
    return cookie.split(";")[0];
  }
  return { solicitar, login, estado, origem };
}

test("Express entrega o React e os arquivos compilados com Helmet ativo", async (t) => {
  const { solicitar, estado } = await cenario(t);
  let html;
  for (const rota of ["/", "/login", "/cadastro", "/dashboard", "/dashboard/cliente", "/dashboard/funcionario", "/dashboard/admin"]) {
    const res = await solicitar(rota, { accept: "text/html" });
    assert.equal(res.status, 200, rota);
    assert.match(res.headers.get("content-type"), /text\/html/);
    assert.match(res.headers.get("content-security-policy"), /script-src 'self'/);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    html = await res.text();
    assert.match(html, /id="root"/);
    assert.doesNotMatch(html, /src\/main\.tsx/);
  }
  const js = html.match(/<script[^>]+src="([^"]+)"/)[1];
  const css = html.match(/<link[^>]+href="([^"]+\.css)"/)[1];
  const resJs = await solicitar(js);
  assert.equal(resJs.status, 200); assert.match(resJs.headers.get("content-type"), /javascript/);
  assert.ok((await resJs.text()).length > 1000);
  const resCss = await solicitar(css);
  assert.equal(resCss.status, 200); assert.match(resCss.headers.get("content-type"), /text\/css/);
  assert.match(await resCss.text(), /erp-shell/);
  assert.equal(estado.consultas.length, 0, "Servir o React não acessa o banco.");
});

test("API desconhecida retorna JSON em todos os métodos e nunca cai na SPA", async (t) => {
  const { solicitar } = await cenario(t);
  for (const metodo of ["GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"]) {
    for (const rota of ["/api", "/api/rota-inexistente", "/api/assets/ausente.js", "/api-inexistente", "/API/rota-inexistente"]) {
      const res = await solicitar(rota, { metodo, accept: "text/html" });
      assert.equal(res.status, 404, `${metodo} ${rota}`);
      assert.match(res.headers.get("content-type"), /application\/json/);
      assert.deepEqual(await res.json(), { erro: "Rota da API não encontrada." });
    }
  }
  for (const metodo of ["POST", "PATCH", "DELETE"]) {
    for (const rota of ["/login", "/cadastro", "/dashboard/admin"]) {
      const res = await solicitar(rota, { metodo, accept: "text/html" });
      assert.equal(res.status, 404); assert.match(res.headers.get("content-type"), /application\/json/);
    }
  }
});

test("arquivos internos, fontes e assets ausentes não são expostos nem viram HTML", async (t) => {
  const { solicitar } = await cenario(t);
  for (const rota of ["/.env", "/%2eenv", "/.git/config", "/app.js", "/database.js", "/package.json", "/package-lock.json", "/schema.sql", "/ca.pem", "/node_modules/express/index.js", "/frontend/src/main.tsx", "/tests/helpers/aplicacao.cjs", "/assets/ausente.js", "/assets/ausente.js.map"]) {
    const res = await solicitar(rota, { accept: "text/html" });
    assert.equal(res.status, 404, rota);
    assert.match(res.headers.get("content-type"), /application\/json/);
    assert.deepEqual(await res.json(), { erro: "Recurso não encontrado." });
  }
});

test("todas as rotas privadas de /api continuam exigindo sessão", async (t) => {
  const { solicitar } = await cenario(t);
  for (const [metodo, rota] of [
    ["GET", "/me"], ["POST", "/logout"], ["GET", "/admin/funcionarios"], ["POST", "/cadastro"], ["DELETE", "/delet"],
    ["GET", "/servicos"], ["POST", "/servicos"], ["DELETE", "/servicos/delet"], ["POST", "/solicitacoes"],
    ["GET", "/consulsolicitacoes"], ["GET", "/minhassolicitacoes"], ["POST", "/ordem"], ["PATCH", "/ordem/status"],
    ["DELETE", "/ordem/1"], ["GET", "/consultOrdens"], ["GET", "/minhasordens"], ["GET", "/funcionario/ordens"],
  ]) {
    const res = await solicitar(`/api${rota}`, { metodo });
    assert.equal(res.status, 401, `${metodo} ${rota}`);
    assert.match(res.headers.get("content-type"), /application\/json/);
  }
});

test("login, /me, permissões e logout preservam sessões e cookies", async (t) => {
  const { solicitar, login, estado } = await cenario(t);
  const admin = await login(1);
  const cliente = await login(2);
  const funcionario = await login(3);
  const me = await solicitar("/api/me?id=999", { cookie: cliente });
  assert.deepEqual(await me.json(), { id: 2, nome: "Teste cliente 2", email: "teste2@example.com", classe: "cliente" });
  assert.equal(me.headers.get("cache-control"), "no-store");
  assert.equal((await solicitar("/api/admin/funcionarios", { cookie: cliente })).status, 403);
  assert.equal((await solicitar("/api/admin/funcionarios", { cookie: funcionario })).status, 403);
  const funcionarios = await solicitar("/api/admin/funcionarios", { cookie: admin });
  assert.deepEqual(await funcionarios.json(), [{ id: 3, nome: "Teste funcionario 3", email: "teste3@example.com" }]);
  const minhasOrdens = await solicitar("/api/minhasordens?cliente_id=4", { cookie: cliente });
  assert.deepEqual((await minhasOrdens.json()).map((o) => o.cliente_id), [2]);
  const minhasSolicitacoes = await solicitar("/api/minhassolicitacoes?usuario_id=4", { cookie: cliente });
  assert.deepEqual((await minhasSolicitacoes.json()).map((s) => s.usuario_id), [2]);
  const atribuidas = await solicitar("/api/funcionario/ordens", { cookie: funcionario });
  assert.deepEqual((await atribuidas.json()).map((o) => o.id), [1]);
  estado.falhaBanco = true;
  const falha = await solicitar("/api/me", { cookie: admin });
  assert.equal(falha.status, 500); assert.doesNotMatch(await falha.text(), /detalhes privados/);
  estado.falhaBanco = false;
  assert.equal((await solicitar("/api/logout", { metodo: "POST", cookie: admin })).status, 200);
  assert.equal((await solicitar("/api/me", { cookie: admin })).status, 401);
});

test("cadastro público continua validado e não cria sessão; cadastro administrativo exige admin", async (t) => {
  const { solicitar, login, estado } = await cenario(t);
  const invalido = await solicitar("/api/criarConta", { metodo: "POST", dados: { nome: "ab", email: "x@example.com", senha: "curta" } });
  assert.equal(invalido.status, 400);
  const publico = await solicitar("/api/criarConta", { metodo: "POST", dados: { nome: "Novo cliente", email: "novo@example.com", senha: "senha-de-teste", classe: "admin" } });
  assert.equal(publico.status, 200); assert.equal(publico.headers.get("set-cookie"), null);
  assert.equal(estado.usuarios.at(-1).classe, "cliente");
  const admin = await login(1);
  const cadastrado = await solicitar("/api/cadastro", { metodo: "POST", cookie: admin, dados: { nome: "Nova equipe", email: "equipe@example.com", senha: "senha-de-teste", classe: "funcionario" } });
  assert.equal(cadastrado.status, 200);
  assert.equal(estado.usuarios.at(-1).classe, "funcionario");
  assert.equal((await solicitar("/api/delet", { metodo: "DELETE", cookie: admin, dados: { email: "equipe@example.com" } })).status, 200);
  assert.ok(!estado.usuarios.some((u) => u.email === "equipe@example.com"));
});

test("serviços, solicitações e ordens mantêm seus contratos e consultas após o prefixo", async (t) => {
  const { solicitar, login, estado } = await cenario(t);
  const admin = await login(1);
  const cliente = await login(2);
  const funcionario = await login(3);
  assert.equal((await solicitar("/api/servicos", { metodo: "POST", cookie: cliente, dados: { nome: "Recusado" } })).status, 403);
  assert.equal((await solicitar("/api/servicos", { metodo: "POST", cookie: admin, dados: { nome: "Novo serviço" } })).status, 201);
  const servicos = await solicitar("/api/servicos", { cookie: cliente });
  assert.equal((await servicos.json()).length, 2);
  assert.equal((await solicitar("/api/servicos/delet", { metodo: "DELETE", cookie: admin, dados: { nome: "Novo serviço" } })).status, 200);
  assert.equal((await solicitar("/api/solicitacoes", { metodo: "POST", cookie: cliente, dados: { servicoid: 1, descricao: "Nova solicitação", usuario_id: 999 } })).status, 200);
  assert.equal(estado.solicitacoes.at(-1).usuario_id, 2);
  const solicitacoes = await solicitar("/api/consulsolicitacoes", { cookie: admin });
  assert.equal((await solicitacoes.json()).length, 3);
  assert.equal((await solicitar("/api/ordem", { metodo: "POST", cookie: admin, dados: { solicitacao_id: 1, funcionarios: [] } })).status, 201);
  const semEquipe = estado.ordens.at(-1).id;
  assert.equal((await solicitar("/api/ordem", { metodo: "POST", cookie: admin, dados: { solicitacao_id: 3, funcionarios: [3] } })).status, 201);
  const atribuida = estado.ordens.at(-1).id;
  assert.ok(estado.atribuicoes.some((a) => a.ordem_id === atribuida && a.funcionarios_id === 3));
  assert.equal((await solicitar("/api/ordem/status", { metodo: "PATCH", cookie: admin, dados: { ordem: semEquipe, status: "em análise" } })).status, 200);
  const filtradas = await solicitar("/api/consultOrdens?status=em%20an%C3%A1lise", { cookie: admin });
  assert.deepEqual((await filtradas.json()).map((o) => o.id), [semEquipe]);
  const atribuidas = await solicitar("/api/funcionario/ordens", { cookie: funcionario });
  assert.ok((await atribuidas.json()).some((o) => o.id === atribuida));
  assert.equal((await solicitar(`/api/ordem/${semEquipe}`, { metodo: "DELETE", cookie: admin })).status, 200);
  assert.equal((await solicitar("/api/ordem/999", { metodo: "DELETE", cookie: admin })).status, 404);
});

test("rate limiting continua ativo no login sob /api", async (t) => {
  const { solicitar } = await cenario(t);
  for (let i = 0; i < 6; i++) {
    assert.equal((await solicitar("/api/login", { metodo: "POST", dados: { email: "ausente@example.com", senha: "incorreta" } })).status, 401);
  }
  const res = await solicitar("/api/login", { metodo: "POST", dados: { email: "ausente@example.com", senha: "incorreta" } });
  assert.equal(res.status, 429); assert.match(res.headers.get("content-type"), /application\/json/);
});

test("npm start inicia somente o Express e serve a SPA sem MySQL real no teste", { timeout: 15000 }, async (t) => {
  const raiz = path.resolve(__dirname, "..");
  const child = spawn("npm", ["start"], {
    cwd: raiz, detached: true,
    env: { ...process.env, NODE_OPTIONS: `--require=${path.join(__dirname, "fixtures/iniciar.cjs")}`, PORT: "0", SESSION_SECRET: "segredo-apenas-do-processo-de-teste" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => { try { process.kill(-child.pid, "SIGTERM"); } catch { /* O processo já encerrou. */ } });
  const porta = await new Promise((resolve, reject) => {
    let saida = "";
    const timer = setTimeout(() => reject(new Error("Express não iniciou no prazo esperado.")), 10000);
    child.stdout.on("data", (chunk) => {
      saida += chunk;
      const match = saida.match(/servidor rodando na porta (\d+)/);
      if (match) { clearTimeout(timer); resolve(Number(match[1])); }
    });
    child.on("error", (erro) => { clearTimeout(timer); reject(erro); });
    child.on("exit", (codigo) => { clearTimeout(timer); reject(new Error(`npm start encerrou com ${codigo}.`)); });
  });
  const res = await fetch(`http://127.0.0.1:${porta}/login`);
  assert.equal(res.status, 200); assert.match(await res.text(), /id="root"/);
  assert.equal((await fetch(`http://127.0.0.1:${porta}/api/me`)).status, 401);
});
