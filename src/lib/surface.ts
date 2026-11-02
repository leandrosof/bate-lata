export type EventSurface = "SAND" | "COURT";

export const SURFACE_LABELS: Record<EventSurface, string> = {
  SAND: "Areia",
  COURT: "Quadra",
};

export function surfaceLabel(value: string | null | undefined): string | null {
  if (value === "SAND" || value === "COURT") return SURFACE_LABELS[value];
  return null;
}

export function surfaceCover(value: string | null | undefined): string {
  if (value === "SAND") return "/covers/beach.jpg";
  if (value === "COURT") return "/covers/court.jpg";
  return "/covers/volleyball.jpg";
}
