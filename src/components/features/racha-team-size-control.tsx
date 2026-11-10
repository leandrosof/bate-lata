"use client";

import { useActionState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { changeRachaTeamSizeAction } from "@/actions/racha";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-provider";
import { TEAM_SIZE_OPTIONS } from "@/lib/teams";

export function RachaTeamSizeControl({
  drawId,
  teamSize,
}: {
  drawId: string;
  teamSize: number;
}) {
  const [state, formAction, pending] = useActionState(changeRachaTeamSizeAction, null);
  const { toast } = useToast();

  useEffect(() => {
    if (!state?.message) return;
    toast({ message: state.message, tone: state.ok ? "success" : "error" });
  }, [state, toast]);

  return (
    <form
      action={formAction}
      className="rounded-xl border border-line bg-surface-2/40 p-3.5"
    >
      <input type="hidden" name="drawId" value={drawId} />
      <Label htmlFor="racha-team-size" className="mb-2">
        Jogadores por time
      </Label>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          key={teamSize}
          id="racha-team-size"
          name="teamSize"
          defaultValue={String(teamSize)}
          className="h-10 w-44"
        >
          {TEAM_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size} por time
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary" size="md" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {pending ? "Aplicando..." : "Aplicar"}
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-muted">
        Vale a partir da próxima partida; a partida atual continua com o tamanho anterior.
      </p>
      {state && !state.ok && state.message ? (
        <p className="mt-1 text-xs font-medium text-danger">{state.message}</p>
      ) : null}
    </form>
  );
}
