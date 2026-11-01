"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { loginAction } from "@/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/submit-button";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

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
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <FieldError>{state?.fieldErrors?.email?.[0]}</FieldError>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <Label htmlFor="password" required className="mb-0">
            Senha
          </Label>
          <Link href="/recuperar-senha" className="text-xs font-medium text-[#7fa2ff] hover:text-white">
            Esqueci a senha
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Sua senha"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <FieldError>{state?.fieldErrors?.password?.[0]}</FieldError>
      </div>

      {state && !state.ok && state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      <Button type="submit" size="lg" block disabled={pending}>
        {pending ? <Spinner /> : <LogIn className="h-4 w-4" aria-hidden />}
        {pending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
