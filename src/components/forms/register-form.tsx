"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { registerAction } from "@/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/submit-button";

export function RegisterForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(registerAction, null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
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
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Mínimo de 8 caracteres"
            className="pr-11"
            required
            minLength={8}
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            title={showPassword ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition hover:bg-ink/5 hover:text-ink"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
        <FieldError>{state?.fieldErrors?.password?.[0]}</FieldError>
        <FieldHint>Use pelo menos 8 caracteres. Senhas são armazenadas com hash seguro.</FieldHint>
      </div>

      <div>
        <Label htmlFor="confirmPassword" required>
          Confirmar senha
        </Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Repita a senha"
            className="pr-11"
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((visible) => !visible)}
            aria-label={showConfirmPassword ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
            title={showConfirmPassword ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition hover:bg-ink/5 hover:text-ink"
          >
            {showConfirmPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
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
