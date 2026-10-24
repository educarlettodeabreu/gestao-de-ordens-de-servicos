function EstadoConsulta({ status, erro, repetir }: {
  status: "carregando" | "sucesso" | "erro";
  erro: string | null;
  repetir: () => void;
}) {
  if (status === "carregando") return <p className="erp-loading" role="status">Carregando dados...</p>;
  if (!erro) return null;
  return (
    <div className="erp-feedback" role="alert">
      <p className="login-message login-message--error">{erro}</p>
      <button className="erp-button" type="button" onClick={repetir}>Tentar novamente</button>
    </div>
  );
}

export default EstadoConsulta;
