// Fixtures e substituições ficam somente nos testes. O app não tem modo mock.
const Module = require("node:module");
const path = require("node:path");
const bcrypt = require("bcrypt");
const session = require("express-session");

const arquivoApp = path.resolve(__dirname, "../../app.js");

function prepararDependencias() {
  const data = "2026-10-24T12:00:00.000Z";
  const hash = bcrypt.hashSync("senha-de-teste", 4);
  const estado = {
    usuarios: ["admin", "cliente", "funcionario", "cliente"].map((classe, i) => ({
      id: i + 1, nome: `Teste ${classe} ${i + 1}`, email: `teste${i + 1}@example.com`, senha: hash, classe,
    })),
    servicos: [{ id: 1, nome: "Manutenção de teste", criado_em: data }],
    solicitacoes: [2, 4].map((usuario_id, i) => ({ id: i + 1, usuario_id, servico_id: 1, descricao: `Problema ${i + 1}`, criado_em: data })),
    ordens: [2, 4].map((cliente_id, i) => ({ id: i + 1, cliente_id, servico_id: 1, descricao: `Atendimento ${i + 1}`, status: "aberta", criado_em: data, atualizado_em: data })),
    atribuicoes: [{ ordem_id: 1, funcionarios_id: 3 }],
    consultas: [], falhaBanco: false,
  };
  const proximoId = (lista) => Math.max(0, ...lista.map((item) => item.id)) + 1;
  const db = { query(sql, valores, callback) {
    if (typeof valores === "function") { callback = valores; valores = []; }
    callback ??= () => {};
    valores ??= [];
    const query = sql.replace(/\s+/g, " ").trim();
    estado.consultas.push({ sql: query, valores: [...valores] });
    if (estado.falhaBanco) return callback(new Error("detalhes privados do banco de teste"));
    let resultado;
    if (query === "SELECT * FROM users WHERE email = ?") resultado = estado.usuarios.filter((u) => u.email === valores[0]);
    else if (query.startsWith("SELECT id, nome, email, classe FROM users WHERE id")) resultado = estado.usuarios.filter((u) => u.id === valores[0]);
    else if (query.startsWith("SELECT id, nome, email FROM users WHERE classe")) resultado = estado.usuarios.filter((u) => u.classe === valores[0]);
    else if (query.startsWith("INSERT INTO users")) {
      const id = proximoId(estado.usuarios);
      estado.usuarios.push({ id, nome: valores[0], email: valores[1], senha: valores[2], classe: valores[3] ?? "cliente" });
      resultado = { insertId: id, affectedRows: 1 };
    } else if (query.startsWith("DELETE FROM users")) {
      const antes = estado.usuarios.length;
      estado.usuarios = estado.usuarios.filter((u) => u.email !== valores[0]);
      resultado = { affectedRows: antes - estado.usuarios.length };
    } else if (query.startsWith("INSERT INTO servicos")) {
      const id = proximoId(estado.servicos);
      estado.servicos.push({ id, nome: valores[0], criado_em: data });
      resultado = { insertId: id, affectedRows: 1 };
    } else if (query.startsWith("DELETE FROM servicos")) {
      const antes = estado.servicos.length;
      estado.servicos = estado.servicos.filter((s) => s.nome !== valores[0]);
      resultado = { affectedRows: antes - estado.servicos.length };
    } else if (query === "SELECT * FROM servicos") resultado = estado.servicos;
    else if (query.startsWith("INSERT INTO solicitacoes")) {
      const id = proximoId(estado.solicitacoes);
      estado.solicitacoes.push({ id, usuario_id: valores[0], servico_id: valores[1], descricao: valores[2], criado_em: data });
      resultado = { insertId: id, affectedRows: 1 };
    } else if (query.startsWith("SELECT solicitacoes.id")) {
      resultado = estado.solicitacoes.map((s) => ({ id: s.id, descricao: s.descricao, criado_em: s.criado_em,
        cliente_nome: estado.usuarios.find((u) => u.id === s.usuario_id).nome,
        cliente_email: estado.usuarios.find((u) => u.id === s.usuario_id).email,
        servico_nome: estado.servicos.find((v) => v.id === s.servico_id).nome }));
    } else if (query.startsWith("SELECT * FROM solicitacoes WHERE usuario_id")) resultado = estado.solicitacoes.filter((s) => s.usuario_id === valores[0]);
    else if (query.startsWith("SELECT * FROM solicitacoes WHERE solicitacoes.id")) resultado = estado.solicitacoes.filter((s) => s.id === valores[0]);
    else if (query.startsWith("DELETE FROM solicitacoes")) {
      estado.solicitacoes = estado.solicitacoes.filter((s) => s.id !== valores[0]); resultado = { affectedRows: 1 };
    } else if (query.startsWith("INSERT INTO ordens")) {
      const id = proximoId(estado.ordens);
      estado.ordens.push({ id, cliente_id: valores[0], servico_id: valores[1], descricao: valores[2], status: "aberta", criado_em: data, atualizado_em: data });
      resultado = { insertId: id, affectedRows: 1 };
    } else if (query.startsWith("INSERT INTO ordem_funcionarios")) {
      estado.atribuicoes.push(...valores[0].map(([ordem_id, funcionarios_id]) => ({ ordem_id, funcionarios_id })));
      resultado = { affectedRows: valores[0].length };
    } else if (query.startsWith("UPDATE ordens SET status")) {
      const ordem = estado.ordens.find((o) => o.id === valores[1]);
      if (ordem) ordem.status = valores[0];
      resultado = { affectedRows: ordem ? 1 : 0 };
    } else if (query.startsWith("DELETE FROM ordens")) {
      const antes = estado.ordens.length;
      estado.ordens = estado.ordens.filter((o) => o.id !== Number(valores[0]));
      resultado = { affectedRows: antes - estado.ordens.length };
    } else if (query.startsWith("SELECT * FROM ordens WHERE cliente_id")) resultado = estado.ordens.filter((o) => o.cliente_id === valores[0]);
    else if (query.startsWith("SELECT * FROM ordens WHERE status")) resultado = estado.ordens.filter((o) => o.status === valores[0]);
    else if (query === "SELECT * FROM ordens") resultado = estado.ordens;
    else if (query.startsWith("SELECT ordens.* FROM ordens JOIN")) resultado = estado.ordens.filter((o) => estado.atribuicoes.some((a) => a.ordem_id === o.id && a.funcionarios_id === valores[0]));
    else throw new Error(`Consulta não prevista no teste: ${query}`);
    return callback(null, resultado);
  } };

  const original = Module._load;
  Module._load = function (nome, parent, ...args) {
    if (parent?.filename === arquivoApp) {
      if (nome === "./database.js") return db;
      if (nome === "dotenv") return { config() {} }; // Não lê .env do usuário.
      if (nome === "fs") return { readFileSync: () => Buffer.from("certificado-apenas-de-teste") };
      if (nome === "express-mysql-session") return () => function StoreTeste() { return new session.MemoryStore(); };
    }
    return original.call(this, nome, parent, ...args);
  };
  return { estado, restaurar: () => { Module._load = original; } };
}

function criarAplicacao() {
  const dependencias = prepararDependencias();
  const segredoAnterior = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "segredo-isolado-exclusivo-dos-testes";
  delete require.cache[arquivoApp];
  try {
    return { app: require(arquivoApp), estado: dependencias.estado };
  } finally {
    dependencias.restaurar();
    if (segredoAnterior === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = segredoAnterior;
  }
}

module.exports = { criarAplicacao, prepararDependencias };
