import type { RouteObject } from "react-router";
import Carregando from "../components/Carregando.tsx";
import ErroSessao from "../components/ErroSessao.tsx";
import Navegacao from "../components/Navegacao.tsx";
import Cadastro from "../pages/Cadastro.tsx";
import Login from "../pages/Login.tsx";
import DashboardLayout from "../layouts/DashboardLayout.tsx";
import Cliente from "../pages/Cliente.tsx";
import Funcionario from "../pages/Funcionario.tsx";
import Admin from "../pages/Admin.tsx";
import { carregarSessao, encerrarSessao } from "./autenticacao.ts";

export const rotas: RouteObject[] = [
  {
    Component: Navegacao,
    HydrateFallback: Carregando,
    children: [
      { path: "/", Component: Login },
      { path: "/login", Component: Login },
      { path: "/cadastro", Component: Cadastro },
      {
        id: "sessao",
        path: "/dashboard",
        Component: DashboardLayout,
        loader: carregarSessao,
        action: encerrarSessao,
        shouldRevalidate: () => true,
        ErrorBoundary: ErroSessao,
        children: [
          { index: true, Component: Carregando },
          { path: "cliente", Component: Cliente },
          { path: "funcionario", Component: Funcionario },
          { path: "admin", Component: Admin },
        ],
      },
    ],
  },
];
