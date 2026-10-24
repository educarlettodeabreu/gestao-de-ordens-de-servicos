import type { Usuario } from "../types/Autenticacao.ts";
import { ErroHttp, requisitarApi } from "./api.ts";

export async function fzLogin(email: string, senha: string) {
  const resposta = await requisitarApi("/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, senha }),
  });

  return resposta;
}

export async function consultarSessao(signal?: AbortSignal): Promise<Usuario> {
  const resposta = await requisitarApi("/me", { signal });

  if (!resposta.ok) throw new ErroHttp(resposta.status);

  const dados: unknown = await resposta.json();

  if (
    typeof dados !== "object" ||
    dados === null ||
    !("id" in dados) ||
    typeof dados.id !== "number" ||
    !Number.isSafeInteger(dados.id) ||
    dados.id <= 0 ||
    !("nome" in dados) ||
    typeof dados.nome !== "string" ||
    !("email" in dados) ||
    typeof dados.email !== "string" ||
    !("classe" in dados) ||
    (dados.classe !== "admin" &&
      dados.classe !== "funcionario" &&
      dados.classe !== "cliente")
  ) {
    throw new Error("O servidor retornou dados de sessão inválidos.");
  }

  return {
    id: dados.id,
    nome: dados.nome,
    email: dados.email,
    classe: dados.classe,
  };
}

export function fazerLogout(signal?: AbortSignal) {
  return requisitarApi("/logout", { method: "POST", signal });
}
