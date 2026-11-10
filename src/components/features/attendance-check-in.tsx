import { Check, LogIn, MapPin, Undo2 } from "lucide-react";
import { checkInAttendanceAction, undoCheckInAttendanceAction } from "@/actions/racha";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { CHECK_IN_NOTICE, checkInWindow, type CheckInEvent } from "@/lib/check-in";
import { formatDateTime, formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

type AttendanceCheckInProps = {
  attendanceId: string;
  checkedInAt: Date | null;
  event: CheckInEvent;
  timeZone: string;
  isAdmin?: boolean;
  isSelf?: boolean;
  isOrganizer?: boolean;
  canManage?: boolean;
  playerName?: string;
  size?: "sm" | "md" | "lg";
  block?: boolean;
  compact?: boolean;
  compactLabel?: string;
  showNotice?: boolean;
  className?: string;
};

export function AttendanceCheckIn({
  attendanceId,
  checkedInAt,
  event,
  timeZone,
  isAdmin = false,
  isSelf = true,
  isOrganizer = false,
  canManage = true,
  playerName,
  size = "sm",
  block = false,
  compact = false,
  compactLabel,
  showNotice = true,
  className,
}: AttendanceCheckInProps) {
  if (isOrganizer) return null;

  if (checkedInAt) {
    return (
      <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
        <Badge tone="success" className="gap-1">
          <Check className="h-3 w-3" aria-hidden />
          Presente desde {formatTime(checkedInAt, timeZone)}
        </Badge>
        {canManage ? (
          <ActionButton
            action={undoCheckInAttendanceAction}
            fields={{ attendanceId }}
            variant="ghost"
            size="sm"
            title="Desfazer chegada"
            icon={<Undo2 className="h-3.5 w-3.5" aria-hidden />}
            confirmMessage="Desfazer chegada? Use somente se a marcação foi feita por engano."
          >
            Desfazer chegada
          </ActionButton>
        ) : null}
      </div>
    );
  }

  const window = checkInWindow(event);
  const open = isAdmin ? event.status === "SCHEDULED" : window.open;

  if (!open) {
    if (compact) return null;
    const hint =
      window.reason === "before"
        ? `Chegada liberada a partir de ${formatDateTime(window.opensAt, timeZone)}.`
        : window.reason === "cancelled"
          ? "Evento cancelado."
          : window.reason === "finished"
            ? "Evento encerrado."
            : "Janela de chegada encerrada.";
    return <p className={cn("text-xs text-muted", className)}>{hint}</p>;
  }

  const confirmMessage =
    playerName && !isSelf
      ? `Marcar chegada de ${playerName}? Confirme apenas se a pessoa já estiver no local.`
      : "Marque apenas se você já estiver no local do evento. Confirmar chegada?";

  return (
    <div className={cn("space-y-1.5", className)}>
      {showNotice && !compact ? (
        <p className="flex items-start gap-1.5 text-xs font-medium text-warning">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {CHECK_IN_NOTICE}
        </p>
      ) : null}
      <ActionButton
        action={checkInAttendanceAction}
        fields={{ attendanceId }}
        variant="success"
        size={compact ? (compactLabel ? "sm" : "icon-sm") : size}
        block={block}
        icon={<LogIn className="h-3.5 w-3.5" aria-hidden />}
        title="Marcar chegada (somente no local)"
        confirmTitle="Confirmar chegada"
        confirmMessage={confirmMessage}
      >
        {compact ? compactLabel : "Cheguei"}
      </ActionButton>
    </div>
  );
}
