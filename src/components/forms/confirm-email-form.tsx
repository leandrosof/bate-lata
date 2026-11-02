"use client";

import { useActionState } from "react";
import { BadgeCheck } from "lucide-react";
import { verifyEmailAction } from "@/actions/auth";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";

export function ConfirmEmailForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(verifyEmailAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state && !state.ok && state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      <SubmitButton
        label="Confirmar meu e-mail"
        pendingLabel="Confirmando..."
        size="lg"
        block
        icon={<BadgeCheck className="h-4 w-4" aria-hidden />}
      />
    </form>
  );
}
