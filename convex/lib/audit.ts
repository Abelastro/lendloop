import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { cleanText } from "./validation";

type AuditInput = {
  actorId?: Id<"users">;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
};

function sanitizeMetadata(metadata: AuditInput["metadata"]): string | undefined {
  if (!metadata) return undefined;
  const entries = Object.entries(metadata)
    .filter(([, value]) => value !== undefined)
    .slice(0, 12)
    .map(([key, value]) => [
      cleanText(key).slice(0, 40),
      typeof value === "string" ? cleanText(value).slice(0, 120) : value,
    ]);
  if (entries.length === 0) return undefined;
  return JSON.stringify(Object.fromEntries(entries));
}

export async function writeAudit(ctx: MutationCtx, input: AuditInput): Promise<void> {
  await ctx.db.insert("auditLogs", {
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: sanitizeMetadata(input.metadata),
    createdAt: Date.now(),
  });
}
