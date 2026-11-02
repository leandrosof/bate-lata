"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { resendVerificationAction } from "@/actions/auth";
import { Alert } from "@/components/ui/alert";
import { FieldError, Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export function ResendVerificationForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [state, formAction] = useActionState(resendVerificationAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="verification-email" required>
          E-mail do cadastro
        </Label>
        <Input
          id="verification-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          defaultValue={defaultEmail}
          placeholder="voce@email.com"
          required
        />
        <FieldError>{state?.fieldErrors?.email?.[0]}</FieldError>
      </div>

      {state ? (
        <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
      ) : null}

      <SubmitButton
        label="Reenviar confirmação"
        pendingLabel="Enviando..."
        size="lg"
        block
        icon={<MailCheck className="h-4 w-4" aria-hidden />}
      />
    </form>
  );
}
