export interface Servico {
  id: number;
  nome: string;
  criado_em: string | null;
}

export interface Solicitacao {
  id: number;
  usuario_id: number;
  servico_id: number;
  descricao: string;
  criado_em: string | null;
}

export interface SolicitacaoAdmin {
  id: number;
  descricao: string;
  criado_em: string | null;
  cliente_nome: string;
  cliente_email: string;
  servico_nome: string;
}

export interface Ordem {
  id: number;
  cliente_id: number;
  servico_id: number;
  descricao: string;
  status: string;
  criado_em: string | null;
  atualizado_em: string | null;
}

export interface Funcionario {
  id: number;
  nome: string;
  email: string;
}
