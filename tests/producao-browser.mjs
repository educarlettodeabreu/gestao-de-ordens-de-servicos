// React compilado + Express real na mesma origem HTTPS.
// Só MySQL e o store são substituídos; nenhuma requisição de API é interceptada.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:https";
import { createServer as criarHttp } from "node:http";
import { once } from "node:events";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const carregar = createRequire(import.meta.url);
const { criarAplicacao } = carregar("./helpers/aplicacao.cjs");
const caminhoPlaywright = process.env.ERP_PLAYWRIGHT_PATH ?? process.argv[2];
const modulo = await import(caminhoPlaywright ? pathToFileURL(caminhoPlaywright).href : "playwright-core");
const { chromium } = modulo.default ?? modulo;
const pastaTls = await mkdtemp(path.join(tmpdir(), "erp-tls-teste-"));
const chave = path.join(pastaTls, "chave.key");
const certificado = path.join(pastaTls, "certificado.crt");
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", chave, "-out", certificado,
  "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1"], { stdio: "ignore" });
const { app, estado } = criarAplicacao();
const servidor = createServer({ key: await readFile(chave), cert: await readFile(certificado) }, app);
servidor.listen(0, "127.0.0.1");
await once(servidor, "listening");
const origem = `https://127.0.0.1:${servidor.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.ERP_BROWSER_EXECUTABLE ?? process.argv[3], headless: true, args: ["--no-sandbox"] });
const imagens = process.env.ERP_SCREENSHOT_DIR ?? "/tmp/erp-producao-capturas";
await mkdir(imagens, { recursive: true });
const erros = [], falhasCarregamento = [], assets = [], violacoesCsp = [], cancelamentosAposSucesso = [], cancelamentosDev = [];
let verificacoes = 0;
function verificar(valor, mensagem) { assert.ok(valor, mensagem); verificacoes++; }

async function contexto(desenvolvimento = false) {
  // Exceção exclusiva do teste para o certificado temporário autoassinado.
  const context = await browser.newContext({ ignoreHTTPSErrors: true, locale: "pt-BR", timezoneId: "America/Sao_Paulo", viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const respostas = new WeakMap();
  page.on("pageerror", (erro) => erros.push(erro.message));
  page.on("requestfailed", (req) => {
    const erro = req.failure()?.errorText;
    const status = respostas.get(req);
    // A navegação/GC pode cancelar a leitura de um corpo que o fetch não consome.
    // Aceitamos isso só após uma resposta 2xx da API, nunca para JS/CSS ou sem resposta.
    if (erro === "net::ERR_ABORTED" && status >= 200 && status < 300 && new URL(req.url()).pathname.startsWith("/api/")) {
      cancelamentosAposSucesso.push(req.url());
    } else if (desenvolvimento && erro === "net::ERR_ABORTED" && req.method() === "GET"
      && ["/api/servicos", "/api/minhassolicitacoes", "/api/minhasordens"].includes(new URL(req.url()).pathname)) {
      // StrictMode no React de desenvolvimento monta/limpa efeitos e cancela a
      // primeira consulta. A segunda precisa terminar e preencher a interface.
      cancelamentosDev.push(req.url());
    } else falhasCarregamento.push({ url: req.url(), erro, status });
  });
  page.on("response", (res) => {
    respostas.set(res.request(), res.status());
    if (new URL(res.url()).pathname.startsWith("/assets/")) assets.push({ url: res.url(), status: res.status() });
  });
  await page.exposeFunction("registrarCsp", (valor) => violacoesCsp.push(valor));
  await page.addInitScript(() => document.addEventListener("securitypolicyviolation", (e) => window.registrarCsp(`${e.violatedDirective}: ${e.blockedURI}`)));
  return { context, page };
}
async function aguardarDados(page) {
  await page.waitForFunction(() => !document.querySelector('.erp-loading, [aria-busy="true"]')
    && Boolean(document.querySelector('.erp-shell, .login-form')));
}
async function login(page, id, classe) {
  await page.goto(`${origem}/login`);
  await page.getByLabel("E-mail", { exact: true }).fill(`teste${id}@example.com`);
  await page.getByLabel("Senha", { exact: true }).fill("senha-de-teste");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(`${origem}/dashboard/${classe}`);
  await aguardarDados(page);
  const cookies = await page.context().cookies();
  const cookie = cookies.find((item) => item.name === "cookie_sessao_id");
  verificar(cookie?.secure && cookie.httpOnly && cookie.sameSite === "Lax", "Cookie real mantém Secure/HttpOnly/SameSite.");
}
async function captura(page, nome) {
  await aguardarDados(page);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(imagens, `${nome}.png`), fullPage: true });
}

try {
  {
    const { context, page } = await contexto();
    await page.goto(`${origem}/cadastro`);
    await page.getByLabel("Nome completo").fill("Cliente do navegador");
    await page.getByLabel("E-mail", { exact: true }).fill("browser@example.com");
    await page.getByLabel("Senha", { exact: true }).fill("senha-de-teste");
    await page.getByLabel("Confirmar senha", { exact: true }).fill("senha-de-teste");
    await page.getByRole("button", { name: "Criar conta", exact: true }).click();
    await page.getByText("Conta criada com sucesso!").waitFor();
    verificar(!(await context.cookies()).some((cookie) => cookie.name === "cookie_sessao_id"), "Cadastro não cria sessão.");
    verificar(estado.usuarios.at(-1).classe === "cliente", "Cadastro público continua restrito a cliente.");
    await login(page, 2, "cliente");
    await page.getByRole("combobox", { name: /^Serviço/ }).selectOption("1");
    await page.getByLabel("Descrição do problema").fill("Solicitação pelo React compilado");
    await page.getByRole("button", { name: "Enviar solicitação" }).click();
    await page.locator("#solicitacoes").getByText("Solicitação pelo React compilado").waitFor();
    verificar(estado.solicitacoes.at(-1).usuario_id === 2, "API real usa o ID da sessão na solicitação.");
    await page.reload();
    await page.getByRole("heading", { name: "Serviços disponíveis", exact: true }).waitFor();
    await aguardarDados(page);
    verificar(page.url().endsWith("/dashboard/cliente"), "Atualizar URL preserva a sessão.");
    await page.goto(`${origem}/dashboard/admin`);
    await page.waitForURL(`${origem}/dashboard/cliente`);
    verificar(true, "Classe do cliente não abre o admin.");
    await captura(page, "cliente-desktop");
    await page.setViewportSize({ width: 375, height: 812 });
    verificar(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Sem overflow no celular.");
    await page.getByRole("button", { name: "Alternar menu" }).click();
    verificar(await page.getByRole("navigation", { name: "Menu do painel" }).isVisible(), "Menu móvel funciona.");
    await captura(page, "cliente-mobile");
    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await page.waitForURL(`${origem}/login`);
    verificar(!(await context.cookies()).some((cookie) => cookie.name === "cookie_sessao_id"), "Logout remove o cookie real.");
    await page.goto(`${origem}/dashboard/cliente`);
    await page.waitForURL(`${origem}/login`);
    verificar(true, "Sessão encerrada não reabre painel.");
    await aguardarDados(page);
    await context.close();
  }
  // Desenvolvimento: Vite termina HTTPS e mantém /api ao encaminhar ao Express HTTP.
  {
    const backend = criarHttp(app);
    backend.listen(0, "127.0.0.1");
    await once(backend, "listening");
    const variaveis = ["DEV_HTTPS_KEY", "DEV_HTTPS_CERT", "API_PROXY_TARGET"];
    const anteriores = Object.fromEntries(variaveis.map((nome) => [nome, process.env[nome]]));
    process.env.DEV_HTTPS_KEY = chave;
    process.env.DEV_HTTPS_CERT = certificado;
    process.env.API_PROXY_TARGET = `http://127.0.0.1:${backend.address().port}`;
    const frontend = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../frontend");
    const { createServer: criarVite } = await import(carregar.resolve("vite", { paths: [frontend] }));
    const vite = await criarVite({ root: frontend, configFile: path.join(frontend, "vite.config.ts"), server: { host: "127.0.0.1", port: 0, hmr: false, ws: false }, logLevel: "error" });
    for (const nome of variaveis) {
      if (anteriores[nome] === undefined) delete process.env[nome]; else process.env[nome] = anteriores[nome];
    }
    try {
      await vite.listen();
      const origemDev = `https://127.0.0.1:${vite.httpServer.address().port}`;
      const { context, page } = await contexto(true);
      await page.goto(`${origemDev}/login`);
      await page.getByLabel("E-mail", { exact: true }).fill("teste2@example.com");
      await page.getByLabel("Senha", { exact: true }).fill("senha-de-teste");
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
      await page.waitForURL(`${origemDev}/dashboard/cliente`);
      await page.getByRole("heading", { name: "Serviços disponíveis", exact: true }).waitFor();
      await aguardarDados(page);
      verificar(await page.locator("#servicos .erp-list li").count() > 0, "Proxy local carrega os serviços da API.");
      verificar(await page.getByRole("alert").count() === 0, "Sem erros de consulta pelo proxy local.");
      verificar(true, "Proxy local preserva /api e permite login sem Render.");
      const cookie = (await context.cookies()).find((c) => c.name === "cookie_sessao_id");
      verificar(cookie?.secure && cookie.httpOnly, "Proxy HTTPS local mantém cookies seguros.");
      await page.reload();
      await page.getByRole("heading", { name: "Serviços disponíveis", exact: true }).waitFor();
      await aguardarDados(page);
      verificar(page.url().endsWith("/dashboard/cliente"), "Sessão local persiste ao atualizar.");
      await context.close();
    } finally {
      await vite.close(); backend.closeAllConnections();
      await new Promise((resolve) => backend.close(resolve));
    }
  }
  {
    const { context, page } = await contexto();
    await login(page, 3, "funcionario");
    await page.locator("#ordens tbody tr").first().waitFor();
    verificar(await page.locator("#ordens tbody tr").count() === 1, "Funcionário consulta só a ordem atribuída.");
    verificar(await page.getByRole("button", { name: /Alterar status|Excluir/ }).count() === 0, "Funcionário permanece sem edição.");
    const bloqueada = await context.request.get(`${origem}/api/admin/funcionarios`);
    verificar(bloqueada.status() === 403, "Backend bloqueia a permissão administrativa.");
    await captura(page, "funcionario");
    await context.close();
  }
  {
    const { context, page } = await contexto();
    await login(page, 1, "admin");
    await page.getByLabel("Nome do serviço").fill("Serviço do navegador");
    await page.getByRole("button", { name: "Cadastrar serviço" }).click();
    await page.locator("#servicos").getByText("Serviço do navegador", { exact: true }).waitFor();
    verificar(estado.servicos.some((s) => s.nome === "Serviço do navegador"), "Cadastro de serviço usa Express real.");
    await page.getByRole("button", { name: "Criar ordem da solicitação 1", exact: true }).click();
    await page.getByRole("checkbox", { name: /Teste funcionario 3/ }).check();
    await page.getByRole("button", { name: "Confirmar criação" }).click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    const id = estado.ordens.at(-1).id;
    verificar(estado.atribuicoes.some((a) => a.ordem_id === id && a.funcionarios_id === 3), "Ordem criada com funcionário real da consulta.");
    await page.getByRole("button", { name: `Alterar status da ordem ${id}`, exact: true }).click();
    await page.getByLabel(`Novo status da ordem #${id}`).fill("em análise");
    await page.getByRole("button", { name: "Salvar status" }).click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    verificar(estado.ordens.at(-1).status === "em análise", "PATCH real atualiza status.");
    await page.reload();
    await page.getByRole("button", { name: `Excluir ordem ${id}`, exact: true }).click();
    await page.getByRole("button", { name: "Confirmar exclusão" }).click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    verificar(!estado.ordens.some((o) => o.id === id), "DELETE real exclui ordem após confirmação.");
    await captura(page, "admin");
    const ausente = await context.request.get(`${origem}/api/rota-inexistente`);
    verificar(ausente.status() === 404 && ausente.headers()["content-type"].includes("application/json"), "404 da API permanece JSON.");
    await context.close();
  }
  assert.deepEqual(erros, []);
  assert.deepEqual(falhasCarregamento, []);
  assert.deepEqual(violacoesCsp, []);
  verificar(assets.length > 0 && assets.every((item) => [200, 304].includes(item.status) && new URL(item.url).origin === origem),
    `Assets precisam carregar da mesma origem (200 ou cache 304): ${JSON.stringify(assets)}`);
  console.log(`${verificacoes} verificações HTTPS aprovadas com React compilado e Express; sem erros JS, falhas de assets ou violações CSP. MySQL/store substituídos apenas no teste. Capturas: ${imagens}`);
  if (cancelamentosAposSucesso.length) console.log(`${cancelamentosAposSucesso.length} leituras de corpo da API canceladas após HTTP 2xx; os efeitos e as respostas foram confirmados nos testes.`);
  if (cancelamentosDev.length) console.log(`${cancelamentosDev.length} consultas GET canceladas pelo StrictMode em desenvolvimento; as consultas seguintes preencheram a interface sem erros.`);
} finally {
  await browser.close();
  servidor.closeAllConnections();
  await new Promise((resolve) => servidor.close(resolve));
}
