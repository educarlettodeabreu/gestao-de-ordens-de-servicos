import { Outlet, useNavigation, useRevalidator } from "react-router";
import Carregando from "./Carregando.tsx";

function Navegacao() {
  const navegacao = useNavigation();
  const verificacao = useRevalidator();

  if (navegacao.state === "loading" || verificacao.state === "loading") {
    return <Carregando />;
  }

  return <Outlet />;
}

export default Navegacao;
