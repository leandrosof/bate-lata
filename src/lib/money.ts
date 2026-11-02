const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatCents(cents: number | null | undefined): string {
  return brl.format((cents ?? 0) / 100);
}
