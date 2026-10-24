import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

const patch = await readFile(new URL("../docs/backend/funcionarios.patch", import.meta.url), "utf8");
const codigo = patch.split("\n").filter((linha) => linha.startsWith("+") && !linha.startsWith("+++"))
  .map((linha) => linha.slice(1)).join("\n");

function executar(classe, resultado = [], erro = null) {
  let rota;
  const consultas = [];
  const req = { session: classe ? { usuarioLogado: { id: 1, classe } } : null };
  const res = {
    codigo: 200, dados: undefined,
    set() { return this; },
    status(codigo) { this.codigo = codigo; return this; },
    json(dados) { this.dados = dados; return this; },
  };
  vm.runInNewContext(codigo, {
    app: { get(caminho, ...handlers) { assert.equal(caminho, "/admin/funcionarios"); rota = handlers; } },
    verifAutenticacao(req, res, next) { return req.session?.usuarioLogado ? next() : res.status(401).json({ erro: "acesso negado" }); },
    verifAdmin(req, res, next) { return req.session.usuarioLogado.classe === "admin" ? next() : res.status(403).json({ erro: "restrito" }); },
    db: { query(sql, valores, callback) { consultas.push({ sql, valores: Array.from(valores) }); callback(erro, resultado); } },
  });
  let indice = 0;
  const next = () => rota[indice++]?.(req, res, next);
  next();
  return { res, consultas };
}

for (const classe of [null, "cliente", "funcionario"]) {
  test(`listagem de funcionários bloqueia ${classe ?? "sem sessão"}`, () => {
    const { res, consultas } = executar(classe);
    assert.equal(res.codigo, classe ? 403 : 401);
    assert.equal(consultas.length, 0);
  });
}
test("admin lista apenas id, nome e email de funcionários", () => {
  const { res, consultas } = executar("admin", [{ id: 2, nome: "Equipe", email: "equipe@example.com", senha: "privado" }]);
  assert.equal(res.codigo, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(res.dados)), [{ id: 2, nome: "Equipe", email: "equipe@example.com" }]);
  assert.match(consultas[0].sql, /WHERE classe = \?/);
  assert.deepEqual(consultas[0].valores, ["funcionario"]);
});
test("listagem de funcionários trata lista vazia e erro interno", () => {
  assert.equal(JSON.stringify(executar("admin").res.dados), "[]");
  const { res } = executar("admin", [], new Error("segredo"));
  assert.equal(res.codigo, 500);
  assert.doesNotMatch(JSON.stringify(res.dados), /segredo/);
});
