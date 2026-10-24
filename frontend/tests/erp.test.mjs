import assert from "node:assert/strict";
import { after, afterEach, mock, test } from "node:test";
import { createServer } from "vite";

const vite = await createServer({ configFile: false, server: { middlewareMode: true, watch: null, ws: false }, appType: "custom" });
const api = await vite.ssrLoadModule("/src/services/ERP.ts");
const { ErroHttp, mensagemErroApi } = await vite.ssrLoadModule("/src/services/api.ts");
const { contarStatus, formatarData } = await vite.ssrLoadModule("/src/utils/formatacao.ts");
after(() => vite.close());
afterEach(() => mock.restoreAll());

const ordem = { id: 1, cliente_id: 4, servico_id: 2, descricao: "Teste", status: "aberta", criado_em: "2026-10-24T12:00:00Z", atualizado_em: null };
const solicitacao = { id: 1, usuario_id: 4, servico_id: 2, descricao: "Teste", criado_em: null };
const servico = { id: 2, nome: "Manutenção", criado_em: null };
const solicitacaoAdmin = { id: 1, descricao: "Teste", criado_em: null, cliente_nome: "Teste", cliente_email: "teste@example.com", servico_nome: "Manutenção" };

for (const [funcao, caminho, dados] of [
  ["listarServicos", "/servicos", servico],
  ["listarMinhasSolicitacoes", "/minhassolicitacoes", solicitacao],
  ["listarMinhasOrdens", "/minhasordens", ordem],
  ["listarOrdensFuncionario", "/funcionario/ordens", ordem],
  ["listarSolicitacoes", "/consulsolicitacoes", solicitacaoAdmin],
  ["listarOrdens", "/consultOrdens", ordem],
  ["listarFuncionarios", "/admin/funcionarios", { id: 2, nome: "Equipe", email: "equipe@example.com" }],
]) {
  test(`${funcao} consulta contrato real sem ID de usuário no navegador`, async () => {
    const fetch = mock.method(globalThis, "fetch", async () => Response.json([dados]));
    const signal = new AbortController().signal;
    assert.deepEqual(await api[funcao](signal), [dados]);
    const [url, opcoes] = fetch.mock.calls[0].arguments;
    assert.equal(url, `/api${caminho}`);
    assert.equal(opcoes.body, undefined);
    assert.equal(opcoes.credentials, "same-origin");
    assert.equal(opcoes.cache, "no-store");
    assert.equal(opcoes.signal, signal);
  });
  test(`${funcao} aceita lista vazia`, async () => {
    mock.method(globalThis, "fetch", async () => Response.json([]));
    assert.deepEqual(await api[funcao](), []);
  });
  test(`${funcao} rejeita resposta com campos incompatíveis`, async () => {
    mock.method(globalThis, "fetch", async () => Response.json([{ id: 1 }]));
    await assert.rejects(api[funcao](), /Resposta inválida/);
  });
}

for (const [funcao, args, caminho, method, dados] of [
  ["criarSolicitacao", [2, "Problema"], "/solicitacoes", "POST", { servicoid: 2, descricao: "Problema" }],
  ["criarServico", ["Manutenção"], "/servicos", "POST", { nome: "Manutenção" }],
  ["excluirServico", ["Manutenção"], "/servicos/delet", "DELETE", { nome: "Manutenção" }],
  ["criarOrdem", [1, []], "/ordem", "POST", { solicitacao_id: 1, funcionarios: [] }],
  ["criarOrdem", [1, [2, 3]], "/ordem", "POST", { solicitacao_id: 1, funcionarios: [2, 3] }],
  ["atualizarStatus", [1, "aberta"], "/ordem/status", "PATCH", { ordem: 1, status: "aberta" }],
  ["excluirOrdem", [1], "/ordem/1", "DELETE", undefined],
]) {
  test(`${funcao} envia somente campos previstos: ${JSON.stringify(args)}`, async () => {
    const fetch = mock.method(globalThis, "fetch", async () => Response.json({}, { status: method === "POST" ? 201 : 200 }));
    await api[funcao](...args);
    const [url, opcoes] = fetch.mock.calls[0].arguments;
    assert.equal(url, `/api${caminho}`);
    assert.equal(opcoes.method, method);
    assert.equal(opcoes.credentials, "same-origin");
    assert.deepEqual(opcoes.body === undefined ? undefined : JSON.parse(opcoes.body), dados);
    if (dados) assert.equal(opcoes.headers["Content-Type"], "application/json");
  });
}

for (const status of [400, 401, 403, 404, 429, 500]) {
  test(`listagem e escrita propagam HTTP ${status} sem declarar sucesso`, async () => {
    mock.method(globalThis, "fetch", async () => Response.json({}, { status }));
    await assert.rejects(api.listarMinhasOrdens(), (erro) => erro instanceof ErroHttp && erro.status === status);
    await assert.rejects(api.criarSolicitacao(2, "Teste"), (erro) => erro instanceof ErroHttp && erro.status === status);
    assert.ok(mensagemErroApi(new ErroHttp(status)).length > 0);
  });
}

test("falha de rede permanece distinta de resposta HTTP", async () => {
  mock.method(globalThis, "fetch", async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(api.listarServicos(), TypeError);
  assert.match(mensagemErroApi(new TypeError()), /conectar ao servidor/);
});

test("contadores preservam os status reais e datas ausentes são tratadas", () => {
  assert.deepEqual(contarStatus([ordem, { ...ordem, id: 2 }, { ...ordem, id: 3, status: "em análise" }]), [
    { status: "aberta", quantidade: 2 }, { status: "em análise", quantidade: 1 },
  ]);
  assert.equal(formatarData(null), "Data não informada");
  assert.equal(formatarData("inválido"), "Data não informada");
});
