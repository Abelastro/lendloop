import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { writeAudit } from "./lib/audit";
import { requireViewer } from "./lib/auth";
import type {
  ActivityDeliveryStatus,
  ActivityEventType,
  LoanStatus,
  ToolCategory,
} from "./lib/constants";
import { queueAutomationEvent } from "./lib/events";
import { enforceRequestRateLimit } from "./lib/rateLimit";
import { rangesOverlap, validateLoanRange, validateNote } from "./lib/validation";

type ActivityItem = {
  id: string;
  source: "automation" | "reminder";
  eventType: ActivityEventType;
  deliveryStatus: ActivityDeliveryStatus;
  channel?: string;
  createdAt: number;
};

async function loanActivity(
  ctx: Parameters<typeof requireViewer>[0],
  loanId: Doc<"loans">["_id"],
): Promise<ActivityItem[]> {
  const events = await ctx.db
    .query("automationEvents")
    .withIndex("by_loan", (q) => q.eq("loanId", loanId))
    .order("desc")
    .take(4);
  const reminders = await ctx.db
    .query("reminders")
    .withIndex("by_loan_sent_at", (q) => q.eq("loanId", loanId))
    .order("desc")
    .take(3);
  return [
    ...events.map((event) => ({
      id: event._id,
      source: "automation" as const,
      eventType: event.type,
      deliveryStatus: event.deliveryStatus,
      createdAt: event.deliveredAt ?? event.updatedAt,
    })),
    ...reminders.map((reminder) => ({
      id: reminder._id,
      source: "reminder" as const,
      eventType: "reminder.overdue" as const,
      deliveryStatus: reminder.status,
      channel: reminder.channel,
      createdAt: reminder.sentAt,
    })),
  ]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 4);
}

async function buildLoanCards(
  ctx: Parameters<typeof requireViewer>[0],
  loans: Doc<"loans">[],
) {
  const toolIds = [...new Set(loans.map((loan) => loan.toolId))];
  const userIds = [
    ...new Set(loans.flatMap((loan) => [loan.ownerId, loan.borrowerId])),
  ];
  const [tools, users] = await Promise.all([
    Promise.all(toolIds.map((id) => ctx.db.get(id))),
    Promise.all(userIds.map((id) => ctx.db.get(id))),
  ]);
  const toolMap = new Map(
    tools.filter((tool) => tool !== null).map((tool) => [tool!._id, tool!]),
  );
  const userMap = new Map(
    users.filter((user) => user !== null).map((user) => [user!._id, user!]),
  );
  const activity = await Promise.all(loans.map((loan) => loanActivity(ctx, loan._id)));

  return loans.map((loan, index) => {
    const tool = toolMap.get(loan.toolId);
    const owner = userMap.get(loan.ownerId);
    const borrower = userMap.get(loan.borrowerId);
    const toolCategory: ToolCategory = tool?.category ?? "Other";
    return {
      _id: loan._id,
      toolId: loan.toolId,
      toolName: tool?.name ?? "Removed listing",
      toolCategory,
      toolRemoved: tool?.isRemoved ?? true,
      ownerId: loan.ownerId,
      ownerName: owner?.name ?? "Neighbor",
      ownerTrusted: owner?.trustedLender ?? false,
      borrowerId: loan.borrowerId,
      borrowerName: borrower?.name ?? "Neighbor",
      borrowerTrusted: borrower?.trustedLender ?? false,
      startDate: loan.startDate,
      endDate: loan.endDate,
      status: loan.status,
      note: loan.note ?? null,
      createdAt: loan.createdAt,
      returnedAt: loan.returnedAt ?? null,
      activity: activity[index] ?? [],
    };
  });
}

export const listOutgoing = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", viewer._id))
      .order("desc")
      .take(50);
    return await buildLoanCards(ctx, loans);
  },
});

export const listIncoming = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_owner", (q) => q.eq("ownerId", viewer._id))
      .order("desc")
      .take(50);
    return await buildLoanCards(ctx, loans);
  },
});

export const request = mutation({
  args: {
    toolId: v.id("tools"),
    startDate: v.string(),
    endDate: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const tool = await ctx.db.get(args.toolId);
    if (!tool || tool.isRemoved) throw new ConvexError("This listing is unavailable.");
    if (tool.ownerId === viewer._id) {
      throw new ConvexError("You cannot request your own tool.");
    }
    validateLoanRange(args.startDate, args.endDate);
    const note = validateNote(args.note);
    await enforceRequestRateLimit(ctx, viewer._id);

    const toolLoans = await ctx.db
      .query("loans")
      .withIndex("by_tool", (q) => q.eq("toolId", tool._id))
      .take(150);
    const conflict = toolLoans.find(
      (loan) =>
        (loan.status === "pending" || loan.status === "approved") &&
        rangesOverlap(args.startDate, args.endDate, loan.startDate, loan.endDate),
    );
    if (conflict) {
      throw new ConvexError(
        "Those dates overlap another request. Try a different window.",
      );
    }

    const outgoing = await ctx.db
      .query("loans")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", viewer._id))
      .take(100);
    const borrowerConflict = outgoing.find(
      (loan) =>
        (loan.status === "pending" || loan.status === "approved") &&
        rangesOverlap(args.startDate, args.endDate, loan.startDate, loan.endDate),
    );
    if (borrowerConflict) {
      throw new ConvexError("You already have a request covering those dates.");
    }

    const owner = await ctx.db.get(tool.ownerId);
    if (!owner) throw new ConvexError("The lender is unavailable.");

    const now = Date.now();
    const loanId = await ctx.db.insert("loans", {
      toolId: tool._id,
      ownerId: tool.ownerId,
      borrowerId: viewer._id,
      startDate: args.startDate,
      endDate: args.endDate,
      status: "pending",
      note,
      createdAt: now,
      updatedAt: now,
    });
    const loan = await ctx.db.get(loanId);
    if (!loan) throw new Error("Loan creation failed.");

    await queueAutomationEvent(ctx, {
      loan,
      type: "request.created",
      actor: viewer,
      recipient: owner,
      toolName: tool.name,
    });
    await writeAudit(ctx, {
      actorId: viewer._id,
      action: "loan.requested",
      entityType: "loan",
      entityId: loanId,
      metadata: { toolId: tool._id },
    });
    return loanId;
  },
});

