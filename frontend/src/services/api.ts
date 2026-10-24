export function requisitarApi(caminho: string, opcoes: RequestInit = {}) {
  return fetch(`/api${caminho}`, {
    ...opcoes,
    credentials: "same-origin",
    cache: "no-store",
  });
}

export class ErroHttp extends Error {
  status: number;

  constructor(status: number) {
    super(`A API respondeu com status ${status}.`);
    this.name = "ErroHttp";
    this.status = status;
  }
}

export function mensagemErroApi(erro: unknown) {
  if (erro instanceof ErroHttp) {
    switch (erro.status) {
      case 400: return "Dados inválidos. Verifique as informações.";
      case 401: return "Sua sessão expirou. Entre novamente.";
      case 403: return "Você não tem permissão para realizar esta operação.";
      case 404: return "O recurso solicitado não foi encontrado ou está indisponível.";
      case 429: return "Muitas tentativas. Tente novamente mais tarde.";
      case 500: return "Não foi possível confirmar a operação. Atualize os dados antes de tentar novamente.";
      default: return "Ocorreu um erro inesperado. Tente novamente.";
    }
  }
  if (erro instanceof TypeError) return "Não foi possível conectar ao servidor. Verifique sua conexão.";
  return "Não foi possível carregar a resposta do servidor. Tente novamente.";
}
