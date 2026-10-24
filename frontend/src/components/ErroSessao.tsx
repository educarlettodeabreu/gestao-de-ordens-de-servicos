import { useRevalidator, useRouteError } from "react-router";
import { ErroHttp } from "../services/api.ts";

function ErroSessao() {
  const erro = useRouteError();
  const verificacao = useRevalidator();
  let mensagem = "Não foi possível verificar sua sessão. Tente novamente.";

  if (erro instanceof TypeError) {
    mensagem = "Não foi possível conectar ao servidor. Verifique sua conexão.";
  } else if (erro instanceof ErroHttp) {
    switch (erro.status) {
      case 403:
        mensagem = "Você não tem permissão para acessar esta área.";
        break;
      case 404:
        mensagem = "A verificação de sessão está indisponível. Tente mais tarde.";
        break;
      case 429:
        mensagem = "Muitas tentativas. Tente novamente mais tarde.";
        break;
      case 500:
        mensagem = "O servidor não conseguiu verificar sua sessão. Tente novamente.";
        break;
    }
  }

  return (
    <main className="login-page">
      <div className="login-layout">
        <section className="login-card" aria-labelledby="sessao-erro-title">
          <header className="login-heading">
            <h1 id="sessao-erro-title">Não foi possível verificar o acesso</h1>
          </header>
          <p className="login-message login-message--error" role="alert">
            {mensagem}
          </p>
          <button
            className="login-submit"
            type="button"
            disabled={verificacao.state !== "idle"}
            onClick={() => void verificacao.revalidate()}
          >
            Tentar novamente
          </button>
        </section>
      </div>
    </main>
  );
}

export default ErroSessao;
