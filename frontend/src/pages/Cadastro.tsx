import { useState } from "react";
import { Link } from "react-router";
import { criarConta } from "../services/Cadastro.ts";

function Cadastro() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();

    if (carregando) return;

    setMensagem("");

    if (
      nome.length < 3 ||
      nome.length > 100 ||
      !email ||
      email.length > 150 ||
      senha.length < 8 ||
      senha.length > 72
    ) {
      setMensagem("Dados inválidos. Verifique as informações.");
      return;
    }

    if (senha !== confirmarSenha) {
      setMensagem("As senhas não coincidem.");
      return;
    }

    try {
      setCarregando(true);

      const resposta = await criarConta(nome, email, senha);

      switch (resposta.status) {
        case 200:
          setMensagem("Conta criada com sucesso!");
          break;

        case 400:
          setMensagem("Dados inválidos. Verifique as informações.");
          break;

        case 429:
          setMensagem("Muitas tentativas. Tente novamente mais tarde.");
          break;

        case 500:
          setMensagem("Não foi possível criar sua conta. Tente novamente.");
          break;

        default:
          setMensagem("Ocorreu um erro inesperado.");
      }
    } catch (erro) {
      setMensagem("Não foi possível conectar ao servidor. Tente novamente.");
      console.error("Erro na requisição de cadastro:", erro);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-layout">
        <header className="login-brand">
          <span className="login-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="4" y="3" width="16" height="18" rx="3" />
              <path d="m8 9 1.5 1.5L12 8m2 2h2m-8 6h8" />
            </svg>
          </span>
          <div>
            <p className="login-brand-name">Gestão de Ordens</p>
            <p className="login-brand-caption">Sistema de gestão de serviços</p>
          </div>
        </header>

        <section className="login-card" aria-labelledby="cadastro-title">
          <header className="login-heading">
            <h1 id="cadastro-title">Crie sua conta</h1>
            <p>Preencha seus dados para começar.</p>
          </header>

          <form
            className="login-form"
            aria-labelledby="cadastro-title"
            onSubmit={submit}
          >
            <div className="login-field">
              <label htmlFor="cadastro-nome">Nome completo</label>
              <div className="login-input-wrapper">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2" />
                </svg>
                <input
                  type="text"
                  id="cadastro-nome"
                  name="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  minLength={3}
                  maxLength={100}
                  autoComplete="name"
                  placeholder="Digite seu nome completo"
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="cadastro-email">E-mail</label>
              <div className="login-input-wrapper">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="3" />
                  <path d="m4 7 8 6 8-6" />
                </svg>
                <input
                  type="email"
                  id="cadastro-email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={150}
                  autoComplete="username"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="cadastro-senha">Senha</label>
              <div className="login-input-wrapper">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="4" y="10" width="16" height="11" rx="3" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
                </svg>
                <input
                  type="password"
                  id="cadastro-senha"
                  name="senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  placeholder="Crie uma senha"
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="cadastro-confirmar-senha">Confirmar senha</label>
              <div className="login-input-wrapper">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="4" y="10" width="16" height="11" rx="3" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
                </svg>
                <input
                  type="password"
                  id="cadastro-confirmar-senha"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  required
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  placeholder="Digite a senha novamente"
                />
              </div>
            </div>

            <button
              className="login-submit"
              type="submit"
              disabled={carregando}
            >
              {carregando ? "Criando conta..." : "Criar conta"}
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </button>

            <div
              className="login-feedback"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {mensagem && (
                <p
                  className={`login-message ${
                    mensagem === "Conta criada com sucesso!"
                      ? "login-message--success"
                      : "login-message--error"
                  }`}
                >
                  <span className="login-message-icon" aria-hidden="true">
                    {mensagem === "Conta criada com sucesso!" ? "✓" : "!"}
                  </span>
                  {mensagem}
                </p>
              )}
            </div>
          </form>

          <p className="cadastro-login">
            Já possui uma conta? <Link to="/">Entrar</Link>
          </p>
        </section>

        <p className="login-footer">Organização e controle em um só lugar.</p>
      </div>
    </main>
  );
}

export default Cadastro;
