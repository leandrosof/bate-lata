export type TeamVisual = {
  name: string;
  color: string;
  hex: string;
  soft: string;
};

type TeamPaletteSeed = {
  name: string;
  color: string;
  hex: string;
};

const TEAM_PALETTE_SEED: TeamPaletteSeed[] = [
  { name: "Azul", color: "blue", hex: "#2f6bff" },
  { name: "Vermelho", color: "red", hex: "#ef4444" },
  { name: "Verde", color: "green", hex: "#22c55e" },
  { name: "Amarelo", color: "yellow", hex: "#eab308" },
  { name: "Roxo", color: "purple", hex: "#a855f7" },
  { name: "Laranja", color: "orange", hex: "#f97316" },
  { name: "Ciano", color: "cyan", hex: "#06b6d4" },
  { name: "Rosa", color: "pink", hex: "#ec4899" },
  { name: "Preto", color: "black", hex: "#1f2937" },
  { name: "Branco", color: "white", hex: "#e5e7eb" },
  { name: "Marrom", color: "brown", hex: "#92400e" },
  { name: "Cinza", color: "gray", hex: "#6b7280" },
  { name: "Turquesa", color: "turquoise", hex: "#14b8a6" },
  { name: "Vinho", color: "wine", hex: "#7f1d1d" },
  { name: "Bordô", color: "burgundy", hex: "#9f1239" },
  { name: "Bege", color: "beige", hex: "#d6c7a1" },
  { name: "Lilás", color: "lilac", hex: "#c084fc" },
  { name: "Violeta", color: "violet", hex: "#7c3aed" },
  { name: "Magenta", color: "magenta", hex: "#d946ef" },
  { name: "Salmão", color: "salmon", hex: "#fa8072" },
  { name: "Coral", color: "coral", hex: "#ff7f50" },
  { name: "Dourado", color: "gold", hex: "#d4af37" },
  { name: "Prata", color: "silver", hex: "#c0c0c0" },
  { name: "Bronze", color: "bronze", hex: "#cd7f32" },
  { name: "Oliva", color: "olive", hex: "#808000" },
  { name: "Esmeralda", color: "emerald", hex: "#50c878" },
  { name: "Safira", color: "sapphire", hex: "#0f52ba" },
  { name: "Índigo", color: "indigo", hex: "#4b0082" },
  { name: "Pêssego", color: "peach", hex: "#ffcba4" },
  { name: "Mostarda", color: "mustard", hex: "#ffdb58" },
  { name: "Lavanda", color: "lavender", hex: "#b57edc" },
  { name: "Terracota", color: "terracotta", hex: "#e2725b" },
  { name: "Limão", color: "lime", hex: "#bfff00" },
  { name: "Água-marinha", color: "aquamarine", hex: "#7fffd4" },
  { name: "Marinho", color: "navy", hex: "#000080" },
  { name: "Celeste", color: "sky", hex: "#87ceeb" },
  { name: "Cereja", color: "cherry", hex: "#de3163" },
  { name: "Chumbo", color: "charcoal", hex: "#36454f" },
  { name: "Gelo", color: "ice", hex: "#d6f0ff" },
  { name: "Areia", color: "sand", hex: "#e2c290" },
];

export const TEAM_NAMES = [
  "Sem Bloqueio",
  "Dois Toques",
  "Mão Furada",
  "Bola Fora",
  "Saque Torto",
  "Só Largadinha",
  "Pé na Linha",
  "Fora da Antena",
  "Teto Baixo",
  "Quatro Toques",
  "Ponto Deles",
  "Bola Murcha",
  "Vôlei Cego",
  "Sem Salto",
  "Só Manchete",
  "Toque Sujo",
  "Bloqueio Baixo",
  "Corta Nunca",
  "Saque Frouxo",
  "Rede Baixa",
  "Sem Rodízio",
  "Líbero Cansado",
  "Deixa Cair",
  "Minha Bola!",
  "Foi Dentro!",
  "Não Pulo",
  "Só no Susto",
  "Mão de Alface",
  "Braço Curto",
  "Pés de Chumbo",
  "Tudo Torto",
  "Sem Mira",
  "Só Balão",
  "Vôlei & Chopp",
  "Litrão V.C.",
  "Ressaca V.C.",
  "Suco de Cevada",
  "Picanha V.C.",
  "Puro Malte",
  "Terceiro Set",
  "Fígado Forte",
  "Cerveja Quente",
  "Torresmo V.C.",
  "Só no Gole",
  "Copo Cheio",
  "Saque & Gole",
  "Mesa de Bar",
  "Fiado Não",
  "Só Resenha",
  "Gole Olímpico",
  "Dorflex V.C.",
  "Sem Joelho",
  "Cataflam V.C.",
  "Hérnia V.C.",
  "Ciático Dói",
  "Câimbra V.C.",
  "Sem Fôlego",
  "INSS Vôlei",
  "Lombar Travada",
  "Só o Pó",
  "Velha Guarda",
  "Artrose V.C.",
  "Estalou Tudo",
  "Samu V.C.",
  "Gelol V.C.",
  "Menisco Foi",
  "Coluna Torta",
  "UTI Vôlei",
  "Oxigênio Já",
  "Sem Cartilagem",
  "Pulo Baixo",
  "Atestado V.C.",
  "Junta Seca",
  "Pé Inchado",
  "Quase Bons",
  "Sem Talento",
  "Bagunça V.C.",
  "Quem Vai?",
  "Eu Deixo!",
  "Zero Técnica",
  "Várzea Pura",
  "Que Fase!",
  "Enferrujados",
  "Sedentários",
  "Cansados",
  "Gambiarra",
  "Atrasados",
  "Zicados",
  "Pangarés",
];

const DARK_SOFT_COLORS = new Set([
  "black",
  "brown",
  "gray",
  "wine",
  "burgundy",
  "sapphire",
  "indigo",
  "navy",
  "charcoal",
]);

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

export const TEAM_PALETTE: TeamVisual[] = TEAM_PALETTE_SEED.map((item) => ({
  ...item,
  soft: hexToRgba(item.hex, DARK_SOFT_COLORS.has(item.color) ? 0.28 : 0.16),
}));

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

export function readableTextColor(hex: string): string {
  const value = hex.replace("#", "");
  const normalized =
    value.length === 3
      ? value
          .split("")
          .map((char) => char + char)
          .join("")
      : value;
  const channels = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.45 ? "#0b1220" : "#f8fafc";
}

export function teamVisualForIndex(index: number): TeamVisual {
  const name = TEAM_NAMES[index] ?? `Time ${index + 1}`;
  const palette = TEAM_PALETTE[index % TEAM_PALETTE.length];

  if (palette) {
    return { ...palette, name };
  }

  const hue = (index * 47 + 13) % 360;
  const hex = hslToHex(hue, 68, 55);
  return {
    name,
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
