import { Badge, type BadgeTone } from "@/components/ui/badge";

const eventLabels: Record<string, { label: string; tone: BadgeTone }> = {
  SCHEDULED: { label: "Agendado", tone: "brand" },
  CANCELLED: { label: "Cancelado", tone: "danger" },
  FINISHED: { label: "Realizado", tone: "neutral" },
};

const gameLabels: Record<string, { label: string; tone: BadgeTone }> = {
  NOT_STARTED: { label: "Aguardando", tone: "neutral" },
  IN_PROGRESS: { label: "Ao vivo", tone: "live" },
  FINISHED: { label: "Encerrada", tone: "success" },
  CANCELLED: { label: "Cancelada", tone: "danger" },
};

const drawLabels: Record<string, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: "Sorteio pronto", tone: "warning" },
  IN_PROGRESS: { label: "Rodada em andamento", tone: "live" },
  FINISHED: { label: "Rodada encerrada", tone: "neutral" },
  CANCELLED: { label: "Cancelada", tone: "danger" },
};

export function EventStatusBadge({ status }: { status: string }) {
  const config = eventLabels[status] ?? { label: status, tone: "neutral" as BadgeTone };
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

export function GameStatusBadge({ status }: { status: string }) {
  const config = gameLabels[status] ?? { label: status, tone: "neutral" as BadgeTone };
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

export function DrawStatusBadge({ status }: { status: string }) {
  const config = drawLabels[status] ?? { label: status, tone: "neutral" as BadgeTone };
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
