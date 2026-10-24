import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ErroHttp, mensagemErroApi } from "../services/api.ts";

type Estado<T> =
  | { status: "carregando"; dados: null; erro: null }
  | { status: "sucesso"; dados: T; erro: null }
  | { status: "erro"; dados: null; erro: string };

// Compartilha cancelamento, repetição e expiração entre as consultas dos três painéis.
export function useConsulta<T>(consultar: (signal: AbortSignal) => Promise<T>) {
  const [estado, setEstado] = useState<Estado<T>>({ status: "carregando", dados: null, erro: null });
  const [versao, setVersao] = useState(0);
  const navegar = useNavigate();

  useEffect(() => {
    const controle = new AbortController();
    consultar(controle.signal).then((dados) => {
      if (!controle.signal.aborted) setEstado({ status: "sucesso", dados, erro: null });
    }).catch((erro: unknown) => {
      if (controle.signal.aborted) return;
      if (erro instanceof ErroHttp && erro.status === 401) {
        void navegar("/login", { replace: true });
        return;
      }
      setEstado({ status: "erro", dados: null, erro: mensagemErroApi(erro) });
    });
    return () => controle.abort();
  }, [consultar, versao, navegar]);

  function recarregar() {
    setEstado({ status: "carregando", dados: null, erro: null });
    setVersao((atual) => atual + 1);
  }

  return { ...estado, recarregar };
}
