const caminhos = {
  ordens: "M9 4H5a2 2 0 0 0-2 2v14h18V6a2 2 0 0 0-2-2h-4M9 2h6v4H9zM7 11h10M7 16h6",
  inicio: "m3 10 9-7 9 7v11h-7v-7h-4v7H3z",
  servicos: "m14 6 4-4 4 4-4 4-3-1-8 12-4-4L15 9z",
  solicitacoes: "M4 3h16v14H8l-4 4zM8 7h8M8 12h5",
  menu: "M4 6h16M4 12h16M4 18h16",
  sair: "M9 3H4v18h5m5-15 6 6-6 6m-6-6h12",
};

function Icone({ nome }: { nome: keyof typeof caminhos }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={caminhos[nome]} />
    </svg>
  );
}

export default Icone;
