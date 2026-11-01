import { describe, expect, it } from "vitest";
import {
  orderQueue,
  planFirstMatch,
  planNextMatch,
  removeFromQueue,
  substitutePlayer,
  type RachaPlayer,
} from "@/lib/racha";

function players(count: number, gamesPlayed = 0): RachaPlayer[] {
  return Array.from({ length: count }, (_, index) => ({
    userId: `p${index + 1}`,
    gamesPlayed,
    queuePosition: index + 1,
  }));
}

describe("orderQueue", () => {
  it("prioriza quem jogou menos e usa a fila como desempate", () => {
    const ordered = orderQueue(
      [
        { userId: "a", gamesPlayed: 2, queuePosition: 1 },
        { userId: "b", gamesPlayed: 0, queuePosition: 3 },
        { userId: "c", gamesPlayed: 0, queuePosition: 2 },
      ],
      "HYBRID",
    );
    expect(ordered.map((entry) => entry.userId)).toEqual(["c", "b", "a"]);
  });

  it("na regra de fila/chegada respeita a posição", () => {
    const ordered = orderQueue(
      [
        { userId: "a", gamesPlayed: 0, queuePosition: 2 },
        { userId: "b", gamesPlayed: 5, queuePosition: 1 },
      ],
      "WINNER_STAYS",
    );
    expect(ordered.map((entry) => entry.userId)).toEqual(["b", "a"]);
  });
});

describe("planFirstMatch", () => {
  it("monta dois times e deixa o restante na fila", () => {
    const plan = planFirstMatch(players(10), 3, "HYBRID");
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.sideA).toHaveLength(3);
    expect(plan.sideB).toHaveLength(3);
    expect(plan.queue).toHaveLength(4);
  });

  it("informa quantos faltam", () => {
    const plan = planFirstMatch(players(5), 3, "HYBRID");
    expect(plan).toEqual({ ok: false, missing: 1 });
  });
});

describe("planNextMatch", () => {
  it("mantém o vencedor e puxa o próximo da fila", () => {
    const pool = players(9);
    const plan = planNextMatch({
      rule: "HYBRID",
      teamSize: 3,
      players: [
        ...pool.map((player) =>
          ["p1", "p2", "p3"].includes(player.userId)
            ? { ...player, gamesPlayed: 1 }
            : player,
        ),
      ],
      winnerIds: ["p1", "p2", "p3"],
      loserIds: ["p4", "p5", "p6"],
    });

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.sideA).toEqual(["p1", "p2", "p3"]);
    expect(plan.sideB).toEqual(["p7", "p8", "p9"]);
    expect(plan.queue).toEqual(["p4", "p5", "p6"]);
  });

  it("com dois times eles alternam", () => {
    const pool = players(6).map((player) => ({ ...player, gamesPlayed: 1 }));
    const plan = planNextMatch({
      rule: "HYBRID",
      teamSize: 3,
      players: pool,
      winnerIds: ["p1", "p2", "p3"],
      loserIds: ["p4", "p5", "p6"],
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.sideA).toEqual(["p1", "p2", "p3"]);
    expect(plan.sideB).toEqual(["p4", "p5", "p6"]);
    expect(plan.queue).toEqual([]);
  });

  it("na regra todos rodam, ninguém fica fixo", () => {
    const plan = planNextMatch({
      rule: "ROTATE_ALL",
      teamSize: 2,
      players: players(6),
      winnerIds: ["p1", "p2"],
      loserIds: ["p3", "p4"],
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.winnerStayed).toBe(false);
    expect([...plan.sideA, ...plan.sideB]).toHaveLength(4);
  });

  it("pausa quando não há jogadores suficientes", () => {
    const plan = planNextMatch({
      rule: "HYBRID",
      teamSize: 3,
      players: players(4),
      winnerIds: ["p1", "p2", "p3"],
      loserIds: ["p4"],
    });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.missing).toBeGreaterThan(0);
  });
});

describe("substituição", () => {
  it("troca um jogador do time por alguém da fila", () => {
    const lineup = substitutePlayer(
      { sideA: ["a", "b"], sideB: ["c", "d"], queue: ["e", "f"] },
      "b",
      "e",
    );
    expect(lineup.sideA).toEqual(["a", "e"]);
    expect(lineup.queue).toEqual(["f"]);
  });

  it("bloqueia substituto que já está em quadra", () => {
    expect(() =>
      substitutePlayer({ sideA: ["a"], sideB: ["b"], queue: ["c"] }, "a", "b"),
    ).toThrow();
  });
});

describe("removeFromQueue", () => {
  it("remove o jogador mantendo a ordem", () => {
    expect(removeFromQueue(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });
});
