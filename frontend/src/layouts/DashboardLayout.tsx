import { useState } from "react";
import { Outlet, useRouteLoaderData } from "react-router";
import Header from "../components/Header.tsx";
import Sidebar from "../components/Sidebar.tsx";
import type { Usuario } from "../types/Autenticacao.ts";

function DashboardLayout() {
  const usuario = useRouteLoaderData<Usuario>("sessao");
  const [menuAberto, setMenuAberto] = useState(false);

  if (!usuario) return null;

  return (
    <div className="erp-shell">
      <a className="erp-skip-link" href="#conteudo">Pular para o conteúdo</a>
      <Sidebar classe={usuario.classe} aberta={menuAberto} fechar={() => setMenuAberto(false)} />
      <div className="erp-workspace">
        <Header usuario={usuario} menuAberto={menuAberto} alternarMenu={() => setMenuAberto(!menuAberto)} />
        <main id="conteudo" className="erp-content" tabIndex={-1}><Outlet /></main>
        <footer className="erp-footer">Gestão de Ordens · Sistema de gestão de serviços</footer>
      </div>
    </div>
  );
}

export default DashboardLayout;
