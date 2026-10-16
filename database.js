require("dotenv").config();
const fs = require("fs");
const mysql = require("mysql2");
const path = require("path");

// criando a conexao com banco de dados por meio da biblioteca mysql2

const caPath = process.env.CA_PATH || path.join(__dirname, "ca.pem")
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,

  ssl: {
    ca: fs.readFileSync(caPath),
  },
});

// script para testar conexao

connection.connect((erro) => {
  if (erro) {
    console.log("erro ao conectar ao banco de dados:", erro.message);
    return;
  }
  console.log("conectado ao mysql com sucesso!");
});

module.exports = connection;
