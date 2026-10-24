function Carregando() {
  return (
    <main className="login-page" aria-busy="true">
      <div className="login-layout">
        <section className="login-card" role="status" aria-live="polite">
          Verificando sua sessão...
        </section>
      </div>
    </main>
  );
}

export default Carregando;
