import type { Ordem } from "../types/ERP.ts";

export function formatarData(valor: string | null) {
  if (!valor) return "Data não informada";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(data);
}

export function contarStatus(ordens: Ordem[]) {
  const contagens = new Map<string, number>();
  for (const ordem of ordens) contagens.set(ordem.status, (contagens.get(ordem.status) ?? 0) + 1);
  return Array.from(contagens, ([status, quantidade]) => ({ status, quantidade }));
}
