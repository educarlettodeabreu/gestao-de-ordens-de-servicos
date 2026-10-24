require("dotenv").config();
const validar = require("./validar")
const {
  loginSchema,
  cadastroSchema
} = require("./schemas.js")
const fs = require("fs")
const path = require("path")
const rateLimit = require("express-rate-limit")
const helmet = require("helmet")
const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const bcrypt = require("bcrypt");
const app = express();
const api = express.Router();
const frontendDist = path.join(__dirname, "frontend", "dist");
const db = require("./database.js");
const port = process.env.PORT || 3000;
app.use(helmet());
api.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
api.use(express.json({ limit: "50kb" }));

// limite de requisicoes!

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 6,
  message:  { erro: "muitas tentativas, tente novamente mais tarde" 
  }
})

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

// middleware para veirificacao de classe para clientes!

function verifCliente(req, res, next) {
  if (req.session.usuarioLogado.classe === "cliente") return next();

  return res.status(401).json({ mensagem: "acesso negado!" });
}

// middleware para verificacao de classe para funcionarios!

function verifFuncionarios(req, res, next) {
  if (req.session.usuarioLogado.classe === "funcionario") return next();
  return res.status(401).json({ mensagem: "acesso negado!" });
}

// configuracao da sessao!

const caPath =
  process.env.CA_PATH || path.join(__dirname, "ca.pem");

const sessionOptions = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,

  ssl: {
    ca: fs.readFileSync(caPath)
  }
};

const sessionStore = new MySQLStore(sessionOptions);

app.set("trust proxy", 1);

api.use(
  session({
    key: "cookie_sessao_id",
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24, secure: true, httpOnly: true, sameSite: "lax" },
  }),
);

// rota de autenticacao!

