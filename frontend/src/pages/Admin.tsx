import { useState } from "react";
import { useNavigate } from "react-router";
import { useConsulta } from "../hooks/useConsulta.ts";
import { atualizarStatus, criarOrdem, criarServico, excluirOrdem, excluirServico, listarFuncionarios, listarOrdens, listarServicos, listarSolicitacoes } from "../services/ERP.ts";
import { ErroHttp, mensagemErroApi } from "../services/api.ts";
import type { Ordem, Servico, SolicitacaoAdmin } from "../types/ERP.ts";
import { contarStatus, formatarData } from "../utils/formatacao.ts";
import Dialogo from "../components/Dialogo.tsx";
import EstadoConsulta from "../components/EstadoConsulta.tsx";
import Indicadores from "../components/Indicadores.tsx";
import ListaOrdens from "../components/ListaOrdens.tsx";

type Modal =
  | { tipo: "servico"; item: Servico }
  | { tipo: "ordem"; item: Ordem }
  | { tipo: "status"; item: Ordem }
  | { tipo: "criar"; item: SolicitacaoAdmin };

function Admin() {
  const servicos = useConsulta(listarServicos);
  const solicitacoes = useConsulta(listarSolicitacoes);
  const ordens = useConsulta(listarOrdens);
  const funcionarios = useConsulta(listarFuncionarios);
  const [nomeServico, setNomeServico] = useState("");
  const [modal, setModal] = useState<Modal | null>(null);
  const [novoStatus, setNovoStatus] = useState("");
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ texto: string; sucesso: boolean } | null>(null);
  const navegar = useNavigate();

  function abrir(proximo: Modal) {
    setErroModal(null);
    setSelecionados([]);
    if (proximo.tipo === "status") setNovoStatus(proximo.item.status);
    setModal(proximo);
  }

  async function executar(acao: () => Promise<unknown>, mensagem: string, atualizar: () => void) {
    if (ocupado) return;
    setOcupado(true);
    setFeedback(null);
    setErroModal(null);
    try {
      await acao();
      setFeedback({ texto: mensagem, sucesso: true });
      setModal(null);
      atualizar();
    } catch (erro) {
      if (erro instanceof ErroHttp && erro.status === 401) {
        void navegar("/login", { replace: true });
      } else if (modal) setErroModal(mensagemErroApi(erro));
      else setFeedback({ texto: mensagemErroApi(erro), sucesso: false });
    } finally { setOcupado(false); }
  }

  function cadastrarServico(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const nome = nomeServico.trim();
    if (!nome) {
      setFeedback({ texto: "Informe o nome do serviço.", sucesso: false });
      return;
    }
    void executar(() => criarServico(nome), "Serviço cadastrado com sucesso!", () => {
      setNomeServico(""); servicos.recarregar();
    });
  }

  function enviarModal(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!modal || ocupado) return;
    switch (modal.tipo) {
      case "servico":
        void executar(() => excluirServico(modal.item.nome), "Serviço excluído com sucesso!", servicos.recarregar);
        break;
      case "ordem":
        void executar(() => excluirOrdem(modal.item.id), "Ordem excluída com sucesso!", ordens.recarregar);
        break;
      case "status": {
        const status = novoStatus.trim();
        if (!status || status.length > 30) { setErroModal("Informe um status de até 30 caracteres."); return; }
        void executar(() => atualizarStatus(modal.item.id, status), "Status atualizado com sucesso!", ordens.recarregar);
        break;
      }
      case "criar":
        if (selecionados.some((id) => !funcionarios.dados?.some((item) => item.id === id))) {
          setErroModal("A lista de funcionários mudou. Revise a seleção antes de continuar.");
          return;
        }
        void executar(() => criarOrdem(modal.item.id, selecionados), "Ordem criada com sucesso!", () => {
          solicitacoes.recarregar(); ordens.recarregar();
        });
        break;
    }
  }

  const tituloModal = modal?.tipo === "criar" ? "Criar ordem de serviço"
    : modal?.tipo === "status" ? "Atualizar status" : modal?.tipo === "servico" ? "Excluir serviço" : "Excluir ordem";

  return (
    <>
      <section id="visao-geral" className="erp-section">
        <header className="erp-page-heading"><div><p className="erp-eyebrow">Área administrativa</p>
          <h1>Visão geral da operação</h1><p>Gerencie serviços e acompanhe os atendimentos.</p></div>
          <button className="erp-button" type="button" disabled={ocupado} onClick={() => { servicos.recarregar(); solicitacoes.recarregar(); ordens.recarregar(); funcionarios.recarregar(); }}>Atualizar dados</button>
        </header>
        <Indicadores itens={[
          { titulo: "Serviços cadastrados", valor: servicos.dados?.length },
          { titulo: "Solicitações recebidas", valor: solicitacoes.dados?.length },
          { titulo: "Ordens de serviço", valor: ordens.dados?.length },
          { titulo: "Ordens abertas", valor: ordens.dados?.filter((item) => item.status === "aberta").length },
        ]} />
        {feedback && <p className={`erp-feedback login-message login-message--${feedback.sucesso ? "success" : "error"}`} role="status">{feedback.texto}</p>}
      </section>

      <section id="servicos" className="erp-card erp-section" aria-labelledby="servicos-title">
        <header className="erp-card-heading"><div><h2 id="servicos-title">Gerenciar serviços</h2><p>Cadastre e organize os serviços oferecidos.</p></div></header>
        <div className="erp-columns">
          <div>
            <EstadoConsulta status={servicos.status} erro={servicos.erro} repetir={servicos.recarregar} />
            {servicos.dados && (servicos.dados.length === 0 ? <p className="erp-empty">Nenhum serviço cadastrado.</p> : <ul className="erp-list">
              {servicos.dados.map((item) => <li key={item.id} className="erp-list-item"><div><strong>{item.nome}</strong><small>Serviço #{item.id}</small></div>
                <button className="erp-button erp-button--danger" type="button" disabled={ocupado} aria-label={`Excluir serviço ${item.nome}`} onClick={() => abrir({ tipo: "servico", item })}>Excluir</button></li>)}
            </ul>)}
          </div>
          <form onSubmit={cadastrarServico}>
            <fieldset className="erp-form" disabled={ocupado}>
              <label className="erp-field">Nome do serviço<input value={nomeServico} onChange={(e) => setNomeServico(e.target.value)} maxLength={150} required placeholder="Ex.: Manutenção" /></label>
              <button className="erp-button erp-button--primary" type="submit">{ocupado && !modal ? "Cadastrando..." : "Cadastrar serviço"}</button>
            </fieldset>
          </form>
        </div>
      </section>

      <section id="solicitacoes" className="erp-card erp-section" aria-labelledby="solicitacoes-title">
        <header className="erp-card-heading"><div><h2 id="solicitacoes-title">Solicitações recebidas</h2><p>Transforme solicitações em ordens de serviço.</p></div></header>
        <EstadoConsulta status={solicitacoes.status} erro={solicitacoes.erro} repetir={solicitacoes.recarregar} />
        {solicitacoes.dados && (solicitacoes.dados.length === 0 ? <p className="erp-empty">Nenhuma solicitação disponível.</p> : <div className="erp-table-scroll" tabIndex={0} aria-label="Tabela de solicitações, com rolagem horizontal">
          <p className="erp-table-hint">Deslize a tabela para ver todas as colunas.</p>
          <table className="erp-table"><thead><tr><th scope="col">Solicitação / cliente</th><th scope="col">Serviço / descrição</th><th scope="col">Criada em</th><th scope="col">Ação</th></tr></thead>
            <tbody>{solicitacoes.dados.map((item) => <tr key={item.id}>
              <td><strong>#{item.id} · {item.cliente_nome}</strong><p className="erp-muted">{item.cliente_email}</p></td>
              <td><strong>{item.servico_nome}</strong><p className="erp-description">{item.descricao}</p></td>
              <td>{formatarData(item.criado_em)}</td>
              <td><button className="erp-button" type="button" disabled={ocupado} onClick={() => abrir({ tipo: "criar", item })} aria-label={`Criar ordem da solicitação ${item.id}`}>Criar ordem</button></td>
            </tr>)}</tbody>
          </table>
        </div>)}
      </section>

      <section id="ordens" className="erp-card erp-section" aria-labelledby="ordens-title">
        <header className="erp-card-heading"><div><h2 id="ordens-title">Ordens de serviço</h2><p>Consulte, atualize o status e gerencie as ordens.</p></div></header>
        <EstadoConsulta status={ordens.status} erro={ordens.erro} repetir={ordens.recarregar} />
        {ordens.dados && <ListaOrdens ordens={ordens.dados} acoes={(item) => <div className="erp-actions">
          <button className="erp-button" type="button" disabled={ocupado} onClick={() => abrir({ tipo: "status", item })} aria-label={`Alterar status da ordem ${item.id}`}>Alterar status</button>
          <button className="erp-button erp-button--danger" type="button" disabled={ocupado} onClick={() => abrir({ tipo: "ordem", item })} aria-label={`Excluir ordem ${item.id}`}>Excluir</button>
        </div>} />}
      </section>

      {modal && <Dialogo titulo={tituloModal} ocupado={ocupado} fechar={() => setModal(null)}>
        <form onSubmit={enviarModal}>
          {modal.tipo === "servico" && <p>Excluir o serviço <strong>{modal.item.nome}</strong>? Essa ação não pode ser desfeita. Serviços vinculados a atendimentos podem ter a exclusão recusada.</p>}
          {modal.tipo === "ordem" && <p>Excluir a ordem <strong>#{modal.item.id}</strong>? Essa ação não pode ser desfeita.</p>}
          {modal.tipo === "status" && <label className="erp-field">Novo status da ordem #{modal.item.id}
            <input value={novoStatus} onChange={(e) => setNovoStatus(e.target.value)} required maxLength={30} list="status-disponiveis" disabled={ocupado} />
            <datalist id="status-disponiveis">{Array.from(new Set(["aberta", ...contarStatus(ordens.dados ?? []).map((item) => item.status)])).map((status) => <option key={status} value={status} />)}</datalist>
            <small>Informe o status utilizado na sua operação, com até 30 caracteres.</small>
          </label>}
          {modal.tipo === "criar" && <>
            <p>Solicitação <strong>#{modal.item.id}</strong> de {modal.item.cliente_nome}<br />Serviço: {modal.item.servico_nome}</p>
            <p className="erp-description">{modal.item.descricao}</p>
            <h3>Funcionários responsáveis</h3><p>A atribuição é opcional. Você pode criar a ordem sem funcionários.</p>
            <EstadoConsulta status={funcionarios.status} erro={funcionarios.erro} repetir={funcionarios.recarregar} />
            {funcionarios.status === "erro" && <p>A seleção está indisponível. A criação sem funcionários continua disponível.</p>}
            {funcionarios.dados && (funcionarios.dados.length === 0 ? <p>Nenhum funcionário disponível para atribuição.</p> : <div className="erp-checklist">
              {funcionarios.dados.map((item) => <label key={item.id}><input type="checkbox" disabled={ocupado} checked={selecionados.includes(item.id)}
                onChange={(e) => setSelecionados((atuais) => e.target.checked ? [...atuais, item.id] : atuais.filter((id) => id !== item.id))} />
                <span>{item.nome}<br /><small>{item.email}</small></span></label>)}
            </div>)}
          </>}
          {erroModal && <p className="login-message login-message--error erp-feedback" role="alert">{erroModal}</p>}
          <div className="erp-actions">
            <button className="erp-button" type="button" disabled={ocupado} onClick={() => setModal(null)}>Cancelar</button>
            <button className={`erp-button ${modal.tipo === "servico" || modal.tipo === "ordem" ? "erp-button--danger" : "erp-button--primary"}`} type="submit" disabled={ocupado}>
              {ocupado ? "Processando..." : modal.tipo === "criar" ? "Confirmar criação" : modal.tipo === "status" ? "Salvar status" : "Confirmar exclusão"}
            </button>
          </div>
        </form>
      </Dialogo>}
    </>
  );
}

export default Admin;
