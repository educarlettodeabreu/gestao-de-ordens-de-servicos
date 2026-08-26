require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const bcrypt = require("bcrypt");
const app = express();
const db = require("./database.js");
const port = process.env.PORT;
app.use(express.json());

// middleware

function verifAutenticacao(req, res, next) {
  if (req.session && req.session.usuarioLogado) {
    return next();
  }
  return res.status(401).json({ erro: "acesso negado!" });
}

// configuracao da sessao!

const sessionOptions = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

const sessionStore = new MySQLStore(sessionOptions);

app.use(
  session({
    key: "cookie_sessao_id",
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 24, secure: false, httpOnly: true },
  }),
);

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

      const usuario = result[0];

      const senhaValida = await bcrypt.compare(senha, usuario.senha);

      if (!senhaValida) {
        return res.status(401).json({ erro: "senha incorreta" });
      }
      req.session.usuarioLogado = {
        id: usuario.id,
        email: usuario.email,
        tipo: usuario.tipo,
      };
      return res
        .status(200)
        .json({ mensagem: "usuario logado e sessao criada!" });
    },
  );
});

app.listen(port, () => {
  console.log("servidor rodando na porta 3000!");
});
