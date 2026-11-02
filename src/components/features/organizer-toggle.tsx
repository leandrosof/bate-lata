"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleOrganizerAction } from "@/actions/attendance";
import { ensurePlayerAction } from "@/actions/racha";
import type { ActionState } from "@/lib/action";
import { Switch } from "@/components/ui/input";

export function OrganizerToggle({
  eventId,
  attendanceId,
  isOrganizer,
  isAdmin,
}: {
  eventId: string;
  attendanceId?: string | null;
  isOrganizer?: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin) return null;

  const playing = Boolean(attendanceId) && !isOrganizer;
  const description = !attendanceId
    ? "Você ainda não entrou na lista. Ative para jogar."
    : playing
      ? "Você está no time e entra na fila."
      : "Você está só organizando.";

  function handleChange(checked: boolean) {
    if (!attendanceId && !checked) return;
    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      let result: ActionState;

      if (attendanceId) {
        formData.set("attendanceId", attendanceId);
        result = await toggleOrganizerAction(null, formData);
      } else {
        formData.set("eventId", eventId);
        result = await ensurePlayerAction(null, formData);
      }

      if (!result || !result.ok) {
        setError(result?.message ?? "Não foi possível atualizar sua presença.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <Switch
        label="Vou jogar"
        description={description}
        checked={playing}
        disabled={pending}
        onChange={(event) => handleChange(event.target.checked)}
      />
      {error ? (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
