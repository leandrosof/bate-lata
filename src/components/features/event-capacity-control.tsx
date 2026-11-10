import { Plus } from "lucide-react";
import { adminIncreaseEventCapacityAction } from "@/actions/attendance";
import { ActionForm } from "@/components/ui/action-form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function EventCapacityControl({
  eventId,
  reservedCount,
  maxPlayers,
  isAdmin,
  className,
}: {
  eventId: string;
  reservedCount: number;
  maxPlayers: number;
  isAdmin: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-2/50 px-3 py-2",
        className,
      )}
    >
      <p className="text-xs text-muted">
        Vagas: <strong className="font-semibold text-ink">{reservedCount}</strong>/{maxPlayers}
      </p>
      {isAdmin ? (
        <ActionForm
          action={adminIncreaseEventCapacityAction}
          hiddenFields={{ eventId }}
          submitLabel="Aumentar vagas"
          submitIcon={<Plus className="h-3.5 w-3.5" aria-hidden />}
          variant="secondary"
          size="sm"
          className="ml-auto flex flex-wrap items-end gap-2 space-y-0"
        >
          <Input
            name="seats"
            type="number"
            min={1}
            max={100}
            defaultValue={1}
            aria-label="Vagas adicionais"
            className="h-9 w-20"
          />
        </ActionForm>
      ) : null}
    </div>
  );
}
