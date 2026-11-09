import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { AutomationEventType } from "./constants";

type QueueEventInput = {
  loan: Doc<"loans">;
  type: AutomationEventType;
  actor: Doc<"users">;
  recipient: Doc<"users">;
  toolName: string;
};

export async function queueAutomationEvent(
  ctx: MutationCtx,
  input: QueueEventInput,
): Promise<void> {
  const idempotencyKey = `${input.type}:${input.loan._id}`;
  const existing = await ctx.db
    .query("automationEvents")
    .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", idempotencyKey))
    .unique();
  if (existing) return;

  const now = Date.now();
  const eventId = await ctx.db.insert("automationEvents", {
    loanId: input.loan._id,
    type: input.type,
    idempotencyKey,
    actorId: input.actor._id,
    actorName: input.actor.name,
    recipientId: input.recipient._id,
    recipientName: input.recipient.name,
    toolName: input.toolName,
    startDate: input.loan.startDate,
    endDate: input.loan.endDate,
    loanStatus: input.loan.status,
    deliveryStatus: "pending",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  });

  await ctx.scheduler.runAfter(0, internal.automations.deliverEvent, { eventId });
}

export async function recipientForStatus(
  ctx: MutationCtx,
  loan: Doc<"loans">,
  type: QueueEventInput["type"],
): Promise<{ recipient: Doc<"users">; actor: Doc<"users"> }> {
  const actorId =
    type === "request.created" || type === "request.cancelled"
      ? loan.borrowerId
      : type === "loan.returned"
        ? (loan.returnedBy ?? loan.ownerId)
        : loan.ownerId;
  const actor = await ctx.db.get(actorId);
  const recipientId =
    type === "request.created" || type === "request.cancelled"
      ? loan.ownerId
      : loan.borrowerId;
  const recipient = await ctx.db.get(recipientId);
  if (!actor || !recipient) {
    throw new Error("Could not resolve loan participants.");
  }
  return { actor, recipient };
}
