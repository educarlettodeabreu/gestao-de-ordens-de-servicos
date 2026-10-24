import { useState } from "react";
import type { ReactNode } from "react";
import type { Ordem } from "../types/ERP.ts";
import { contarStatus, formatarData } from "../utils/formatacao.ts";

function ListaOrdens({ ordens, acoes }: { ordens: Ordem[]; acoes?: (ordem: Ordem) => ReactNode }) {
  const [status, setStatus] = useState("");
  const contagens = contarStatus(ordens);
  const filtradas = ordens.filter((ordem) => !status || ordem.status === status);

  return (
    <>
      <div className="erp-toolbar">
        <label className="erp-field">Filtrar por status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {contagens.map((item) => <option key={item.status} value={item.status}>{item.status}</option>)}
          </select>
        </label>
        <p className="erp-muted" role="status">{filtradas.length} de {ordens.length} ordens</p>
      </div>
      <div className="erp-status-counts">
        {contagens.map((item) => <span className="erp-status" key={item.status}>{item.status}: {item.quantidade}</span>)}
      </div>
      {filtradas.length > 0 && <p className="erp-table-hint">Deslize a tabela para ver todas as colunas.</p>}
      {filtradas.length === 0 ? <p className="erp-empty">Nenhuma ordem encontrada{status ? " com este status" : ""}.</p> : (
        <div className="erp-table-scroll" tabIndex={0} aria-label="Tabela de ordens, com rolagem horizontal">
          <table className="erp-table">
            <thead><tr><th scope="col">Ordem / serviço</th><th scope="col">Descrição</th><th scope="col">Status</th><th scope="col">Criada em</th>{acoes && <th scope="col">Ações</th>}</tr></thead>
            <tbody>{filtradas.map((ordem) => <tr key={ordem.id}>
              <td><strong>#{ordem.id}</strong><p className="erp-muted">Serviço #{ordem.servico_id}</p></td>
              <td>
                <p className="erp-description">{ordem.descricao}</p>
                <details className="erp-details"><summary>Ver detalhes da ordem #{ordem.id}</summary>
                  <dl><dt>Cliente</dt><dd>#{ordem.cliente_id}</dd><dt>Atualizada em</dt><dd>{formatarData(ordem.atualizado_em)}</dd></dl>
                </details>
              </td>
              <td><span className="erp-status">{ordem.status}</span></td>
              <td>{formatarData(ordem.criado_em)}</td>
              {acoes && <td>{acoes(ordem)}</td>}
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default ListaOrdens;
