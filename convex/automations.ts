import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { AUTOMATION_MAX_ATTEMPTS, REMINDER_DEDUPE_WINDOW_MS } from "./lib/constants";
import { createSignatureHeaders } from "./lib/crypto";
import { getOutboundSigningKey, n8nWebhookUrl, notificationRouting } from "./lib/env";
import { isValidISODate } from "./lib/validation";

function sanitizeText(value: unknown, maxLength = 300): string {
  const message = value instanceof Error ? value.message : String(value);
  return message
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(
      /\b(?:xox[baprs]-|sk_(?:live|test)_)[A-Za-z0-9_-]+\b/gi,
      "[redacted-token]",
    )
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function sanitizeError(error: unknown): string {
  return sanitizeText(error, 300);
}

function retryDelayMs(attempts: number): number {
  return Math.min(2 ** attempts * 60_000, 30 * 60_000);
}

export const getEvent = internalQuery({
  args: { eventId: v.id("automationEvents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.eventId);
  },
});

export const recordDelivery = internalMutation({
  args: {
    eventId: v.id("automationEvents"),
    status: v.union(v.literal("delivered"), v.literal("failed"), v.literal("skipped")),
    error: v.optional(v.string()),
    workflow: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new ConvexError("Automation event not found.");
    const now = Date.now();
    const attempts = event.attempts + 1;
    await ctx.db.patch(event._id, {
      deliveryStatus: args.status,
      attempts,
      lastError: args.error,
      workflow: args.workflow ?? event.workflow,
      deliveredAt: args.status === "delivered" ? now : event.deliveredAt,
      updatedAt: now,
    });
    return { attempts };
  },
});

export const deliverEvent = internalAction({
  args: { eventId: v.id("automationEvents") },
  handler: async (ctx, args) => {
    const event = await ctx.runQuery(internal.automations.getEvent, {
      eventId: args.eventId,
    });
    if (!event) return;
    if (event.deliveryStatus === "delivered" || event.deliveryStatus === "skipped") {
      return;
    }

    const webhook = n8nWebhookUrl();
    if (!webhook) {
      await ctx.runMutation(internal.automations.recordDelivery, {
        eventId: args.eventId,
        status: "skipped",
        error: "N8N_WEBHOOK_URL is not configured.",
      });
      return;
    }

    const outboundKey = getOutboundSigningKey();
    if (!outboundKey) {
      await ctx.runMutation(internal.automations.recordDelivery, {
        eventId: args.eventId,
        status: "failed",
        error: "N8N_OUTBOUND_SECRET is not configured.",
        workflow: "request-notifications",
      });
      return;
    }

    let recipientEmail: string | undefined;
    if (notificationRouting() === "email") {
      const recipient = await ctx.runQuery(internal.users.getById, {
        userId: event.recipientId,
      });
      recipientEmail = recipient?.email;
    }

    const body = JSON.stringify({
      id: event.idempotencyKey,
      type: event.type,
      occurredAt: new Date().toISOString(),
      actor: { name: event.actorName },
      recipient: { name: event.recipientName, email: recipientEmail },
      tool: { name: event.toolName },
      loan: {
        id: event.loanId,
        startDate: event.startDate,
        endDate: event.endDate,
        status: event.loanStatus,
      },
    });

    try {
      const headers = await createSignatureHeaders(
        outboundKey,
        body,
        event.idempotencyKey,
      );
      const response = await fetch(webhook, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new Error(`n8n responded with HTTP ${response.status}`);
      }
      await ctx.runMutation(internal.automations.recordDelivery, {
        eventId: args.eventId,
        status: "delivered",
        workflow: "request-notifications",
      });
    } catch (error) {
      const result = await ctx.runMutation(internal.automations.recordDelivery, {
        eventId: args.eventId,
        status: "failed",
        error: sanitizeError(error),
        workflow: "request-notifications",
      });
      if (result.attempts < AUTOMATION_MAX_ATTEMPTS) {
        await ctx.scheduler.runAfter(
          retryDelayMs(result.attempts),
          internal.automations.deliverEvent,
          { eventId: args.eventId },
        );
      }
    }
  },
});

export const overdueLoans = internalQuery({
  args: {
    today: v.string(),
    since: v.number(),
    includeEmail: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_status_end_date", (q) =>
        q.eq("status", "approved").lt("endDate", args.today),
      )
      .take(100);

    const todayMs = Date.parse(`${args.today}T00:00:00Z`);
    const rows = await Promise.all(
      loans.map(async (loan) => {
        const alreadySent = await ctx.db
          .query("reminders")
          .withIndex("by_dedupe_key", (q) =>
            q.eq("dedupeKey", `overdue:${loan._id}:${args.today}`),
          )
          .unique();
        if (alreadySent) return null;
        const recentlySent = await ctx.db
          .query("reminders")
          .withIndex("by_loan_sent_at", (q) =>
            q.eq("loanId", loan._id).gte("sentAt", args.since),
          )
          .first();
        if (recentlySent) return null;
        const tool = await ctx.db.get(loan.toolId);
        const borrower = await ctx.db.get(loan.borrowerId);
        const owner = await ctx.db.get(loan.ownerId);
        if (!tool || !borrower || !owner) return null;
        const endMs = Date.parse(`${loan.endDate}T00:00:00Z`);
        return {
          loanId: loan._id,
          toolName: tool.name,
          borrowerName: borrower.name,
          borrowerEmail: args.includeEmail ? borrower.email : undefined,
          ownerName: owner.name,
          endDate: loan.endDate,
          daysOverdue: Math.max(0, Math.round((todayMs - endMs) / 86_400_000)),
        };
      }),
    );
    return {
      date: args.today,
      loans: rows.filter((row) => row !== null),
    };
  },
});

export const recordReminders = internalMutation({
  args: {
    date: v.optional(v.string()),
    reminders: v.array(
      v.object({
        loanId: v.string(),
        channel: v.string(),
        status: v.union(v.literal("sent"), v.literal("failed")),
        sentAt: v.optional(v.number()),
        providerMessageId: v.optional(v.string()),
        error: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    if (args.reminders.length > 100) {
      throw new ConvexError("Too many reminder results in one batch.");
    }
    const today = new Date().toISOString().slice(0, 10);
    const runDate = args.date && isValidISODate(args.date) ? args.date : today;
    let accepted = 0;
    let skipped = 0;
    const now = Date.now();

    for (const reminder of args.reminders) {
      const loanId = ctx.db.normalizeId("loans", reminder.loanId);
      if (!loanId) {
        skipped += 1;
        continue;
      }
      const loan = await ctx.db.get(loanId);
      if (!loan || loan.status !== "approved") {
        skipped += 1;
        continue;
      }
      const dedupeKey = `overdue:${loanId}:${runDate}`;
      const existing = await ctx.db
        .query("reminders")
        .withIndex("by_dedupe_key", (q) => q.eq("dedupeKey", dedupeKey))
        .unique();
      if (existing) {
        skipped += 1;
        continue;
      }
      const recentlySent = await ctx.db
        .query("reminders")
        .withIndex("by_loan_sent_at", (q) =>
          q.eq("loanId", loanId).gte("sentAt", now - REMINDER_DEDUPE_WINDOW_MS),
        )
        .first();
      if (recentlySent) {
        skipped += 1;
        continue;
      }
      const channel =
        reminder.channel === "slack" ||
        reminder.channel === "email" ||
        reminder.channel === "mock"
          ? reminder.channel
          : "unknown";
      await ctx.db.insert("reminders", {
        loanId,
        dedupeKey,
        channel,
        recipientId: loan.borrowerId,
        status: reminder.status,
        sentAt:
          typeof reminder.sentAt === "number" &&
          Math.abs(now - reminder.sentAt) < 10 * 60_000
            ? reminder.sentAt
            : now,
        providerMessageId: reminder.providerMessageId?.slice(0, 120),
        error: reminder.error ? sanitizeText(reminder.error) : undefined,
        createdAt: now,
      });
      accepted += 1;
    }

    return { accepted, skipped };
  },
});

export const recordIncident = internalMutation({
  args: {
    workflow: v.string(),
    executionId: v.string(),
    node: v.optional(v.string()),
    message: v.string(),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const executionId = args.executionId.trim().slice(0, 120);
    if (!executionId) throw new ConvexError("Execution ID is required.");
    const idempotencyKey =
      args.idempotencyKey?.trim().slice(0, 120) || `incident:${executionId}`;
    const existing = await ctx.db
      .query("automationIncidents")
      .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", idempotencyKey))
      .unique();
    if (existing) return existing._id;

    const incidentId = await ctx.db.insert("automationIncidents", {
      idempotencyKey,
      workflow: args.workflow.trim().slice(0, 120) || "unknown-workflow",
      executionId,
      node: args.node?.trim().slice(0, 120),
      message: sanitizeText(args.message, 500) || "Unspecified failure",
      createdAt: Date.now(),
    });
    return incidentId;
  },
});

export const failedEvents = internalQuery({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db
      .query("automationEvents")
      .withIndex("by_delivery_status", (q) => q.eq("deliveryStatus", "failed"))
      .order("desc")
      .take(20);
    return events.map((event: Doc<"automationEvents">) => ({
      _id: event._id,
      type: event.type,
      toolName: event.toolName,
      attempts: event.attempts,
      lastError: event.lastError ?? null,
      updatedAt: event.updatedAt,
    }));
  },
});
