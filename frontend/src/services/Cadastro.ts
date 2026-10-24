export async function criarConta(nome: string, email: string, senha: string) {
  const resposta = await fetch("/api/criarConta", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ nome, email, senha }),
  });

  return resposta;
}
