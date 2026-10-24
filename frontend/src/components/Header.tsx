import { useFetcher } from "react-router";
import type { encerrarSessao } from "../routes/autenticacao.ts";
import { nomesClasses } from "../types/Autenticacao.ts";
import type { Usuario } from "../types/Autenticacao.ts";
import Icone from "./Icone.tsx";

function Header({ usuario, menuAberto, alternarMenu }: {
  usuario: Usuario;
  menuAberto: boolean;
  alternarMenu: () => void;
}) {
  const saida = useFetcher<typeof encerrarSessao>();
  const saindo = saida.state !== "idle";

  return (
    <header className="erp-header">
      <button className="erp-button erp-menu-toggle" type="button" onClick={alternarMenu}
        aria-controls="menu-painel" aria-expanded={menuAberto} aria-label="Alternar menu">
        <Icone nome="menu" />Menu
      </button>
      <div className="erp-header-user">
        <span className="erp-avatar" aria-hidden="true">{usuario.nome.charAt(0).toUpperCase()}</span>
        <div><strong>{usuario.nome}</strong><span>{usuario.email}</span></div>
        <span className="erp-role">{nomesClasses[usuario.classe]}</span>
      </div>
      <saida.Form method="post" action="/dashboard">
        <button className="erp-button" type="submit" disabled={saindo}>
          <Icone nome="sair" />{saindo ? "Saindo..." : "Sair"}
        </button>
      </saida.Form>
      {!saindo && saida.data?.erro && (
        <p className="erp-header-error login-message login-message--error" role="alert">{saida.data.erro}</p>
      )}
    </header>
  );
}

export default Header;
