require("dotenv").config();
const mysql = require("mysql2");

// craindo a conexao com bancoi de dados por meio da biblioteca mysql2

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
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
