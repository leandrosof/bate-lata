import { describe, expect, it } from "vitest";
import { getAvatarCropGeometry } from "@/lib/avatar-crop";

describe("getAvatarCropGeometry", () => {
  it("recorta o centro de uma imagem quadrada", () => {
    expect(getAvatarCropGeometry(100, 100, 0.5, 0.5, 1)).toEqual({
      left: 0,
      top: 0,
      size: 100,
    });
  });

  it("centraliza o recorte em imagens largas", () => {
    expect(getAvatarCropGeometry(200, 100, 0.5, 0.5, 1)).toEqual({
      left: 50,
      top: 0,
      size: 100,
    });
  });

  it("respeita os limites ao mover para as bordas", () => {
    expect(getAvatarCropGeometry(200, 100, 0, 0, 1)).toEqual({
      left: 0,
      top: 0,
      size: 100,
    });
    expect(getAvatarCropGeometry(200, 100, 1, 1, 1)).toEqual({
      left: 100,
      top: 0,
      size: 100,
    });
  });

  it("aplica zoom ao redor do ponto escolhido", () => {
    expect(getAvatarCropGeometry(200, 100, 0.5, 0.5, 2)).toEqual({
      left: 75,
      top: 25,
      size: 50,
    });
  });

  it("limita o zoom entre 1 e 3", () => {
    expect(getAvatarCropGeometry(100, 100, 0.5, 0.5, 0).size).toBe(100);
    expect(getAvatarCropGeometry(100, 100, 0.5, 0.5, 10).size).toBeCloseTo(100 / 3);
  });
});
