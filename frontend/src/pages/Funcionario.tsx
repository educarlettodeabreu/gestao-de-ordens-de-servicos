import { listarOrdensFuncionario } from "../services/ERP.ts";
import { useConsulta } from "../hooks/useConsulta.ts";
import EstadoConsulta from "../components/EstadoConsulta.tsx";
import Indicadores from "../components/Indicadores.tsx";
import ListaOrdens from "../components/ListaOrdens.tsx";
import { contarStatus } from "../utils/formatacao.ts";

function Funcionario() {
  const ordens = useConsulta(listarOrdensFuncionario);

  return (
    <>
      <section id="visao-geral" className="erp-section">
        <header className="erp-page-heading"><div><p className="erp-eyebrow">Área do funcionário</p>
          <h1>Suas ordens de serviço</h1><p>Consulte os atendimentos atribuídos a você.</p></div>
          <button className="erp-button" type="button" onClick={ordens.recarregar}>Atualizar dados</button>
        </header>
        <Indicadores itens={[
          { titulo: "Ordens atribuídas", valor: ordens.dados?.length },
          { titulo: "Ordens abertas", valor: ordens.dados?.filter((item) => item.status === "aberta").length },
          { titulo: "Status presentes", valor: ordens.dados ? contarStatus(ordens.dados).length : undefined },
        ]} />
      </section>
      <section id="ordens" className="erp-card erp-section" aria-labelledby="ordens-title">
        <header className="erp-card-heading"><div><h2 id="ordens-title">Ordens atribuídas</h2>
          <p>Descrição, status e datas dos seus atendimentos.</p></div></header>
        <EstadoConsulta status={ordens.status} erro={ordens.erro} repetir={ordens.recarregar} />
        {ordens.dados && <ListaOrdens ordens={ordens.dados} />}
      </section>
    </>
  );
}

export default Funcionario;
