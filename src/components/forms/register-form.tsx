"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { registerAction } from "@/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/submit-button";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="name" required>
          Nome completo
        </Label>
        <Input id="name" name="name" autoComplete="name" placeholder="Como você é chamado no grupo" required maxLength={80} />
        <FieldError>{state?.fieldErrors?.name?.[0]}</FieldError>
      </div>

      <div>
        <Label htmlFor="email" required>
          E-mail
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
      </div>

      <div>
        <Label htmlFor="password" required>
          Senha
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
        <FieldHint>Use pelo menos 8 caracteres. Senhas são armazenadas com hash seguro.</FieldHint>
      </div>

      <div>
        <Label htmlFor="confirmPassword" required>
          Confirmar senha
        </Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Repita a senha"
          required
        />
        <FieldError>{state?.fieldErrors?.confirmPassword?.[0]}</FieldError>
      </div>

      {state && !state.ok && state.message && !state.fieldErrors ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? <Spinner /> : <UserPlus className="h-4 w-4" aria-hidden />}
        {pending ? "Criando conta..." : "Criar minha conta"}
      </Button>
    </form>
  );
}
