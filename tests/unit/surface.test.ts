import { describe, expect, it } from "vitest";
import { surfaceCover, surfaceLabel } from "@/lib/surface";

describe("piso do evento", () => {
  it("traduz os pisos", () => {
    expect(surfaceLabel("SAND")).toBe("Areia");
    expect(surfaceLabel("COURT")).toBe("Quadra");
    expect(surfaceLabel(null)).toBeNull();
  });

  it("escolhe a capa padrão", () => {
    expect(surfaceCover("SAND")).toBe("/covers/beach.jpg");
    expect(surfaceCover("COURT")).toBe("/covers/court.jpg");
    expect(surfaceCover(null)).toBe("/covers/volleyball.jpg");
  });
});
