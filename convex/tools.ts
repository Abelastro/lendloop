import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { writeAudit } from "./lib/audit";
import { requireViewer } from "./lib/auth";
import type { LoanStatus } from "./lib/constants";
import { queueAutomationEvent } from "./lib/events";
import { enforceListingRateLimit } from "./lib/rateLimit";
import {
  isToolCategory,
  todayISO,
  validateCategory,
  validateCondition,
  validateToolDescription,
  validateToolName,
} from "./lib/validation";

async function loanStateByTool(
  ctx: Parameters<typeof requireViewer>[0],
): Promise<
  Map<string, { bookedUntil: string | null; onLoan: boolean; pending: number }>
> {
  const today = todayISO();
  const loans = await ctx.db
    .query("loans")
    .withIndex("by_status", (q) => q.eq("status", "approved"))
    .take(300);
  const pending = await ctx.db
    .query("loans")
    .withIndex("by_status", (q) => q.eq("status", "pending"))
    .take(300);

  const state = new Map<
    string,
    { bookedUntil: string | null; onLoan: boolean; pending: number }
  >();
  for (const loan of loans) {
    if (loan.endDate < today) continue;
    const current = state.get(loan.toolId) ?? {
      bookedUntil: null,
      onLoan: false,
      pending: 0,
    };
    state.set(loan.toolId, {
      bookedUntil:
        !current.bookedUntil || loan.endDate > current.bookedUntil
          ? loan.endDate
          : current.bookedUntil,
      onLoan: current.onLoan || (loan.startDate <= today && loan.endDate >= today),
      pending: current.pending,
    });
  }
  for (const loan of pending) {
    const current = state.get(loan.toolId) ?? {
      bookedUntil: null,
      onLoan: false,
      pending: 0,
    };
    state.set(loan.toolId, { ...current, pending: current.pending + 1 });
  }
  return state;
}

export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_active", (q) => q.eq("isRemoved", false))
      .take(80);
    const today = todayISO();
    const approved = await ctx.db
      .query("loans")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .take(300);
    const onLoanNow = new Set(
      approved
        .filter((loan) => loan.startDate <= today && loan.endDate >= today)
        .map((loan) => loan.toolId),
    );
    return tools
      .filter((tool) => !onLoanNow.has(tool._id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 18)
      .map((tool) => ({ name: tool.name, category: tool.category }));
  },
});

export const list = query({
  args: { category: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const category =
      args.category && isToolCategory(args.category) ? args.category : undefined;
    let tools: Doc<"tools">[];
    if (category) {
      tools = await ctx.db
        .query("tools")
        .withIndex("by_category", (q) => q.eq("category", category))
        .take(200);
      tools = tools.filter((tool) => !tool.isRemoved);
    } else {
      tools = await ctx.db
        .query("tools")
        .withIndex("by_active", (q) => q.eq("isRemoved", false))
        .take(200);
    }

    const state = await loanStateByTool(ctx);
    const ownerIds = [...new Set(tools.map((tool) => tool.ownerId))];
    const owners = await Promise.all(ownerIds.map((id) => ctx.db.get(id)));
    const ownerMap = new Map(
      owners.filter((owner) => owner !== null).map((owner) => [owner!._id, owner!]),
    );

    return tools
      .map((tool) => {
        const loanState = state.get(tool._id);
        const owner = ownerMap.get(tool.ownerId);
        return {
          _id: tool._id,
          name: tool.name,
          category: tool.category,
          condition: tool.condition,
          description: tool.description,
          ownerId: tool.ownerId,
          ownerName: owner?.name ?? "Neighbor",
          ownerTrusted: owner?.trustedLender ?? false,
          isOwner: tool.ownerId === viewer._id,
          bookedUntil: loanState?.bookedUntil ?? null,
          onLoanNow: loanState?.onLoan ?? false,
          pendingRequests: loanState?.pending ?? 0,
          createdAt: tool.createdAt,
        };
      })
      .sort(
        (a, b) =>
          Number(a.onLoanNow) - Number(b.onLoanNow) || b.createdAt - a.createdAt,
      );
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await requireViewer(ctx);
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_owner_active", (q) =>
        q.eq("ownerId", viewer._id).eq("isRemoved", false),
      )
      .take(50);

    return await Promise.all(
      tools.map(async (tool) => {
        const loans = await ctx.db
          .query("loans")
          .withIndex("by_tool", (q) => q.eq("toolId", tool._id))
          .take(100);
        const pendingCount = loans.filter((loan) => loan.status === "pending").length;
        const approved = loans.filter((loan) => loan.status === "approved");
        const today = todayISO();
        const onLoan = approved.some(
          (loan) => loan.startDate <= today && loan.endDate >= today,
        );
        const nextReturn =
          approved
            .map((loan) => loan.endDate)
            .filter((endDate) => endDate >= today)
            .sort()[0] ?? null;
        return {
          _id: tool._id,
          name: tool.name,
          category: tool.category,
          condition: tool.condition,
          description: tool.description,
          pendingCount,
          onLoan,
          nextReturn,
          createdAt: tool.createdAt,
        };
      }),
    ).then((items) => items.sort((a, b) => b.createdAt - a.createdAt));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    category: v.string(),
    condition: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    await enforceListingRateLimit(ctx, viewer._id);
    const name = validateToolName(args.name);
    const category = validateCategory(args.category);
    const condition = validateCondition(args.condition);
    const description = validateToolDescription(args.description);
    const now = Date.now();
    const toolId = await ctx.db.insert("tools", {
      ownerId: viewer._id,
      name,
      category,
      condition,
      description,
      isRemoved: false,
      createdAt: now,
      updatedAt: now,
    });
    await writeAudit(ctx, {
      actorId: viewer._id,
      action: "tool.created",
      entityType: "tool",
      entityId: toolId,
      metadata: { category },
    });
    return toolId;
  },
});

