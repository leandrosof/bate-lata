"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { resetPasswordAction } from "@/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/submit-button";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div>
        <Label htmlFor="password" required>
          Nova senha
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Mínimo de 8 caracteres"
          required
          minLength={8}
        />
        <FieldError>{state?.fieldErrors?.password?.[0]}</FieldError>
        <FieldHint>Depois de salvar, todos os dispositivos serão desconectados.</FieldHint>
      </div>

      <div>
        <Label htmlFor="confirmPassword" required>
          Confirmar nova senha
        </Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Repita a nova senha"
          required
        />
        <FieldError>{state?.fieldErrors?.confirmPassword?.[0]}</FieldError>
      </div>

      {state && !state.ok && state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? <Spinner /> : <KeyRound className="h-4 w-4" aria-hidden />}
        {pending ? "Salvando..." : "Criar nova senha"}
      </Button>
    </form>
  );
}
