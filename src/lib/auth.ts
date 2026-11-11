import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./session";

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/inicio");
  return user;
}

export function isAdmin(user: Pick<SessionUser, "role"> | null | undefined): boolean {
  return user?.role === "ADMIN";
}
