// Verificação opcional com navegador real e API interceptada somente neste teste.
// Não instala dependências e nunca envia operações ao Render.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "vite";

const caminhoPlaywright = process.env.ERP_PLAYWRIGHT_PATH ?? process.argv[2];
const moduloPlaywright = await import(caminhoPlaywright
  ? pathToFileURL(caminhoPlaywright).href : "playwright-core");
const { chromium } = moduloPlaywright.default ?? moduloPlaywright;
const frontend = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ root: frontend, server: { host: "127.0.0.1", port: 0, hmr: false, ws: false } });
await vite.listen();
const endereco = vite.httpServer.address();
const origem = `http://127.0.0.1:${endereco.port}`;
const pasta = process.env.ERP_SCREENSHOT_DIR ?? "/tmp/erp-dashboards";
await mkdir(pasta, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.ERP_BROWSER_EXECUTABLE ?? process.argv[3],
  headless: true,
  args: ["--no-sandbox"],
});
const erros = [];
let verificacoes = 0;
const verificar = (condicao, mensagem) => { assert.ok(condicao, mensagem); verificacoes++; };

const data = "2026-10-24T12:00:00.000Z";
const servico = { id: 1, nome: "Manutenção de teste", criado_em: data };
const ordem = { id: 10, cliente_id: 7, servico_id: 1, descricao: "Atendimento de teste", status: "aberta", criado_em: data, atualizado_em: data };

async function cenario(classe, configuracao = {}) {
  const estado = {
    autenticado: true, meStatus: 200, logoutStatus: 200, funcionariosStatus: 200,
    listaStatus: 200, escritaStatus: 200, chamadas: [],
    servicos: [{ ...servico }],
    solicitacoes: [1, 2].map((id) => ({ id, usuario_id: 7, servico_id: 1, descricao: `Problema de teste ${id}`, criado_em: data })),
    ordens: [{ ...ordem }, { ...ordem, id: 11, status: "em análise" }],
    ...configuracao,
  };
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  await context.route("**/api/**", async (route) => {
    const req = route.request();
    const caminho = new URL(req.url()).pathname;
    const metodo = req.method();
    const dados = req.postData() ? req.postDataJSON() : undefined;
    estado.chamadas.push({ caminho, metodo, dados });
    const responder = (body, status = 200) => route.fulfill({ status, json: body });
    if (caminho === "/api/login") { estado.autenticado = true; return responder({ mensagem: "sessao criada" }); }
    if (caminho === "/api/me") {
      if (estado.mePendente) await estado.mePendente;
      return responder(estado.autenticado ? { id: 7, nome: "Pessoa de teste", email: "teste@example.com", classe } : {}, estado.autenticado ? estado.meStatus : 401);
    }
    if (!estado.autenticado) return responder({}, 401);
    if (caminho === "/api/logout") {
      if (estado.logoutStatus === 200) estado.autenticado = false;
      return responder({}, estado.logoutStatus);
    }
    if (metodo === "GET") {
      if (caminho === "/api/admin/funcionarios") return responder([{ id: 2, nome: "Equipe de teste", email: "equipe@example.com" }], estado.funcionariosStatus);
      if (estado.listaStatus !== 200) return responder({}, estado.listaStatus);
      if (caminho === "/api/servicos") return responder(estado.servicos);
      if (caminho === "/api/minhassolicitacoes") return responder(estado.solicitacoes);
      if (caminho === "/api/consulsolicitacoes") return responder(estado.solicitacoes.map((item) => ({ id: item.id, descricao: item.descricao, criado_em: item.criado_em, cliente_nome: "Cliente de teste", cliente_email: "cliente@example.com", servico_nome: servico.nome })));
      if (["/api/minhasordens", "/api/funcionario/ordens", "/api/consultOrdens"].includes(caminho)) return responder(estado.ordens);
    }
    if (estado.escritaStatus !== 200) return responder({}, estado.escritaStatus);
    if (caminho === "/api/solicitacoes") {
      estado.solicitacoes.push({ id: 3, usuario_id: 7, servico_id: dados.servicoid, descricao: dados.descricao, criado_em: data });
      return responder({}, 200);
    }
    if (caminho === "/api/servicos" && metodo === "POST") {
      estado.servicos.push({ id: 2, nome: dados.nome, criado_em: data });
      return responder({}, 201);
    }
    if (caminho === "/api/servicos/delet") {
      estado.servicos = estado.servicos.filter((item) => item.nome !== dados.nome);
      return responder({});
    }
    if (caminho === "/api/ordem" && metodo === "POST") {
      const solicitacao = estado.solicitacoes.find((item) => item.id === dados.solicitacao_id);
      estado.ordens.push({ ...ordem, id: 20 + dados.solicitacao_id, descricao: solicitacao.descricao });
      estado.solicitacoes = estado.solicitacoes.filter((item) => item.id !== dados.solicitacao_id);
      return responder({}, 201);
    }
    if (caminho === "/api/ordem/status") {
      estado.ordens.find((item) => item.id === dados.ordem).status = dados.status;
      return responder({});
    }
    if (/^\/api\/ordem\/\d+$/.test(caminho) && metodo === "DELETE") {
      estado.ordens = estado.ordens.filter((item) => item.id !== Number(caminho.split("/").at(-1)));
      return responder({});
    }
    throw new Error(`Requisição inesperada no teste: ${metodo} ${caminho}`);
  });
  const page = await context.newPage();
  page.on("pageerror", (erro) => erros.push(erro.message));
  return { context, page, estado };
}

