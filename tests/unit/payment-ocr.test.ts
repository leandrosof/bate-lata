import { describe, expect, it } from "vitest";
import { parsePixReceipt } from "@/lib/ocr/parser";
import { recipientMatches, validatePixProof } from "@/lib/ocr/validate";

const TZ = "America/Sao_Paulo";

const receipt = [
  "Comprovante Pix",
  "Valor R$ 20,00",
  "Data 02/11/2026 14:30",
  "E12345678202611021430000123456",
  "Recebedor LEANDRO SILVA",
].join("\n");

describe("parsePixReceipt", () => {
  it("extrai E2E, valor, data e recebedor", () => {
    const parsed = parsePixReceipt(receipt, TZ);

    expect(parsed.e2eId).toBe("E12345678202611021430000123456");
    expect(parsed.amountCents).toBe(2000);
    expect(parsed.paidAt?.toISOString()).toBe("2026-11-02T17:30:00.000Z");
    expect(parsed.recipientName).toBe("LEANDRO SILVA");
  });

  it("não quebra quando faltam campos", () => {
    const parsed = parsePixReceipt("Comprovante sem dados", TZ);

    expect(parsed.e2eId).toBeNull();
    expect(parsed.amountCents).toBeNull();
    expect(parsed.paidAt).toBeNull();
    expect(parsed.recipientName).toBeNull();
  });
});

describe("recipientMatches", () => {
  it("aceita nome completo", () => {
    expect(recipientMatches("LEANDRO SILVA", "LEANDRO SILVA")).toBe(true);
  });

  it("aceita abreviações e iniciais", () => {
    expect(recipientMatches("LEANDRO S. A.", "LEANDRO SILVA ALVES")).toBe(true);
    expect(recipientMatches("LEANDRO SILVA", "LEANDRO S. A.")).toBe(true);
  });

  it("recusa nomes diferentes", () => {
    expect(recipientMatches("MARIA SOUZA", "LEANDRO SILVA")).toBe(false);
  });
});

describe("validatePixProof", () => {
  it("aprova comprovante recente e compatível", () => {
    const parsed = parsePixReceipt(receipt, TZ);
    const reasons = validatePixProof({
      parsed,
      confidence: 92,
      eventPriceCents: 2000,
      eventCreatedAt: new Date("2026-11-01T12:00:00.000Z"),
      expectedRecipient: "LEANDRO S. A.",
      timeZone: TZ,
      now: new Date("2026-11-02T18:00:00.000Z"),
    });

    expect(reasons).toEqual([]);
  });

  it("sinaliza valor divergente e data antiga", () => {
    const parsed = parsePixReceipt(
      receipt.replace("20,00", "10,00"),
      TZ,
    );
    const reasons = validatePixProof({
      parsed,
      confidence: 92,
      eventPriceCents: 2000,
      eventCreatedAt: new Date("2026-11-03T12:00:00.000Z"),
      expectedRecipient: "LEANDRO SILVA",
      timeZone: TZ,
      now: new Date("2026-11-10T18:00:00.000Z"),
    });

    expect(reasons).toContain("amount_mismatch");
    expect(reasons).toContain("old_date");
  });
});