export const update = mutation({
  args: {
    toolId: v.id("tools"),
    name: v.string(),
    category: v.string(),
    condition: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const tool = await ctx.db.get(args.toolId);
    if (!tool || tool.isRemoved) throw new ConvexError("Listing not found.");
    if (tool.ownerId !== viewer._id) {
      throw new ConvexError("You can only edit your own listings.");
    }
    const name = validateToolName(args.name);
    const category = validateCategory(args.category);
    const condition = validateCondition(args.condition);
    const description = validateToolDescription(args.description);
    await ctx.db.patch(tool._id, {
      name,
      category,
      condition,
      description,
      updatedAt: Date.now(),
    });
    await writeAudit(ctx, {
      actorId: viewer._id,
      action: "tool.updated",
      entityType: "tool",
      entityId: tool._id,
    });
    return null;
  },
});

export const remove = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    const tool = await ctx.db.get(args.toolId);
    if (!tool || tool.isRemoved) throw new ConvexError("Listing not found.");
    const isAdmin = viewer.role === "admin";
    if (tool.ownerId !== viewer._id && !isAdmin) {
      throw new ConvexError("You can only remove your own listings.");
    }

    const now = Date.now();
    await ctx.db.patch(tool._id, {
      isRemoved: true,
      removedAt: now,
      removedBy: viewer._id,
      updatedAt: now,
    });

    const pendingLoans = await ctx.db
      .query("loans")
      .withIndex("by_tool_status", (q) =>
        q.eq("toolId", tool._id).eq("status", "pending"),
      )
      .take(50);
    for (const loan of pendingLoans) {
      await ctx.db.patch(loan._id, {
        status: "declined" satisfies LoanStatus,
        decidedAt: now,
        updatedAt: now,
      });
      const borrower = await ctx.db.get(loan.borrowerId);
      if (borrower) {
        await queueAutomationEvent(ctx, {
          loan: { ...loan, status: "declined" },
          type: "request.declined",
          actor: viewer,
          recipient: borrower,
          toolName: tool.name,
        });
      }
    }

    await writeAudit(ctx, {
      actorId: viewer._id,
      action:
        isAdmin && tool.ownerId !== viewer._id ? "tool.removed_admin" : "tool.removed",
      entityType: "tool",
      entityId: tool._id,
      metadata: { declinedRequests: pendingLoans.length },
    });
    return null;
  },
});
