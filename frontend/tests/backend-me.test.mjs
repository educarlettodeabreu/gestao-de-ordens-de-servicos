import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

// Executa somente a rota proposta no patch, sem iniciar Express, MySQL ou Render.
const patch = await readFile(new URL("../docs/backend/me.patch", import.meta.url), "utf8");
const codigo = patch.split("\n")
  .filter((linha) => linha.startsWith("+") && !linha.startsWith("+++"))
  .map((linha) => linha.slice(1)).join("\n");

function executar({ sessao, resultado = [], erro = null, query = {} } = {}) {
  let middleware;
  let handler;
  const consultas = [];
  const req = { session: sessao, query, body: { id: 999 } };
  const res = {
    statusCode: 200,
    headers: {},
    set(nome, valor) { this.headers[nome] = valor; return this; },
    status(status) { this.statusCode = status; return this; },
    json(dados) { this.dados = dados; return this; },
  };
  vm.runInNewContext(codigo, {
    app: {
      get(caminho, autenticacao, rota) {
        assert.equal(caminho, "/me");
        middleware = autenticacao;
        handler = rota;
      },
    },
    // Contrato do middleware atual do Express, sem conexão com o banco.
    verifAutenticacao(req, res, next) {
      if (req.session?.usuarioLogado) return next();
      return res.status(401).json({ erro: "acesso negado!" });
    },
    db: {
      query(sql, valores, callback) {
        consultas.push({ sql, valores: Array.from(valores) });
        callback(erro, resultado);
      },
    },
  });
  middleware(req, res, () => handler(req, res));
  return { res, consultas };
}

test("patch de /me exige sessão antes de consultar o banco", () => {
  const { res, consultas } = executar();
  assert.equal(res.statusCode, 401);
  assert.equal(consultas.length, 0);
});

test("patch de /me rejeita ID inválido na sessão", () => {
  const { res, consultas } = executar({ sessao: { usuarioLogado: {} } });
  assert.equal(res.statusCode, 401);
  assert.equal(consultas.length, 0);
});

test("patch de /me usa somente ID da sessão e devolve campos públicos do banco", () => {
  const { res, consultas } = executar({
    sessao: { usuarioLogado: { id: 4, classe: "admin" } },
    query: { id: 999 },
    resultado: [{ id: 4, nome: "Teste", email: "teste@example.com", classe: "cliente", senha: "hash-privado" }],
  });
  assert.equal(res.statusCode, 200);
  assert.equal(consultas[0].sql, "SELECT id, nome, email, classe FROM users WHERE id = ?");
  assert.deepEqual(consultas[0].valores, [4]);
  assert.deepEqual(JSON.parse(JSON.stringify(res.dados)), {
    id: 4, nome: "Teste", email: "teste@example.com", classe: "cliente",
  });
  assert.equal(res.headers["Cache-Control"], "no-store");
});

test("patch de /me responde 401 se o usuário foi excluído", () => {
  const { res } = executar({ sessao: { usuarioLogado: { id: 4 } } });
  assert.equal(res.statusCode, 401);
});

test("patch de /me responde 500 sem expor o erro do banco", () => {
  const { res } = executar({
    sessao: { usuarioLogado: { id: 4 } },
    erro: new Error("detalhes privados do banco"),
  });
  assert.equal(res.statusCode, 500);
  assert.doesNotMatch(JSON.stringify(res.dados), /detalhes privados/);
});
