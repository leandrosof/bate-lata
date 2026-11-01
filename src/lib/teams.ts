export type TeamVisual = {
  name: string;
  color: string;
  hex: string;
  soft: string;
};

export const TEAM_PALETTE: TeamVisual[] = [
  { name: "Azul", color: "blue", hex: "#2f6bff", soft: "rgba(47,107,255,0.16)" },
  { name: "Vermelho", color: "red", hex: "#ef4444", soft: "rgba(239,68,68,0.16)" },
  { name: "Verde", color: "green", hex: "#22c55e", soft: "rgba(34,197,94,0.16)" },
  { name: "Amarelo", color: "yellow", hex: "#eab308", soft: "rgba(234,179,8,0.16)" },
  { name: "Roxo", color: "purple", hex: "#a855f7", soft: "rgba(168,85,247,0.16)" },
  { name: "Laranja", color: "orange", hex: "#f97316", soft: "rgba(249,115,22,0.16)" },
  { name: "Ciano", color: "cyan", hex: "#06b6d4", soft: "rgba(6,182,212,0.16)" },
  { name: "Rosa", color: "pink", hex: "#ec4899", soft: "rgba(236,72,153,0.16)" },
  { name: "Preto", color: "black", hex: "#1f2937", soft: "rgba(31,41,55,0.28)" },
  { name: "Branco", color: "white", hex: "#e5e7eb", soft: "rgba(229,231,235,0.16)" },
  { name: "Marrom", color: "brown", hex: "#92400e", soft: "rgba(146,64,14,0.2)" },
  { name: "Cinza", color: "gray", hex: "#6b7280", soft: "rgba(107,114,128,0.18)" },
];

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const normalized =
    value.length === 3
      ? value
          .split("")
          .map((char) => char + char)
          .join("")
      : value;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const segment = (hue % 360) / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const [r, g, b] =
    segment < 1
      ? [chroma, x, 0]
      : segment < 2
        ? [x, chroma, 0]
        : segment < 3
          ? [0, chroma, x]
          : segment < 4
            ? [0, x, chroma]
            : segment < 5
              ? [x, 0, chroma]
              : [chroma, 0, x];
  const m = l - chroma / 2;
  const toHex = (channel: number) =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function teamVisualForIndex(index: number): TeamVisual {
  const preset = TEAM_PALETTE[index];
  if (preset) return preset;

  const hue = (index * 47 + 13) % 360;
  const hex = hslToHex(hue, 68, 55);
  return {
    name: `Time ${index + 1}`,
    color: hex,
    hex,
    soft: hexToRgba(hex, 0.16),
  };
}

export function teamVisualByColor(color: string): TeamVisual {
  if (color.startsWith("#")) {
    return {
      name: color,
      color,
      hex: color,
      soft: hexToRgba(color, 0.16),
    };
  }
  return (
    TEAM_PALETTE.find((item) => item.color === color) ??
    TEAM_PALETTE[0]
  );
}

export function teamVisualByIndex(index: number): TeamVisual {
  return teamVisualForIndex(index);
}

export const TEAM_SIZE_OPTIONS = [4, 5, 6] as const;
export const MAX_PLAYERS_LIMIT = 200;
export const MIN_PLAYERS_LIMIT = 2;
