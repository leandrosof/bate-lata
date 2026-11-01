import { redirect } from "next/navigation";
import type { User } from "@/db/schema";
import { getSessionUser } from "./session";

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/inicio");
  return user;
}

export function isAdmin(user: Pick<User, "role"> | null | undefined): boolean {
  return user?.role === "ADMIN";
}
