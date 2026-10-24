import { useState } from "react";
import { useNavigate, useRouteLoaderData } from "react-router";
import type { Usuario } from "../types/Autenticacao.ts";
import { criarSolicitacao, listarMinhasOrdens, listarMinhasSolicitacoes, listarServicos } from "../services/ERP.ts";
import { ErroHttp, mensagemErroApi } from "../services/api.ts";
import { useConsulta } from "../hooks/useConsulta.ts";
import { formatarData } from "../utils/formatacao.ts";
import EstadoConsulta from "../components/EstadoConsulta.tsx";
import Indicadores from "../components/Indicadores.tsx";
import ListaOrdens from "../components/ListaOrdens.tsx";

function Cliente() {
  const usuario = useRouteLoaderData<Usuario>("sessao");
  const servicos = useConsulta(listarServicos);
  const solicitacoes = useConsulta(listarMinhasSolicitacoes);
  const ordens = useConsulta(listarMinhasOrdens);
  const [servico, setServico] = useState("");
  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [feedback, setFeedback] = useState<{ texto: string; sucesso: boolean } | null>(null);
  const navegar = useNavigate();

  async function submit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviando) return;
    setFeedback(null);
    if (!servicos.dados?.some((item) => item.id === Number(servico)) || !descricao.trim()) {
      setFeedback({ texto: "Selecione um serviço e descreva o problema.", sucesso: false });
      return;
    }
    try {
      setEnviando(true);
      await criarSolicitacao(Number(servico), descricao.trim());
      setFeedback({ texto: "Solicitação enviada com sucesso!", sucesso: true });
      setDescricao("");
      setServico("");
      solicitacoes.recarregar();
    } catch (erro) {
      if (erro instanceof ErroHttp && erro.status === 401) {
        void navegar("/login", { replace: true });
      } else setFeedback({ texto: mensagemErroApi(erro), sucesso: false });
    } finally { setEnviando(false); }
  }

  return (
    <>
      <section id="visao-geral" className="erp-section">
        <header className="erp-page-heading"><div><p className="erp-eyebrow">Área do cliente</p>
          <h1>Bem-vindo, {usuario?.nome}.</h1><p>Acompanhe suas solicitações e ordens de serviço.</p></div>
          <button className="erp-button" type="button" onClick={() => { servicos.recarregar(); solicitacoes.recarregar(); ordens.recarregar(); }}>Atualizar dados</button>
        </header>
        <Indicadores itens={[
          { titulo: "Serviços disponíveis", valor: servicos.dados?.length },
          { titulo: "Minhas solicitações", valor: solicitacoes.dados?.length },
          { titulo: "Minhas ordens", valor: ordens.dados?.length },
          { titulo: "Ordens abertas", valor: ordens.dados?.filter((item) => item.status === "aberta").length },
        ]} />
      </section>
      <div className="erp-columns erp-section">
        <section id="servicos" className="erp-card" aria-labelledby="servicos-title">
          <header className="erp-card-heading"><div><h2 id="servicos-title">Serviços disponíveis</h2><p>Encontre o atendimento de que você precisa.</p></div></header>
          <EstadoConsulta status={servicos.status} erro={servicos.erro} repetir={servicos.recarregar} />
          {servicos.dados && (servicos.dados.length === 0 ? <p className="erp-empty">Nenhum serviço disponível no momento.</p> : (
            <ul className="erp-list">{servicos.dados.map((item) => <li key={item.id}><strong>{item.nome}</strong><small>Serviço #{item.id}</small></li>)}</ul>
          ))}
        </section>
        <section className="erp-card" aria-labelledby="solicitar-title">
          <header className="erp-card-heading"><div><h2 id="solicitar-title">Solicitar serviço</h2><p>Conte o que precisa ser resolvido.</p></div></header>
          <form onSubmit={submit}>
            <fieldset className="erp-form" disabled={enviando}>
              <label className="erp-field">Serviço<select value={servico} onChange={(e) => setServico(e.target.value)} required disabled={!servicos.dados?.length}>
                <option value="">Selecione um serviço</option>{servicos.dados?.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select></label>
              <label className="erp-field">Descrição do problema<textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} required maxLength={5000} placeholder="Descreva sua necessidade" /></label>
              <button className="erp-button erp-button--primary" type="submit" disabled={!servicos.dados?.length}>{enviando ? "Enviando..." : "Enviar solicitação"}</button>
            </fieldset>
          </form>
          {feedback && <p className={`erp-feedback login-message login-message--${feedback.sucesso ? "success" : "error"}`} role="status">{feedback.texto}</p>}
        </section>
      </div>
      <section id="solicitacoes" className="erp-card erp-section" aria-labelledby="solicitacoes-title">
        <header className="erp-card-heading"><div><h2 id="solicitacoes-title">Minhas solicitações</h2><p>Solicitações que você enviou para atendimento.</p></div></header>
        <EstadoConsulta status={solicitacoes.status} erro={solicitacoes.erro} repetir={solicitacoes.recarregar} />
        {solicitacoes.dados && (solicitacoes.dados.length === 0 ? <p className="erp-empty">Você ainda não possui solicitações.</p> : <ul className="erp-list">
          {solicitacoes.dados.map((item) => <li key={item.id}><strong>Solicitação #{item.id} · {servicos.dados?.find((s) => s.id === item.servico_id)?.nome ?? `Serviço #${item.servico_id}`}</strong>
            <p className="erp-description">{item.descricao}</p><small>{formatarData(item.criado_em)}</small></li>)}
        </ul>)}
      </section>
      <section id="ordens" className="erp-card erp-section" aria-labelledby="ordens-title">
        <header className="erp-card-heading"><div><h2 id="ordens-title">Minhas ordens</h2><p>Acompanhe o status dos seus atendimentos.</p></div></header>
        <EstadoConsulta status={ordens.status} erro={ordens.erro} repetir={ordens.recarregar} />
        {ordens.dados && <ListaOrdens ordens={ordens.dados} />}
      </section>
    </>
  );
}

export default Cliente;
