import type { ClasseUsuario } from "../types/Autenticacao.ts";
import Icone from "./Icone.tsx";

function Sidebar({ classe, aberta, fechar }: {
  classe: ClasseUsuario;
  aberta: boolean;
  fechar: () => void;
}) {
  return (
    <aside id="menu-painel" className={`erp-sidebar ${aberta ? "erp-sidebar--aberta" : ""}`}>
      <a className="erp-brand" href="#visao-geral" onClick={fechar}>
        <span className="erp-brand-mark"><Icone nome="ordens" /></span>
        <span>Gestão de Ordens<small>Sistema de gestão de serviços</small></span>
      </a>
      <p className="erp-nav-label">ÁREA DE TRABALHO</p>
      <nav aria-label="Menu do painel">
        <a href="#visao-geral" onClick={fechar}><Icone nome="inicio" />Visão geral</a>
        {classe !== "funcionario" && (
          <a href="#servicos" onClick={fechar}><Icone nome="servicos" />Serviços</a>
        )}
        {classe !== "funcionario" && (
          <a href="#solicitacoes" onClick={fechar}><Icone nome="solicitacoes" />Solicitações</a>
        )}
        <a href="#ordens" onClick={fechar}><Icone nome="ordens" />Ordens de serviço</a>
      </nav>
      <p className="erp-sidebar-footer">Organização e controle<br />em um só lugar.</p>
    </aside>
  );
}

export default Sidebar;
