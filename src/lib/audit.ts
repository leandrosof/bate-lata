import { db } from "@/db/client";
import { auditLogs } from "@/db/schema";

export async function recordAudit(input: {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
}) {
  try {
    await db.insert(auditLogs).values({
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      details: input.details ?? null,
    });
  } catch (error) {
    console.error("[audit]", error);
  }
}
