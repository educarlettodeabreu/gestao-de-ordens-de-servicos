// Usa o app.js real com Express, bcrypt e express-session instalados no backend.
// Somente banco e armazenamento MySQL são substituídos; não acessa credenciais reais.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { once } from "node:events";
import path from "node:path";
import vm from "node:vm";

const pasta = path.resolve(process.env.ERP_BACKEND_DIR ?? process.argv[2] ?? '..');
assert.ok(pasta, "Informe ERP_BACKEND_DIR ou passe o diretório do backend como argumento.");
const carregar = createRequire(path.join(pasta, "package.json"));
const express = carregar("express");
const session = carregar("express-session");
const bcrypt = carregar("bcrypt");
const codigo = await readFile(path.join(pasta, "app.js"), "utf8");
const hash = await bcrypt.hash("senha-de-teste", 4);
const usuarios = ["admin", "cliente", "funcionario"].map((classe, i) => ({
  id: i + 1, nome: `Teste ${classe}`, email: `${classe}@example.com`, classe, senha: hash,
}));
let falhaBanco = false;
const consultas = [];
const db = { query(sql, parametros, callback) {
  consultas.push({ sql, parametros: Array.from(parametros) });
  if (falhaBanco) return callback(new Error("detalhes privados"));
  if (sql.startsWith("SELECT * FROM users WHERE email")) return callback(null, usuarios.filter((u) => u.email === parametros[0]));
  if (sql.startsWith("SELECT id, nome, email, classe FROM users")) return callback(null, usuarios.filter((u) => u.id === parametros[0]));
  if (sql.startsWith("SELECT id, nome, email FROM users WHERE classe")) return callback(null, usuarios.filter((u) => u.classe === parametros[0]));
  if (sql.startsWith("SELECT * FROM ordens WHERE cliente_id")) return callback(null, []);
  throw new Error(`Consulta não prevista no teste: ${sql}`);
} };
let app;
function criarExpress() { app = express(); app.listen = () => {}; return app; }
criarExpress.json = express.json;
criarExpress.Router = express.Router;
criarExpress.static = express.static;
vm.runInNewContext(codigo, {
  require(nome) {
    if (nome === "dotenv") return { config() {} };
    if (nome === "./database.js") return db;
    if (nome === "express") return criarExpress;
    if (nome === "fs") return { readFileSync: () => Buffer.from("certificado-somente-de-teste") };
    if (nome === "express-mysql-session") return () => function StoreTeste() { return new session.MemoryStore(); };
    return carregar(nome);
  },
  process: { env: { PORT: "0", SESSION_SECRET: "segredo-local-exclusivo-deste-teste" } },
  __dirname: pasta,
  console: { log() {} },
  Buffer,
  module: { exports: {} },
});

const servidor = createServer(app);
servidor.listen(0, "127.0.0.1");
await once(servidor, "listening");
const origem = `http://127.0.0.1:${servidor.address().port}`;
let verificacoes = 0;
function verificar(valor, esperado) { assert.deepEqual(valor, esperado); verificacoes++; }
async function login(classe) {
  const resposta = await fetch(`${origem}/api/login`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-Proto": "https" },
    body: JSON.stringify({ email: `${classe}@example.com`, senha: "senha-de-teste" }),
  });
  verificar(resposta.status, 200);
  const cookie = resposta.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Lax/); verificacoes += 3;
  return cookie.split(";")[0];
}

try {
  verificar((await fetch(`${origem}/api/me`)).status, 401);
  verificar((await fetch(`${origem}/api/admin/funcionarios`)).status, 401);
  const admin = await login("admin");
  const me = await fetch(`${origem}/api/me?id=3`, { headers: { Cookie: admin } });
  verificar(me.status, 200);
  verificar(await me.json(), { id: 1, nome: "Teste admin", email: "admin@example.com", classe: "admin" });
  verificar(me.headers.get("cache-control"), "no-store");
  const funcionarios = await fetch(`${origem}/api/admin/funcionarios`, { headers: { Cookie: admin } });
  verificar(funcionarios.status, 200);
  verificar(await funcionarios.json(), [{ id: 3, nome: "Teste funcionario", email: "funcionario@example.com" }]);
  const cliente = await login("cliente");
  verificar((await fetch(`${origem}/api/admin/funcionarios`, { headers: { Cookie: cliente } })).status, 403);
  verificar((await fetch(`${origem}/api/minhasordens?cliente_id=999`, { headers: { Cookie: cliente } })).status, 200);
  verificar(consultas.at(-1).parametros, [2]);
  falhaBanco = true;
  verificar((await fetch(`${origem}/api/me`, { headers: { Cookie: admin } })).status, 500);
  verificar((await fetch(`${origem}/api/admin/funcionarios`, { headers: { Cookie: admin } })).status, 500);
  falhaBanco = false;
  const funcionario = await login("funcionario");
  verificar((await fetch(`${origem}/api/admin/funcionarios`, { headers: { Cookie: funcionario } })).status, 403);
  usuarios.splice(usuarios.findIndex((u) => u.classe === "cliente"), 1);
  verificar((await fetch(`${origem}/api/me`, { headers: { Cookie: cliente } })).status, 401);
  verificar((await fetch(`${origem}/api/logout`, { method: "POST", headers: { Cookie: admin } })).status, 200);
  verificar((await fetch(`${origem}/api/me`, { headers: { Cookie: admin } })).status, 401);
  console.log(`${verificacoes} verificações HTTP aprovadas com Express e sessões reais; banco e armazenamento substituídos no teste.`);
} finally {
  servidor.closeAllConnections();
  await new Promise((resolve) => servidor.close(resolve));
}
