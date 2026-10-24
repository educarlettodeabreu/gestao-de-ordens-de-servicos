import { replace } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { consultarSessao, fazerLogout } from "../services/Autenticacao.ts";
import { ErroHttp } from "../services/api.ts";

export async function carregarSessao({ request }: LoaderFunctionArgs) {
  try {
    const usuario = await consultarSessao(request.signal);
    const destino = `/dashboard/${usuario.classe}`;
    const caminho = new URL(request.url).pathname.replace(/\/+$/, "");

    if (caminho !== destino) return replace(destino);

    return usuario;
  } catch (erro) {
    if (erro instanceof ErroHttp && erro.status === 401) {
      return replace("/login");
    }

    throw erro;
  }
}

export async function encerrarSessao({ request }: ActionFunctionArgs) {
  let resposta: Response;

  try {
    resposta = await fazerLogout(request.signal);
  } catch {
    return {
      erro: "Não foi possível conectar ao servidor. O encerramento da sessão não foi confirmado.",
    };
  }

  if (resposta.ok) return replace("/login");

  switch (resposta.status) {
    case 401:
      return { erro: "Sessão não encontrada. Verifique seu acesso novamente." };
    case 403:
      return { erro: "O servidor não permitiu encerrar a sessão." };
    case 404:
      return { erro: "O serviço de saída está indisponível. Tente mais tarde." };
    case 429:
      return { erro: "Muitas tentativas. Tente novamente mais tarde." };
    case 500:
      return { erro: "Não foi possível encerrar a sessão. Tente novamente." };
    default:
      return { erro: "Ocorreu um erro inesperado ao encerrar a sessão." };
  }
}
