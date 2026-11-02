"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleOrganizerAction } from "@/actions/attendance";
import { ensurePlayerAction } from "@/actions/racha";
import type { ActionState } from "@/lib/action";
import { Switch } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-provider";

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
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  if (!isAdmin) return null;

  const playing = Boolean(attendanceId) && !isOrganizer;
  const description = !attendanceId
    ? "Você ainda não entrou na lista. Ative para jogar."
    : playing
      ? "Você está no time e entra na fila."
      : "Você está só organizando.";

  function handleChange(checked: boolean) {
    if (!attendanceId && !checked) return;

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
        toast({ tone: "error", message: result?.message ?? "Não foi possível atualizar sua presença." });
        return;
      }
      toast({ tone: "success", message: result.message ?? "Presença atualizada." });
      router.refresh();
    });
  }

  return (
    <Switch
      label="Vou jogar"
      description={description}
      checked={playing}
      disabled={pending}
      onChange={(event) => handleChange(event.target.checked)}
    />
  );
}
