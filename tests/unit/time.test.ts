import { describe, expect, it } from "vitest";
import {
  currentMonthKey,
  daysUntil,
  formatDateShort,
  formatDateTime,
  formatDurationSeconds,
  formatGameDuration,
  monthRange,
  parseLocalDate,
  parseLocalDateTime,
  toDateTimeLocal,
} from "@/lib/time";

const TZ = "America/Sao_Paulo";

describe("parseLocalDateTime", () => {
  it("interpreta data/hora local de São Paulo como UTC-3", () => {
    const date = parseLocalDateTime("2026-10-31T19:00", TZ);
    expect(date?.toISOString()).toBe("2026-10-31T22:00:00.000Z");
  });

  it("rejeita valores inválidos", () => {
    expect(parseLocalDateTime("2026-13-40T99:99", TZ)).toBeNull();
    expect(parseLocalDateTime("sem data", TZ)).toBeNull();
  });

  it("faz ida e volta com datetime-local", () => {
    const date = parseLocalDateTime("2026-12-05T19:30", TZ)!;
    expect(toDateTimeLocal(date, TZ)).toBe("2026-12-05T19:30");
  });
});

describe("formatação", () => {
  it("formata data e hora no fuso do grupo", () => {
    const date = new Date("2026-10-31T22:00:00.000Z");
    expect(formatDateShort(date, TZ)).toBe("31/10/2026");
    expect(formatDateTime(date, TZ)).toContain("19:00");
    expect(formatDateTime(date, TZ)).toContain("31 de outubro");
  });

  it("calcula a chave do mês e o intervalo mensal", () => {
    const reference = new Date("2026-10-31T22:00:00.000Z");
    expect(currentMonthKey(reference, TZ)).toBe("2026-10");

    const range = monthRange("2026-10", TZ);
    expect(range.start.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });

  it("calcula dias até o jogo com base no calendário do fuso", () => {
    const event = new Date("2026-11-07T22:00:00.000Z");
    const reference = new Date("2026-11-01T15:00:00.000Z");
    expect(daysUntil(event, TZ, reference)).toBe(6);
  });

  it("interpreta datas simples", () => {
    expect(parseLocalDate("2026-03-01", TZ)?.toISOString()).toBe("2026-03-01T03:00:00.000Z");
  });
});

describe("duração de partida", () => {
  it("formata segundos em minutos e horas", () => {
    expect(formatDurationSeconds(30)).toBe("menos de 1 min");
    expect(formatDurationSeconds(42 * 60)).toBe("42 min");
    expect(formatDurationSeconds(67 * 60)).toBe("1h 07min");
    expect(formatDurationSeconds(120 * 60)).toBe("2h");
  });

  it("calcula a duração entre início e fim", () => {
    const start = new Date("2026-11-01T19:00:00.000Z");
    const end = new Date("2026-11-01T19:42:00.000Z");
    expect(formatGameDuration(start, end)).toBe("42 min");
  });

  it("usa o horário atual em partida ao vivo", () => {
    const start = new Date("2026-11-01T19:00:00.000Z");
    const now = new Date("2026-11-01T19:18:00.000Z");
    expect(formatGameDuration(start, null, now)).toBe("18 min");
  });

  it("retorna null para dados ausentes ou inválidos", () => {
    expect(formatGameDuration(null, new Date())).toBeNull();
    expect(
      formatGameDuration(
        new Date("2026-11-01T19:42:00.000Z"),
        new Date("2026-11-01T19:00:00.000Z"),
      ),
    ).toBeNull();
  });
});