async function visivel(page, seletor) {
  await seletor.waitFor({ state: "visible" });
  verificar(await seletor.isVisible(), `Elemento esperado em ${page.url()}`);
}
async function semOverflow(page) {
  verificar(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow na página ${page.url()}`);
}
async function capturar(page, nome) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${pasta}/${nome}.png`, fullPage: true });
}

try {
  // Login, solicitação, filtros, menu móvel e logout.
  {
    const { page, context, estado } = await cenario("cliente", { autenticado: false });
    await page.goto(`${origem}/login`);
    await page.getByLabel("E-mail", { exact: true }).fill("teste@example.com");
    await page.getByLabel("Senha", { exact: true }).fill("senha-de-teste");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL("**/dashboard/cliente");
    await visivel(page, page.getByRole("heading", { name: "Serviços disponíveis", exact: true }));
    await page.getByRole("combobox", { name: /^Serviço/ }).selectOption("1");
    await page.getByLabel("Descrição do problema").fill("Minha solicitação de teste");
    await page.getByRole("button", { name: "Enviar solicitação" }).click();
    await visivel(page, page.getByText("Solicitação enviada com sucesso!"));
    await visivel(page, page.locator("#solicitacoes").getByText("Minha solicitação de teste"));
    assert.deepEqual(estado.chamadas.find((item) => item.caminho === "/api/solicitacoes").dados, { servicoid: 1, descricao: "Minha solicitação de teste" }); verificacoes++;
    await page.getByLabel("Filtrar por status").selectOption("em análise");
    verificar(await page.locator("#ordens tbody tr").count() === 1, "Filtro do cliente");
    await page.getByText("Ver detalhes da ordem #11").click();
    await visivel(page, page.locator("#ordens dt").getByText("Atualizada em", { exact: true }));
    await capturar(page, "cliente-desktop");
    await page.setViewportSize({ width: 375, height: 812 });
    await semOverflow(page);
    await page.getByRole("button", { name: "Alternar menu" }).click();
    await visivel(page, page.getByRole("navigation", { name: "Menu do painel" }));
    await page.getByRole("link", { name: "Ordens de serviço", exact: true }).click();
    verificar(!(await page.locator("#menu-painel").isVisible()), "Menu fecha depois de escolher seção");
    await capturar(page, "cliente-mobile");
    estado.logoutStatus = 500;
    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await visivel(page, page.getByText("Não foi possível encerrar a sessão. Tente novamente."));
    verificar(page.url().includes("/dashboard/cliente"), "Falha de logout preserva a página");
    estado.logoutStatus = 200;
    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await page.waitForURL("**/login");
    await page.goto(`${origem}/dashboard/cliente`);
    await page.waitForURL("**/login");
    verificar(!(await page.getByText("Pessoa de teste", { exact: true }).count()), "Nenhum usuário privado após logout");
    await context.close();
  }

  // Funcionário pode consultar, filtrar e detalhar; não há edição.
  {
    const { page, context, estado } = await cenario("funcionario");
    await page.goto(`${origem}/dashboard/admin`);
    await page.waitForURL("**/dashboard/funcionario");
    await visivel(page, page.getByRole("heading", { name: "Suas ordens de serviço" }));
    await page.getByLabel("Filtrar por status").selectOption("aberta");
    verificar(await page.locator("#ordens tbody tr").count() === 1, "Filtro do funcionário");
    verificar(await page.getByRole("button", { name: /Alterar status|Excluir/ }).count() === 0, "Funcionário não tem botões de escrita");
    verificar(!estado.chamadas.some((item) => item.caminho === "/api/consulsolicitacoes"), "Rota de outra classe não carrega dados do admin");
    await capturar(page, "funcionario-desktop");
    await page.setViewportSize({ width: 768, height: 1024 });
    await semOverflow(page);
    await capturar(page, "funcionario-tablet");
    await context.close();
  }

  // Administração: escrita, confirmação, atribuição opcional e atualização real das listas.
  {
    const { page, context, estado } = await cenario("admin", { funcionariosStatus: 404 });
    await page.goto(`${origem}/dashboard/admin`);
    await visivel(page, page.getByRole("heading", { name: "Gerenciar serviços" }));
    await page.getByLabel("Nome do serviço").fill("Visita de teste");
    await page.getByRole("button", { name: "Cadastrar serviço" }).click();
    await visivel(page, page.locator("#servicos").getByText("Visita de teste", { exact: true }));
    await page.getByRole("button", { name: "Excluir serviço Visita de teste" }).click();
    await visivel(page, page.getByRole("dialog", { name: "Excluir serviço" }));
    verificar(!estado.chamadas.some((item) => item.metodo === "DELETE"), "Excluir exige confirmação");
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    verificar(estado.servicos.length === 2, "Cancelar não exclui");
    await page.getByRole("button", { name: "Excluir serviço Visita de teste" }).click();
    await page.getByRole("button", { name: "Confirmar exclusão" }).click();
    await page.getByText("Serviço excluído com sucesso!").waitFor();
    await page.getByRole("button", { name: "Excluir serviço Visita de teste" }).waitFor({ state: "detached" });
    verificar(estado.servicos.length === 1, "Lista de serviços atualizada");
    await page.getByRole("button", { name: "Criar ordem da solicitação 1", exact: true }).click();
    await visivel(page, page.getByText("A seleção está indisponível. A criação sem funcionários continua disponível."));
    await page.getByRole("button", { name: "Confirmar criação" }).click();
    await page.getByText("Ordem criada com sucesso!").waitFor();
    assert.deepEqual(estado.chamadas.find((item) => item.caminho === "/api/ordem").dados, { solicitacao_id: 1, funcionarios: [] }); verificacoes++;
    await page.getByRole("button", { name: "Criar ordem da solicitação 1", exact: true }).waitFor({ state: "detached" });
    estado.funcionariosStatus = 200;
    await page.getByRole("button", { name: "Atualizar dados", exact: true }).click();
    await page.getByRole("button", { name: "Criar ordem da solicitação 2", exact: true }).click();
    await page.getByRole("checkbox", { name: /Equipe de teste/ }).check();
    await page.getByRole("button", { name: "Confirmar criação" }).click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert.deepEqual(estado.chamadas.filter((item) => item.caminho === "/api/ordem").at(-1).dados, { solicitacao_id: 2, funcionarios: [2] }); verificacoes++;
    await page.getByRole("button", { name: "Alterar status da ordem 10", exact: true }).click();
    await page.getByLabel("Novo status da ordem #10").fill("em análise");
    await page.getByRole("button", { name: "Salvar status" }).click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    verificar(estado.ordens.find((item) => item.id === 10).status === "em análise", "Status atualizado");
    await page.getByRole("button", { name: "Excluir ordem 10", exact: true }).click();
    estado.escritaStatus = 500;
    await page.getByRole("button", { name: "Confirmar exclusão" }).click();
    await visivel(page, page.getByRole("dialog").getByRole("alert"));
    verificar(estado.ordens.some((item) => item.id === 10), "Falha na exclusão mantém a ordem");
    estado.escritaStatus = 200;
    await page.getByRole("button", { name: "Confirmar exclusão" }).click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    await page.getByRole("button", { name: "Excluir ordem 10", exact: true }).waitFor({ state: "detached" });
    verificar(!estado.ordens.some((item) => item.id === 10), "Exclusão confirmada atualiza a lista");
    await capturar(page, "admin-desktop");
    await page.setViewportSize({ width: 360, height: 800 });
    await semOverflow(page);
    await capturar(page, "admin-mobile");
    await context.close();
  }

  // Falhas, listas vazias e expiração sem vazamento de painel.
  {
    const { page, context, estado } = await cenario("cliente", { listaStatus: 500 });
    await page.goto(`${origem}/dashboard/cliente`);
    await page.locator("#servicos").getByRole("alert").waitFor();
    verificar(page.url().includes("/dashboard/cliente"), "HTTP 500 de dados não encerra sessão");
    estado.listaStatus = 200;
    estado.servicos = []; estado.solicitacoes = []; estado.ordens = [];
    await page.getByRole("button", { name: "Atualizar dados" }).click();
    await visivel(page, page.getByText("Nenhum serviço disponível no momento."));
    await visivel(page, page.getByText("Você ainda não possui solicitações."));
    await visivel(page, page.getByText("Nenhuma ordem encontrada."));
    estado.listaStatus = 401;
    await page.getByRole("button", { name: "Atualizar dados" }).click();
    await page.waitForURL("**/login");
    verificar(!(await page.getByText("Pessoa de teste", { exact: true }).count()), "401 remove o conteúdo privado");
    await context.close();
  }
  {
    let liberar;
    const mePendente = new Promise((resolve) => { liberar = resolve; });
    const { page, context, estado } = await cenario("cliente", { mePendente });
    await page.goto(`${origem}/dashboard/cliente`);
    await visivel(page, page.getByText("Verificando sua sessão..."));
    verificar(!estado.chamadas.some((item) => item.caminho === "/api/servicos"), "Dados não são consultados antes da sessão");
    liberar();
    await visivel(page, page.getByRole("heading", { name: "Serviços disponíveis", exact: true }));
    estado.meStatus = 500;
    await page.reload();
    await visivel(page, page.getByRole("heading", { name: "Não foi possível verificar o acesso" }));
    verificar(page.url().includes("/dashboard/cliente"), "500 na sessão não redireciona ao login");
    estado.meStatus = 200;
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await visivel(page, page.getByRole("heading", { name: "Serviços disponíveis", exact: true }));
    await context.close();
  }
  assert.deepEqual(erros, []);
  console.log(`${verificacoes} verificações de navegador aprovadas; sem exceções JavaScript. Capturas: ${pasta}`);
} finally {
  await browser.close();
  await vite.close();
}
