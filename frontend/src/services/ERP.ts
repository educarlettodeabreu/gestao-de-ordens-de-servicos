import { ErroHttp, requisitarApi } from "./api.ts";
import type { Funcionario, Ordem, Servico, Solicitacao, SolicitacaoAdmin } from "../types/ERP.ts";

function registro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}
const id = (valor: unknown): valor is number => typeof valor === "number" && Number.isSafeInteger(valor) && valor > 0;
const data = (valor: unknown) => typeof valor === "string" || valor === null;

function servico(valor: unknown): valor is Servico {
  return registro(valor) && id(valor.id) && typeof valor.nome === "string" && data(valor.criado_em);
}
function solicitacao(valor: unknown): valor is Solicitacao {
  return registro(valor) && id(valor.id) && id(valor.usuario_id) && id(valor.servico_id)
    && typeof valor.descricao === "string" && data(valor.criado_em);
}
function solicitacaoAdmin(valor: unknown): valor is SolicitacaoAdmin {
  return registro(valor) && id(valor.id) && typeof valor.descricao === "string"
    && data(valor.criado_em) && typeof valor.cliente_nome === "string"
    && typeof valor.cliente_email === "string" && typeof valor.servico_nome === "string";
}
function ordem(valor: unknown): valor is Ordem {
  return registro(valor) && id(valor.id) && id(valor.cliente_id) && id(valor.servico_id)
    && typeof valor.descricao === "string" && typeof valor.status === "string"
    && data(valor.criado_em) && data(valor.atualizado_em);
}
function funcionario(valor: unknown): valor is Funcionario {
  return registro(valor) && id(valor.id) && typeof valor.nome === "string" && typeof valor.email === "string";
}

async function listar<T>(caminho: string, validar: (valor: unknown) => valor is T, signal?: AbortSignal): Promise<T[]> {
  const resposta = await requisitarApi(caminho, { signal });
  if (!resposta.ok) throw new ErroHttp(resposta.status);
  const dados: unknown = await resposta.json();
  if (!Array.isArray(dados) || !dados.every(validar)) throw new Error("Resposta inválida da API.");
  return dados;
}

async function escrever(caminho: string, method: "POST" | "PATCH" | "DELETE", dados?: object) {
  const resposta = await requisitarApi(caminho, {
    method,
    ...(dados === undefined ? {} : {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    }),
  });
  if (!resposta.ok) throw new ErroHttp(resposta.status);
  return resposta;
}

export const listarServicos = (signal?: AbortSignal) => listar("/servicos", servico, signal);
export const listarMinhasSolicitacoes = (signal?: AbortSignal) => listar("/minhassolicitacoes", solicitacao, signal);
export const listarMinhasOrdens = (signal?: AbortSignal) => listar("/minhasordens", ordem, signal);
export const listarOrdensFuncionario = (signal?: AbortSignal) => listar("/funcionario/ordens", ordem, signal);
export const listarSolicitacoes = (signal?: AbortSignal) => listar("/consulsolicitacoes", solicitacaoAdmin, signal);
export const listarOrdens = (signal?: AbortSignal) => listar("/consultOrdens", ordem, signal);
// Endpoint complementar incluído no patch do backend; 404 é exibido como indisponibilidade.
export const listarFuncionarios = (signal?: AbortSignal) => listar("/admin/funcionarios", funcionario, signal);

export const criarSolicitacao = (servicoid: number, descricao: string) => escrever("/solicitacoes", "POST", { servicoid, descricao });
export const criarServico = (nome: string) => escrever("/servicos", "POST", { nome });
export const excluirServico = (nome: string) => escrever("/servicos/delet", "DELETE", { nome });
export const criarOrdem = (solicitacao_id: number, funcionarios: number[]) => escrever("/ordem", "POST", { solicitacao_id, funcionarios });
export const atualizarStatus = (ordem: number, status: string) => escrever("/ordem/status", "PATCH", { ordem, status });
export const excluirOrdem = (id: number) => escrever(`/ordem/${id}`, "DELETE");
