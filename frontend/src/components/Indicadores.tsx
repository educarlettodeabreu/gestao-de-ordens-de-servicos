function Indicadores({ itens }: { itens: { titulo: string; valor: number | undefined }[] }) {
  return (
    <div className="erp-cards" aria-label="Indicadores do painel">
      {itens.map((item) => <article className="erp-stat" key={item.titulo}>
        <p>{item.titulo}</p><strong>{item.valor ?? "—"}</strong>
      </article>)}
    </div>
  );
}

export default Indicadores;
