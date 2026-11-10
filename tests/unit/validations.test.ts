import { describe, expect, it } from "vitest";
import {
  drawSchema,
  eventCapacitySchema,
  eventSchema,
  rachaTeamSizeSchema,
  registerSchema,
  scoreSetSchema,
  settingsSchema,
  startGameSchema,
} from "@/lib/validations";

describe("registerSchema", () => {
  it("aceita cadastro válido", () => {
    const result = registerSchema.safeParse({
      name: "Ana Souza",
      email: "ANA@ARENA.LOCAL",
      password: "Arena@2026",
      confirmPassword: "Arena@2026",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita senhas diferentes e senha curta", () => {
    const mismatch = registerSchema.safeParse({
      name: "Ana",
      email: "ana@arena.local",
      password: "Arena@2026",
      confirmPassword: "Outra@2026",
    });
    expect(mismatch.success).toBe(false);

    const short = registerSchema.safeParse({
      name: "Ana",
      email: "ana@arena.local",
      password: "123",
      confirmPassword: "123",
    });
    expect(short.success).toBe(false);
  });
});

describe("eventSchema", () => {
  it("converte limite de jogadores e aceita evento completo", () => {
    const result = eventSchema.safeParse({
      title: "Vôlei de sábado",
      startsAt: "2026-11-07T19:00",
      venueName: "Arena",
      surface: "COURT",
      maxPlayers: "12",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.maxPlayers).toBe(12);
  });

  it("limita o número de jogadores", () => {
    const result = eventSchema.safeParse({
      title: "Vôlei",
      startsAt: "2026-11-07T19:00",
      venueName: "Arena",
      surface: "COURT",
      maxPlayers: "1",
    });
    expect(result.success).toBe(false);
  });
});

describe("regras de sorteio e placar", () => {
  it("aceita apenas 4, 5 ou 6 por time", () => {
    const base = { eventId: "0a5d3d3e-3e4b-4d61-9d6f-1f4b8b8f8f8f" };
    expect(drawSchema.safeParse({ ...base, teamSize: "5" }).success).toBe(true);
    expect(drawSchema.safeParse({ ...base, teamSize: "7" }).success).toBe(false);
  });

  it("exige times diferentes ao iniciar partida", () => {
    const id = "0a5d3d3e-3e4b-4d61-9d6f-1f4b8b8f8f8f";
    const result = startGameSchema.safeParse({ drawId: id, teamAId: id, teamBId: id });
    expect(result.success).toBe(false);
  });

  it("valida placar não negativo", () => {
    const gameId = "0a5d3d3e-3e4b-4d61-9d6f-1f4b8b8f8f8f";
    expect(scoreSetSchema.safeParse({ gameId, scoreA: "25", scoreB: "20" }).success).toBe(true);
    expect(scoreSetSchema.safeParse({ gameId, scoreA: "-1", scoreB: "20" }).success).toBe(false);
  });

  it("valida mudança de jogadores por time e vagas extras", () => {
    const id = "0a5d3d3e-3e4b-4d61-9d6f-1f4b8b8f8f8f";
    expect(rachaTeamSizeSchema.safeParse({ drawId: id, teamSize: "5" }).success).toBe(true);
    expect(rachaTeamSizeSchema.safeParse({ drawId: id, teamSize: "7" }).success).toBe(false);
    expect(eventCapacitySchema.safeParse({ eventId: id, seats: "2" }).success).toBe(true);
    expect(eventCapacitySchema.safeParse({ eventId: id, seats: "0" }).success).toBe(false);
  });
});

describe("settingsSchema", () => {
  it("trata checkbox ausente como desativado", () => {
    const parsed = settingsSchema.safeParse({
      siteName: "Arena do Vôlei",
      pointsWin: "3",
      pointsLoss: "1",
      defaultTeamSize: "6",
      timezone: "America/Sao_Paulo",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.rankingEnabled).toBe(false);
      expect(parsed.data.allowWaitlist).toBe(false);
    }
  });
});
