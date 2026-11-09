import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { todayISO } from "./lib/validation";

async function enrichLoan(ctx: Parameters<typeof requireAdmin>[0], loan: Doc<"loans">) {
  const [tool, owner, borrower] = await Promise.all([
    ctx.db.get(loan.toolId),
    ctx.db.get(loan.ownerId),
    ctx.db.get(loan.borrowerId),
  ]);
  return {
    toolName: tool?.name ?? "Removed listing",
    ownerName: owner?.name ?? "Unknown lender",
    borrowerName: borrower?.name ?? "Unknown borrower",
  };
}

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const today = todayISO();
    const [users, tools, pendingLoans, approvedLoans, incidents, failedEvents, audits] =
      await Promise.all([
        ctx.db.query("users").take(200),
        ctx.db
          .query("tools")
          .withIndex("by_active", (q) => q.eq("isRemoved", false))
          .take(200),
        ctx.db
          .query("loans")
          .withIndex("by_status", (q) => q.eq("status", "pending"))
          .take(200),
        ctx.db
          .query("loans")
          .withIndex("by_status", (q) => q.eq("status", "approved"))
          .take(200),
        ctx.db
          .query("automationIncidents")
          .withIndex("by_created_at")
          .order("desc")
          .take(30),
        ctx.db
          .query("automationEvents")
          .withIndex("by_delivery_status", (q) => q.eq("deliveryStatus", "failed"))
          .take(20),
        ctx.db.query("auditLogs").withIndex("by_created_at").order("desc").take(12),
      ]);
    const allLoans = await ctx.db
      .query("loans")
      .withIndex("by_created_at")
      .order("desc")
      .take(200);

    const activeLoans = approvedLoans.filter(
      (loan) => loan.startDate <= today && loan.endDate >= today,
    );
    const overdueLoans = approvedLoans.filter((loan) => loan.endDate < today);
    const enrichedLoans = await Promise.all(
      allLoans.map(async (loan) => ({
        ...loan,
        ...(await enrichLoan(ctx, loan)),
      })),
    );

    return {
      stats: {
        users: users.length,
        lenders: users.filter((user) => user.trustedLender).length,
        activeTools: tools.length,
        pendingRequests: pendingLoans.length,
        activeLoans: activeLoans.length,
        overdueLoans: overdueLoans.length,
      },
      lenders: users
        .filter((user) => user.trustedLender)
        .map((user) => ({
          _id: user._id,
          name: user.name,
          email: user.email,
          trustedLender: user.trustedLender,
        }))
        .slice(0, 12),
      members: users
        .slice()
        .sort(
          (a, b) =>
            Number(b.trustedLender) - Number(a.trustedLender) ||
            a.name.localeCompare(b.name),
        )
        .map((user) => ({
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          trustedLender: user.trustedLender,
          createdAt: user.createdAt,
        })),
      incidents: incidents.filter((incident) => incident.resolvedAt === undefined),
      failedEvents,
      recentLoans: enrichedLoans,
      audits,
    };
  },
});

export const resolveIncident = mutation({
  args: { incidentId: v.id("automationIncidents") },
  handler: async (ctx, args) => {
    const viewer = await requireAdmin(ctx);
    const incident = await ctx.db.get(args.incidentId);
    if (!incident) return null;
    await ctx.db.patch(incident._id, {
      resolvedAt: Date.now(),
      resolvedBy: viewer._id,
    });
    return null;
  },
});
