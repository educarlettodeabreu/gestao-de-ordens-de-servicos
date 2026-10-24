import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

function Dialogo({ titulo, ocupado, fechar, children }: {
  titulo: string;
  ocupado: boolean;
  fechar: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const anterior = document.activeElement;
    ref.current?.showModal();
    return () => {
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus();
    };
  }, []);

  return (
    <dialog ref={ref} className="erp-dialog" aria-labelledby="dialogo-title" aria-busy={ocupado}
      onCancel={(e) => { e.preventDefault(); if (!ocupado) fechar(); }}>
      <h2 id="dialogo-title">{titulo}</h2>
      {children}
    </dialog>
  );
}

export default Dialogo;
