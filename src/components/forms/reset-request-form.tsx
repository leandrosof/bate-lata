"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { requestPasswordResetAction } from "@/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/submit-button";

export function ResetRequestForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="email" required>
          E-mail cadastrado
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          placeholder="voce@email.com"
          required
        />
        <FieldError>{state?.fieldErrors?.email?.[0]}</FieldError>
        <FieldHint>Enviaremos um link válido por 1 hora para criar uma nova senha.</FieldHint>
      </div>

      {state?.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}
      {state && !state.ok && state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? <Spinner /> : <MailCheck className="h-4 w-4" aria-hidden />}
        {pending ? "Enviando..." : "Enviar link de redefinição"}
      </Button>
    </form>
  );
}
