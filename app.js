require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const bcrypt = require("bcrypt");
const app = express();
const db = require("./database.js");
const port = process.env.PORT;
app.use(express.json());

// middleware padrao para sessoes!

function verifAutenticacao(req, res, next) {
  if (req.session && req.session.usuarioLogado) {
    return next();
  }
  return res.status(401).json({ erro: "acesso negado!" });
}

// middleware para verificacao de classe para admin!

function verifAdmin(req, res, next) {
  if (req.session.usuarioLogado.classe === "admin") return next();

  return res.status(403).json({ erro: "acesso restrito!" });
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
        classe: usuario.classe,
      };
      return res
        .status(200)
        .json({ mensagem: "usuario logado e sessao criada!" });
    },
  );
});

// rota para cadastro e criacao de contas!

app.post("/cadastro", verifAutenticacao, verifAdmin, async (req, res) => {
  const { nome, email, senha, classe } = req.body;

  const hash = await bcrypt.hash(senha, 10);

  db.query(
    "INSERT INTO users ( nome, email, senha, classe) VALUES ( ?, ?, ?, ?)",
    [nome, email, hash, classe],
    async (erro, result) => {
      if (erro)
        return res.status(500).json({ erro: "erro ao conectar com servidor!" });

      return res.status(200).json({ mensagem: "conta criada com sucesso!" });
    },
  );
});

// rota para a exclusao de contas!

app.delete("/delet", verifAutenticacao, verifAdmin, (req, res) => {
  const { email } = req.body;

  db.query(
    " DELETE FROM users WHERE email = ?",
    [email],
    async (erro, result) => {
      if (erro) return res.status(500).json({ erro: "erro ao excluir conta" });

      return res
        .status(200)
        .json({ mensagem: `conta: ${email} exluida com sucesso!` });
    },
  );
});

app.listen(port, () => {
  console.log("servidor rodando na porta 3000!");
});
