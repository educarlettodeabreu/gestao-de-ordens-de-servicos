import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { fzLogin } from "../services/Autenticacao.ts";
function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (carregando) return;

    try {
      setCarregando(true);
      setMensagem("");

      const resposta = await fzLogin(email, senha);

      switch (resposta.status) {
        case 200:
          setSenha("");
          await navigate("/dashboard", { replace: true });
          break;

        case 401:
          setMensagem("E-mail ou senha incorretos!");
          break;

        case 400:
          setMensagem("Dados inválidos!");
          break;

        case 403:
          setMensagem("O servidor não permitiu o acesso.");
          break;

        case 404:
          setMensagem("O serviço de autenticação está indisponível.");
          break;

        case 429:
          setMensagem("Muitas tentativas. Tente novamente mais tarde.");
          break;

        case 500:
          setMensagem("Erro interno do servidor!");
          break;

        default:
          setMensagem("Ocorreu um erro inesperado!");
      }
    } catch (erro) {
      setMensagem("Não foi possível conectar ao servidor. Tente novamente.");
      console.error("erro na requisicao:", erro);
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

        <section className="login-card" aria-labelledby="login-title">
          <header className="login-heading">
            <h1 id="login-title">Acesse sua conta</h1>
            <p>Entre com suas credenciais para continuar.</p>
          </header>

          <form className="login-form" onSubmit={submit}>
            <div className="login-field">
              <label htmlFor="eml">E-mail</label>
              <div className="login-input-wrapper">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="3" />
                  <path d="m4 7 8 6 8-6" />
                </svg>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  id="eml"
                  autoComplete="username"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="pass">Senha</label>
              <div className="login-input-wrapper">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="4" y="10" width="16" height="11" rx="3" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
                </svg>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  id="pass"
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                />
              </div>
            </div>

            <button
              className="login-submit"
              type="submit"
              disabled={carregando}
            >
              {carregando ? "Entrando..." : "Entrar"}
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </button>

            <Link to="/cadastro">Criar uma conta</Link>

            <div
              className="login-feedback"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {mensagem && (
                <p className="login-message login-message--error">
                  <span className="login-message-icon" aria-hidden="true">
                    !
                  </span>
                  {mensagem}
                </p>
              )}
            </div>
          </form>
        </section>

        <p className="login-footer">Organização e controle em um só lugar.</p>
      </div>
    </main>
  );
}

export default Login;
