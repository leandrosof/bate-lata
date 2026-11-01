import type { ZodError } from "zod";

export type ActionState =
  | {
      ok: boolean;
      message?: string;
      fieldErrors?: Record<string, string[]>;
      values?: Record<string, string>;
    }
  | null;

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

export function fail(message: string, fieldErrors?: Record<string, string[]>): ActionState {
  return { ok: false, message, fieldErrors };
}

export function success(message?: string): ActionState {
  return { ok: true, message };
}

export function zodFieldErrors(error: ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "_form";
    result[key] = [...(result[key] ?? []), issue.message];
  }
  return result;
}

export function firstZodMessage(error: ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

export function actionFailure(error: unknown): ActionState {
  if (error instanceof AppError) return fail(error.message);
  console.error("[action]", error);
  return fail("Não foi possível concluir a operação. Tente novamente.");
}
