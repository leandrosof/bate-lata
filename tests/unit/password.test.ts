import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("hashPassword", () => {
  it("gera um hash scrypt com salt e valida a senha correta", async () => {
    const hash = await hashPassword("SenhaSegura123");
    expect(hash.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(await verifyPassword("SenhaSegura123", hash)).toBe(true);
  });

  it("rejeita senha incorreta", async () => {
    const hash = await hashPassword("SenhaSegura123");
    expect(await verifyPassword("senhasegura123", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("gera hashes diferentes para a mesma senha", async () => {
    const first = await hashPassword("Arena@2026");
    const second = await hashPassword("Arena@2026");
    expect(first).not.toBe(second);
    expect(await verifyPassword("Arena@2026", first)).toBe(true);
    expect(await verifyPassword("Arena@2026", second)).toBe(true);
  });

  it("rejeita hashes malformados", async () => {
    expect(await verifyPassword("qualquer", "texto-invalido")).toBe(false);
    expect(await verifyPassword("qualquer", "scrypt$1$2$3$4$5")).toBe(false);
  });
});