export const approve = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const loan = await ctx.db.get(args.loanId);
    if (!loan) throw new ConvexError("Request not found.");
    if (loan.ownerId !== viewer._id) {
      throw new ConvexError("Only the lender can approve this request.");
    }
    if (loan.status !== "pending") {
      throw new ConvexError("This request has already been handled.");
    }
    const tool = await ctx.db.get(loan.toolId);
    const borrower = await ctx.db.get(loan.borrowerId);
    if (!tool || !borrower) throw new ConvexError("Request details are unavailable.");

    const approved = await ctx.db
      .query("loans")
      .withIndex("by_tool_status", (q) =>
        q.eq("toolId", loan.toolId).eq("status", "approved"),
      )
      .take(100);
    const conflict = approved.find(
      (other) =>
        other._id !== loan._id &&
        rangesOverlap(loan.startDate, loan.endDate, other.startDate, other.endDate),
    );
    if (conflict) {
      throw new ConvexError(
        "Another approved loan already covers these dates. Decline this one instead.",
      );
    }

    const now = Date.now();
    await ctx.db.patch(loan._id, {
      status: "approved" satisfies LoanStatus,
      decidedAt: now,
      updatedAt: now,
    });
    await queueAutomationEvent(ctx, {
      loan: { ...loan, status: "approved" },
      type: "request.approved",
      actor: viewer,
      recipient: borrower,
      toolName: tool.name,
    });
    await writeAudit(ctx, {
      actorId: viewer._id,
      action: "loan.approved",
      entityType: "loan",
      entityId: loan._id,
    });
    return null;
  },
});

export const decline = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const loan = await ctx.db.get(args.loanId);
    if (!loan) throw new ConvexError("Request not found.");
    if (loan.ownerId !== viewer._id) {
      throw new ConvexError("Only the lender can decline this request.");
    }
    if (loan.status !== "pending") {
      throw new ConvexError("This request has already been handled.");
    }
    const tool = await ctx.db.get(loan.toolId);
    const borrower = await ctx.db.get(loan.borrowerId);
    if (!tool || !borrower) throw new ConvexError("Request details are unavailable.");

    const now = Date.now();
    await ctx.db.patch(loan._id, {
      status: "declined" satisfies LoanStatus,
      decidedAt: now,
      updatedAt: now,
    });
    await queueAutomationEvent(ctx, {
      loan: { ...loan, status: "declined" },
      type: "request.declined",
      actor: viewer,
      recipient: borrower,
      toolName: tool.name,
    });
    await writeAudit(ctx, {
      actorId: viewer._id,
      action: "loan.declined",
      entityType: "loan",
      entityId: loan._id,
    });
    return null;
  },
});

export const cancel = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const loan = await ctx.db.get(args.loanId);
    if (!loan) throw new ConvexError("Request not found.");
    if (loan.borrowerId !== viewer._id) {
      throw new ConvexError("Only the borrower can cancel this request.");
    }
    if (loan.status !== "pending" && loan.status !== "approved") {
      throw new ConvexError("This request can no longer be cancelled.");
    }
    const tool = await ctx.db.get(loan.toolId);
    const owner = await ctx.db.get(loan.ownerId);
    if (!tool || !owner) throw new ConvexError("Request details are unavailable.");

    const now = Date.now();
    await ctx.db.patch(loan._id, {
      status: "cancelled" satisfies LoanStatus,
      updatedAt: now,
    });
    await queueAutomationEvent(ctx, {
      loan: { ...loan, status: "cancelled" },
      type: "request.cancelled",
      actor: viewer,
      recipient: owner,
      toolName: tool.name,
    });
    await writeAudit(ctx, {
      actorId: viewer._id,
      action: "loan.cancelled",
      entityType: "loan",
      entityId: loan._id,
    });
    return null;
  },
});

export const markReturned = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const loan = await ctx.db.get(args.loanId);
    if (!loan) throw new ConvexError("Loan not found.");
    if (loan.ownerId !== viewer._id && loan.borrowerId !== viewer._id) {
      throw new ConvexError("Only the lender or borrower can close this loan.");
    }
    if (loan.status !== "approved") {
      throw new ConvexError("Only approved loans can be marked returned.");
    }
    const tool = await ctx.db.get(loan.toolId);
    const owner = await ctx.db.get(loan.ownerId);
    const borrower = await ctx.db.get(loan.borrowerId);
    if (!tool || !owner || !borrower) {
      throw new ConvexError("Loan details are unavailable.");
    }

    const now = Date.now();
    await ctx.db.patch(loan._id, {
      status: "returned" satisfies LoanStatus,
      returnedAt: now,
      returnedBy: viewer._id,
      updatedAt: now,
    });
    await queueAutomationEvent(ctx, {
      loan: { ...loan, status: "returned" },
      type: "loan.returned",
      actor: viewer,
      recipient: viewer._id === loan.ownerId ? borrower : owner,
      toolName: tool.name,
    });
    await writeAudit(ctx, {
      actorId: viewer._id,
      action: "loan.returned",
      entityType: "loan",
      entityId: loan._id,
    });
    return null;
  },
});
