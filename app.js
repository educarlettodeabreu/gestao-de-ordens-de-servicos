require("dotenv").config();
const express = require("express");
const app = express();
const db = require("./database.js");
const port = process.env.PORT;
app.use(express.json());

// rota de autenticacao!

app.post("/login", (req, res) => {
  const { email, senha } = req.body;

  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (erro, result) => {
      if (erro) return res.status(500).json({ erro: "erro no servidor" });

      if (result.length === 0)
        return res.status(401).json({ erro: "usuario nao encontrado!" });
    },
  );
});

app.listen(port, () => {
  console.log("servidor rodando na porta 3000!");
});
