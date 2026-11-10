import { describe, expect, it } from "vitest";
import { nextCapacityLimit } from "@/lib/capacity";
import { MAX_PLAYERS_LIMIT } from "@/lib/teams";

describe("nextCapacityLimit", () => {
  it("aumenta 1 vaga quando a lista está no limite", () => {
    expect(nextCapacityLimit(30, 30)).toBe(31);
  });

  it("acompanha a lista quando ela já passou do limite", () => {
    expect(nextCapacityLimit(12, 20)).toBe(21);
  });

  it("respeita as vagas extras informadas", () => {
    expect(nextCapacityLimit(30, 20, 3)).toBe(33);
  });

  it("não passa do limite máximo", () => {
    expect(nextCapacityLimit(MAX_PLAYERS_LIMIT, MAX_PLAYERS_LIMIT)).toBe(MAX_PLAYERS_LIMIT);
  });
});