api.post("/login", loginLimiter, validar(loginSchema), (req, res) => {
  const { email, senha } = req.body;

  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (erro, result) => {
      if (erro) return res.status(500).json({ erro: "erro no servidor" });

      if (result.length === 0)
        return res.status(401).json({ erro: "email ou senha incorretos!" });

      const usuario = result[0];

      const senhaValida = await bcrypt.compare(senha, usuario.senha);

      if (!senhaValida) {
        return res.status(401).json({ erro: "email ou senha incorretos!" });
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

// rota para consultar o usuario autenticado!

api.get("/me", verifAutenticacao, (req, res) => {
  res.set("Cache-Control", "no-store");
  const usuarioId = req.session.usuarioLogado.id;

  if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) {
    return res.status(401).json({ erro: "sessao invalida!" });
  }

  db.query(
    "SELECT id, nome, email, classe FROM users WHERE id = ?",
    [usuarioId],
    (erro, result) => {
      if (erro) {
        return res.status(500).json({ erro: "erro ao consultar usuario!" });
      }

      if (result.length === 0) {
        return res.status(401).json({ erro: "sessao invalida!" });
      }

      const { id, nome, email, classe } = result[0];
      return res.status(200).json({ id, nome, email, classe });
    },
  );
});

// rota para logout!

api.post("/logout", verifAutenticacao, (req, res) => {
  req.session.destroy((erro) => {
    if (erro)
      return res.status(500).json({ erro: "erro ao encerrar a sessao!" });

    res.clearCookie("cookie_sessao_id");

    return res.status(200).json({ mensagem: "sessao encerrada com sucesso!" });
  });
});

// rota administrativa para selecionar funcionarios!

api.get("/admin/funcionarios", verifAutenticacao, verifAdmin, (req, res) => {
  res.set("Cache-Control", "no-store");
  db.query(
    "SELECT id, nome, email FROM users WHERE classe = ? ORDER BY nome, id",
    ["funcionario"],
    (erro, result) => {
      if (erro) {
        return res.status(500).json({ erro: "erro ao consultar funcionarios!" });
      }

      return res.status(200).json(result.map(({ id, nome, email }) => ({ id, nome, email })));
    },
  );
});

// rota para cadastro e criacao de contas!

api.post("/cadastro", verifAutenticacao, verifAdmin, async (req, res) => {
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

// rota publica para a criacao de contas para clientes!

api.post("/criarConta", loginLimiter, validar(cadastroSchema), async (req, res) => {
  const { nome, email, senha } = req.body;

  const hash = await bcrypt.hash(senha, 10);

  db.query(
    "INSERT INTO users (nome, email, senha) VALUES (?,?,?)",
    [nome, email, hash],
    async (erro, result) => {
      if (erro)
        return res
          .status(500)
          .json({ erro: "erro ao conectar com o servidor!" });
      return res.status(200).json({ mensagem: "conta criada com sucesso!" });
    },
  );
});

// rota para a exclusao de contas!

api.delete("/delet", verifAutenticacao, verifAdmin, (req, res) => {
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

// rota para a insercao de novos servicos!

api.post("/servicos", verifAutenticacao, verifAdmin, (req, res) => {
  const { nome } = req.body;
  db.query(
    "  INSERT INTO servicos ( nome ) VALUES (?)",
    [nome],
    (erro, result) => {
      if (erro)
        return res
          .status(500)
          .json({ erro: "nao foi possivel adicionar o servico!" });

      return res
        .status(201)
        .json({ mensagem: `servico: ${nome} adicionado com sucesso!` });
    },
  );
});

// rota para exclusao de servicos!

api.delete("/servicos/delet", verifAutenticacao, verifAdmin, (req, res) => {
  const { nome } = req.body;

  db.query("DELETE FROM servicos WHERE nome = ?", [nome], (erro, result) => {
    if (erro)
      return res
        .status(500)
        .json({ mensagem: `n foi possivel exccluir o servico: ${nome}!` });

    return res
      .status(200)
      .json({ mensagem: `servico: ${nome} excluido com sucesso!` });
  });
});

// orta para a consulta de servicos disponiveis!

api.get("/servicos", verifAutenticacao, (req, res) => {
  db.query("SELECT * FROM servicos", (erro, result) => {
    if (erro)
      return res.status(500).json({ erro: "erro ao consultar servicos!" });

    return res.status(200).json(result);
  });
});

// rota para a criacao de solicitacoes de servisos via cliente!

api.post("/solicitacoes", verifAutenticacao, verifCliente, (req, res) => {
  const { servicoid, descricao } = req.body;
  const usuarioid = req.session.usuarioLogado.id;

  db.query(
    "INSERT INTO solicitacoes (usuario_id, servico_id, descricao) VALUES (?,?,?)",
    [usuarioid, servicoid, descricao],
    (erro, result) => {
      if (erro)
        return res
          .status(500)
          .json({ erro: "nao foi possivel criar a solicitacao!" });

      return res
        .status(200)
        .json({ mensagem: "solicitacao criada com sucesso!" });
    },
  );
});

// rota para consultar solicitacoes abertas

api.get("/consulsolicitacoes", verifAutenticacao, verifAdmin, (req, res) => {
  db.query(
    "SELECT solicitacoes.id, solicitacoes.descricao, solicitacoes.criado_em, users.nome AS cliente_nome, users.email AS cliente_email, servicos.nome AS servico_nome FROM solicitacoes INNER JOIN users ON solicitacoes.usuario_id = users.id INNER JOIN servicos ON solicitacoes.servico_id = servicos.id",
    (erro, result) => {
      if (erro)
        return res
          .status(500)
          .json({ erro: "nao foi possivel consultar as solicitacoes!" });
      return res.status(200).json(result);
    },
  );
});

// rota para apenas clientes consultar suas solicitacoes!

api.get("/minhassolicitacoes", verifAutenticacao, verifCliente, (req, res) => {
  const usuarioId = req.session.usuarioLogado.id;

  db.query(
    "SELECT * FROM solicitacoes WHERE usuario_id = ?",
    [usuarioId],
    (erro, result) => {
      if (erro)
        return res.status(500).json({ erro: "erro ao consultar solicitacoes" });

      return res.status(200).json(result);
    },
  );
});

// rota para a criacao de ordens via solicitacoes!

api.post("/ordem", verifAutenticacao, verifAdmin, (req, res) => {
  const { solicitacao_id, funcionarios } = req.body;

  db.query(
    " SELECT * FROM solicitacoes WHERE solicitacoes.id = ?",
    [solicitacao_id],
    (erro, result) => {
      if (erro || result.length === 0)
        return res.status(500).json({ erro: "solicitacao nao encontrada!" });

      const { usuario_id, servico_id, descricao } = result[0];

      db.query(
        "INSERT INTO ordens (cliente_id, servico_id, descricao) VALUES (?,?,?)",
        [usuario_id, servico_id, descricao],
        (erro, ordemRes) => {
          if (erro)
            return res
              .status(500)
              .json({ erro: "nao foi possivel a criacao da tabela" });
          const novaOrdemId = ordemRes.insertId;

          if (funcionarios && funcionarios.length > 0) {
            const valores = funcionarios.map((funcId) => [novaOrdemId, funcId]);

            db.query(
              "INSERT INTO ordem_funcionarios (ordem_id, funcionarios_id) VALUES ?",
              [valores],
              (erros) => {
                if (erros)
                  return res.status(500).json({
                    erro: "ordem criada, erro ao adicionar funcionarios!",
                  });

                db.query("DELETE FROM solicitacoes WHERE id = ?", [
                  solicitacao_id,
                ]);
                return res
                  .status(201)
                  .json({ mensagem: "Ordem de servico criada com sucesso!" });
              },
            );
          } else {
            db.query("DELETE FROM solicitacoes WHERE id = ?", [solicitacao_id]);
            return res
              .status(201)
              .json({ mensagem: "ordem criada sem funcionarios vinculados!" });
          }
        },
      );
    },
  );
});

// rota para atualizacao de ordens!

api.patch("/ordem/status", verifAutenticacao, verifAdmin, (req, res) => {
  const { ordem, status } = req.body;

  db.query(
    "UPDATE ordens SET status = ? where id = ? ",
    [status, ordem],
    (erro, result) => {
      if (erro)
        return res.status(500).json({ erro: "erro ao atualizar ordem!" });

      if (result.affectedRows === 0)
        return res.status(404).json({ erro: "ordem nao encontrada!" });

      return res
        .status(200)
        .json({ mensagem: "status atualizado com sucesso!" });
    },
  );
});

// rota para exclusao de ordens!

api.delete("/ordem/:id", verifAutenticacao, verifAdmin, (req, res) => {
  const { id } = req.params;

  db.query("DELETE FROM ordens WHERE id = ?", [id], (erro, result) => {
    if (erro) return res.status(500).json({ erro: "erro ao excluir ordem!" });
    if (result.affectedRows === 0)
      return res.status(404).json({ erro: "ordem nao encontrada!" });
    return res.status(200).json({ mensagem: "ordem excluida com sucesso!" });
  });
});

// rota para consultar ordens abertas!

api.get("/consultOrdens", verifAutenticacao, verifAdmin, (req, res) => {
  const { status } = req.query;

  let query = "SELECT * FROM ordens";

  const params = [];

  if (status) {
    query += " WHERE status = ?";
    params.push(status);
  }

  db.query(query, params, (erro, result) => {
    if (erro)
      return res.status(500).json({ erro: "erro ao consultar ordens!" });

    return res.status(200).json(result);
  });
});

// rota para consultar ordens do cliente logado!

api.get("/minhasordens", verifAutenticacao, verifCliente, (req, res) => {
  const usuarioId = req.session.usuarioLogado.id;

  db.query(
    "SELECT * FROM ordens WHERE cliente_id = ?",
    [usuarioId],
    (erro, result) => {
      if (erro)
        return res.status(500).json({ erro: "erro ao consultar ordens!" });

      return res.status(200).json(result);
    },
  );
});

// rota para consultar ordens do funcionario logado!

api.get(
  "/funcionario/ordens",
  verifAutenticacao,
  verifFuncionarios,
  (req, res) => {
    const funcionarioId = req.session.usuarioLogado.id;

    db.query(
      "SELECT ordens.* FROM ordens JOIN ordem_funcionarios ON ordens.id = ordem_funcionarios.ordem_id WHERE ordem_funcionarios.funcionarios_id = ?",
      [funcionarioId],
      (erro, result) => {
        if (erro)
          return res.status(500).json({ erro: "erro ao consultar ordens!" });

        res.status(200).json(result);
      },
    );
  },
);

// A API tem prioridade e nunca entrega o HTML da aplicação React.
app.use("/api", api);
app.use((req, res, next) => {
  if (req.path.toLowerCase().startsWith("/api")) {
    return res.status(404).json({ erro: "Rota da API não encontrada." });
  }
  next();
});

// Somente os arquivos compilados são públicos; nunca sirva a raiz do backend.
app.use(express.static(frontendDist, { index: false, dotfiles: "deny" }));

// No Express 5, o wildcard precisa de nome e chaves para incluir também "/".
app.get("/{*pagina}", (req, res, next) => {
  const partes = req.params.pagina || [];
  if (!req.accepts("html") || partes.some((parte) => parte.startsWith(".") || path.extname(parte))) {
    return next();
  }

  res.set("Cache-Control", "no-store");
  return res.sendFile(path.join(frontendDist, "index.html"), (erro) => {
    if (erro) next(erro);
  });
});

app.use((_req, res) => {
  return res.status(404).json({ erro: "Recurso não encontrado." });
});

// Erros de JSON, tamanho do corpo e erros internos também não expõem HTML/stack.
app.use((erro, _req, res, next) => {
  if (res.headersSent) return next(erro);
  const status = Number.isInteger(erro.status) && erro.status >= 400 && erro.status < 500
    ? erro.status : 500;
  return res.status(status).json({
    erro: status === 500 ? "Erro interno do servidor." : "Não foi possível processar a requisição.",
  });
});

module.exports = app;

if (require.main === module) {
  const servidor = app.listen(port, "0.0.0.0", () => {
    console.log(`servidor rodando na porta ${servidor.address().port}!`);
  });
}
