import { describe, expect, it } from "vitest";
import {
  readableTextColor,
  TEAM_NAMES,
  TEAM_PALETTE,
  teamVisualForIndex,
} from "@/lib/teams";

describe("paleta de times", () => {
  it("tem 40 cores nomeadas", () => {
    expect(TEAM_PALETTE).toHaveLength(40);
  });

  it("não repete nomes, identificadores nem cores", () => {
    expect(new Set(TEAM_PALETTE.map((item) => item.name)).size).toBe(TEAM_PALETTE.length);
    expect(new Set(TEAM_PALETTE.map((item) => item.color)).size).toBe(TEAM_PALETTE.length);
    expect(new Set(TEAM_PALETTE.map((item) => item.hex)).size).toBe(TEAM_PALETTE.length);
  });

  it("mantém as cores originais no começo", () => {
    expect(TEAM_PALETTE.slice(0, 12).map((item) => item.name)).toEqual([
      "Azul",
      "Vermelho",
      "Verde",
      "Amarelo",
      "Roxo",
      "Laranja",
      "Ciano",
      "Rosa",
      "Preto",
      "Branco",
      "Marrom",
      "Cinza",
    ]);
  });

  it("tem 89 nomes divertidos e únicos", () => {
    expect(TEAM_NAMES).toHaveLength(89);
    expect(new Set(TEAM_NAMES).size).toBe(TEAM_NAMES.length);
  });

  it("usa nomes divertidos com a cor ciclando", () => {
    expect(teamVisualForIndex(0)).toMatchObject({
      name: "Sem Bloqueio",
      color: "blue",
    });
    expect(teamVisualForIndex(1)).toMatchObject({
      name: "Dois Toques",
      color: "red",
    });
    expect(teamVisualForIndex(12)).toMatchObject({
      name: "Vôlei Cego",
      color: "turquoise",
      hex: "#14b8a6",
    });
    expect(teamVisualForIndex(40)).toMatchObject({
      name: TEAM_NAMES[40],
      color: "blue",
    });
  });

  it("usa Time N como fallback depois da lista", () => {
    expect(teamVisualForIndex(TEAM_NAMES.length).name).toBe(`Time ${TEAM_NAMES.length + 1}`);
  });
});

describe("readableTextColor", () => {
  it("usa texto claro em cores escuras", () => {
    expect(readableTextColor("#1f2937")).toBe("#f8fafc");
    expect(readableTextColor("#000080")).toBe("#f8fafc");
    expect(readableTextColor("#6b7280")).toBe("#f8fafc");
  });

  it("usa texto escuro em cores claras", () => {
    expect(readableTextColor("#e5e7eb")).toBe("#0b1220");
    expect(readableTextColor("#ffdb58")).toBe("#0b1220");
    expect(readableTextColor("#7fffd4")).toBe("#0b1220");
  });
});
