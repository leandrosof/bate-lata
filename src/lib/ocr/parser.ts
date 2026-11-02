import { TZDate } from "@date-fns/tz";

export type ParsedPixReceipt = {
  e2eId: string | null;
  amountCents: number | null;
  paidAt: Date | null;
  recipientName: string | null;
};

function parseAmount(value: string): number | null {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

function parsePaidAt(
  dateMatch: RegExpMatchArray | null,
  timeMatch: RegExpMatchArray | null,
  timeZone: string,
): Date | null {
  if (!dateMatch || !timeMatch) return null;

  const [, day, month, year] = dateMatch;
  const [, hour, minute] = timeMatch;
  const date = new TZDate(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0,
    timeZone,
  );

  return Number.isNaN(date.getTime()) ? null : new Date(date.getTime());
}

function extractRecipient(lines: string[]): string | null {
  const labels = /^(RECEBEDOR|FAVORECIDO|NOME DO RECEBEDOR|PIX ENVIADO PARA)\b/i;
  const stop = /\b(CPF|CNPJ|CHAVE|INSTITUI|AGENCIA|AGÊNCIA|ID|E2E|VALOR|DATA)\b/i;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!labels.test(line)) continue;

    const afterColon = line.replace(labels, "").replace(/^[:\s-]+/, "").trim();
    if (afterColon && !stop.test(afterColon)) return afterColon;

    for (let next = index + 1; next < Math.min(lines.length, index + 4); next += 1) {
      const candidate = lines[next].trim();
      if (!candidate) continue;
      if (stop.test(candidate)) break;
      return candidate;
    }
  }

  return null;
}

export function parsePixReceipt(
  text: string,
  timeZone: string,
): ParsedPixReceipt {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);

  const collapsed = lines.join("\n");
  const e2eMatch = collapsed.replace(/\s+/g, "").match(/E\d{20,32}/i);
  const amountMatch = collapsed.match(/R\$\s*([\d.]+,\d{2})/);
  const dateMatch = collapsed.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const timeMatch = collapsed.match(/(\d{2}):(\d{2})/);

  return {
    e2eId: e2eMatch?.[0]?.toUpperCase() ?? null,
    amountCents: amountMatch ? parseAmount(amountMatch[1]) : null,
    paidAt: parsePaidAt(dateMatch, timeMatch, timeZone),
    recipientName: extractRecipient(lines),
  };
}
