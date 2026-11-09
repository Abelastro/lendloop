import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";

const DAY = 86_400_000;

function isoDay(offset: number) {
  return new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
}

type ToolCategory = Doc<"tools">["category"];
type ToolCondition = Doc<"tools">["condition"];
type LoanStatus = Doc<"loans">["status"];

export const seedDemoData = internalMutation({
  args: {
    users: v.array(
      v.object({
        clerkId: v.string(),
        email: v.string(),
        name: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    if (args.users.length < 3) {
      throw new Error("Demo seeding needs at least three users.");
    }

    const now = Date.now();
    const userIds: Doc<"users">["_id"][] = [];

    for (const [index, input] of args.users.entries()) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", input.clerkId))
        .unique();
      const role = index === 0 ? ("admin" as const) : ("user" as const);
      const trustedLender = index === 1;

      if (existing) {
        await ctx.db.patch(existing._id, {
          email: input.email,
          name: input.name,
          role: index === 0 ? "admin" : existing.role,
          trustedLender: trustedLender || existing.trustedLender,
          updatedAt: now,
        });
        userIds.push(existing._id);
        continue;
      }

      userIds.push(
        await ctx.db.insert("users", {
          clerkId: input.clerkId,
          email: input.email,
          name: input.name,
          role,
          trustedLender,
          createdAt: now,
          updatedAt: now,
        }),
      );
    }

    const adminId = userIds[0]!;
    const lenderId = userIds[1]!;
    const borrowerId = userIds[2]!;
    const admin = (await ctx.db.get(adminId))!;
    const lender = (await ctx.db.get(lenderId))!;
    const borrower = (await ctx.db.get(borrowerId))!;

    const demoTools: Doc<"tools">[] = [];
    for (const userId of userIds) {
      const owned = await ctx.db
        .query("tools")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .collect();
      demoTools.push(...owned);
    }

    const loanIds = new Set<Doc<"loans">["_id"]>();
    for (const tool of demoTools) {
      const loans = await ctx.db
        .query("loans")
        .withIndex("by_tool", (q) => q.eq("toolId", tool._id))
        .collect();
      for (const loan of loans) loanIds.add(loan._id);
    }
    for (const userId of userIds) {
      const borrowed = await ctx.db
        .query("loans")
        .withIndex("by_borrower", (q) => q.eq("borrowerId", userId))
        .collect();
      for (const loan of borrowed) loanIds.add(loan._id);
    }

    for (const loanId of loanIds) {
      const reminders = await ctx.db
        .query("reminders")
        .withIndex("by_loan", (q) => q.eq("loanId", loanId))
        .collect();
      for (const reminder of reminders) await ctx.db.delete(reminder._id);
      const events = await ctx.db
        .query("automationEvents")
        .withIndex("by_loan", (q) => q.eq("loanId", loanId))
        .collect();
      for (const event of events) await ctx.db.delete(event._id);
      const audits = await ctx.db
        .query("auditLogs")
        .withIndex("by_entity", (q) =>
          q.eq("entityType", "loan").eq("entityId", loanId),
        )
        .collect();
      for (const audit of audits) await ctx.db.delete(audit._id);
      await ctx.db.delete(loanId);
    }

    for (const tool of demoTools) {
      const audits = await ctx.db
        .query("auditLogs")
        .withIndex("by_entity", (q) =>
          q.eq("entityType", "tool").eq("entityId", tool._id),
        )
        .collect();
      for (const audit of audits) await ctx.db.delete(audit._id);
      await ctx.db.delete(tool._id);
    }

    const incidentKey = "demo-incident-1";
    const priorIncident = await ctx.db
      .query("automationIncidents")
      .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", incidentKey))
      .unique();
    if (priorIncident) await ctx.db.delete(priorIncident._id);

    async function addTool(
      ownerId: Doc<"tools">["ownerId"],
      name: string,
      category: ToolCategory,
      condition: ToolCondition,
      description: string,
      createdAt: number,
    ) {
      const toolId = await ctx.db.insert("tools", {
        ownerId,
        name,
        category,
        condition,
        description,
        isRemoved: false,
        createdAt,
        updatedAt: createdAt,
      });
      await ctx.db.insert("auditLogs", {
        actorId: ownerId,
        action: "tool.created",
        entityType: "tool",
        entityId: toolId,
        metadata: JSON.stringify({ category }),
        createdAt,
      });
      return toolId;
    }

    const drill = await addTool(
      adminId,
      "Cordless drill",
      "Power tools",
      "good",
      "18V drill with two batteries, a charger, and a bit set. Great for shelves and flat-pack furniture.",
      now - 12 * DAY,
    );
    const ladder = await addTool(
      adminId,
      "Extension ladder",
      "Garden & yard",
      "fair",
      "Aluminium extension ladder, about 3 metres fully open. Light enough for one person to carry.",
      now - 11 * DAY,
    );
    const loppers = await addTool(
      adminId,
      "Garden loppers",
      "Garden & yard",
      "good",
      "Long-handled bypass loppers for branches up to about 4 cm. Freshly sharpened.",
      now - 9 * DAY,
    );
    await addTool(
      adminId,
      "Orbit sander",
      "Power tools",
      "like_new",
      "Random orbit sander with a stack of 120 and 240 grit discs. Dust bag included.",
      now - 8 * DAY,
    );
    const stove = await addTool(
      lenderId,
      "Camp stove",
      "Outdoor & camping",
      "like_new",
      "Two-burner propane stove with a hose and regulator. Used for one weekend trip.",
      now - 7 * DAY,
    );
    const mixer = await addTool(
      lenderId,
      "Stand mixer",
      "Home & kitchen",
      "good",
      "Five-quart stand mixer with the paddle, whisk, and dough hook. Please hand-wash the bowl.",
      now - 6 * DAY,
    );
    const tent = await addTool(
      lenderId,
      "Two-person tent",
      "Outdoor & camping",
      "good",
      "Three-season backpacking tent. Lightweight, with footprint and repair kit.",
      now - 5 * DAY,
    );
    await addTool(
      borrowerId,
      "Socket wrench set",
      "Hand tools",
      "good",
      "Metric and imperial sockets in a molded case, plus a breaker bar and extensions.",
      now - 4 * DAY,
    );

    async function addLoan(input: {
      toolId: Doc<"loans">["toolId"];
      ownerId: Doc<"loans">["ownerId"];
      borrowerId: Doc<"loans">["borrowerId"];
      startDate: string;
      endDate: string;
      status: LoanStatus;
      note?: string;
      createdAt: number;
      decidedAt?: number;
      returnedAt?: number;
      returnedBy?: Doc<"loans">["returnedBy"];
    }) {
      const loanId = await ctx.db.insert("loans", {
        ...input,
        updatedAt: input.decidedAt ?? input.createdAt,
      });
      return loanId;
    }

    const drillLoan = await addLoan({
      toolId: drill,
      ownerId: adminId,
      borrowerId,
      startDate: isoDay(-1),
      endDate: isoDay(2),
      status: "approved",
      note: "Building a bookshelf this weekend. I can pick it up Friday evening.",
      createdAt: now - 2 * DAY,
      decidedAt: now - 2 * DAY + 3_600_000,
    });

    const ladderLoan = await addLoan({
      toolId: ladder,
      ownerId: adminId,
      borrowerId,
      startDate: isoDay(-6),
      endDate: isoDay(-2),
      status: "approved",
      note: "Clearing the gutters before the rain.",
      createdAt: now - 7 * DAY,
      decidedAt: now - 7 * DAY + 3_600_000,
    });

    const stoveLoan = await addLoan({
      toolId: stove,
      ownerId: lenderId,
      borrowerId,
      startDate: isoDay(3),
      endDate: isoDay(6),
      status: "pending",
      note: "Camping at the lake next weekend. Happy to leave a deposit.",
      createdAt: now - 4 * 3_600_000,
    });

    const mixerLoan = await addLoan({
      toolId: mixer,
      ownerId: lenderId,
      borrowerId,
      startDate: isoDay(-20),
      endDate: isoDay(-16),
      status: "returned",
      note: "Birthday cake project. Returned clean with the attachments boxed.",
      createdAt: now - 21 * DAY,
      decidedAt: now - 21 * DAY + 2 * 3_600_000,
      returnedAt: now - 16 * DAY,
      returnedBy: borrowerId,
    });

    await addLoan({
      toolId: tent,
      ownerId: lenderId,
      borrowerId,
      startDate: isoDay(10),
      endDate: isoDay(12),
      status: "declined",
      note: "Hoping to try a weekend at the coast.",
      createdAt: now - 5 * DAY,
      decidedAt: now - 4 * DAY,
    });

    await addLoan({
      toolId: loppers,
      ownerId: adminId,
      borrowerId: lenderId,
      startDate: isoDay(1),
      endDate: isoDay(3),
      status: "pending",
      note: "The hedge along the back fence has got away from me.",
      createdAt: now - 2 * 3_600_000,
    });

    await ctx.db.insert("automationEvents", {
      loanId: drillLoan,
      type: "request.approved",
      idempotencyKey: `request.approved:${drillLoan}`,
      actorId: adminId,
      actorName: admin.name,
      recipientId: borrowerId,
      recipientName: borrower.name,
      toolName: "Cordless drill",
      startDate: isoDay(-1),
      endDate: isoDay(2),
      loanStatus: "approved",
      deliveryStatus: "delivered",
      workflow: "request-notifications",
      attempts: 1,
      createdAt: now - 2 * DAY + 3_600_000,
      updatedAt: now - 2 * DAY + 3_660_000,
      deliveredAt: now - 2 * DAY + 3_660_000,
    });

    await ctx.db.insert("automationEvents", {
      loanId: stoveLoan,
      type: "request.created",
      idempotencyKey: `request.created:${stoveLoan}`,
      actorId: borrowerId,
      actorName: borrower.name,
      recipientId: lenderId,
      recipientName: lender.name,
      toolName: "Camp stove",
      startDate: isoDay(3),
      endDate: isoDay(6),
      loanStatus: "pending",
      deliveryStatus: "delivered",
      workflow: "request-notifications",
      attempts: 1,
      createdAt: now - 4 * 3_600_000,
      updatedAt: now - 4 * 3_600_000 + 60_000,
      deliveredAt: now - 4 * 3_600_000 + 60_000,
    });

    await ctx.db.insert("automationEvents", {
      loanId: mixerLoan,
      type: "loan.returned",
      idempotencyKey: `loan.returned:${mixerLoan}`,
      actorId: borrowerId,
      actorName: borrower.name,
      recipientId: lenderId,
      recipientName: lender.name,
      toolName: "Stand mixer",
      startDate: isoDay(-20),
      endDate: isoDay(-16),
      loanStatus: "returned",
      deliveryStatus: "delivered",
      workflow: "request-notifications",
      attempts: 1,
      createdAt: now - 16 * DAY,
      updatedAt: now - 16 * DAY + 60_000,
      deliveredAt: now - 16 * DAY + 60_000,
    });

    await ctx.db.insert("reminders", {
      loanId: ladderLoan,
      dedupeKey: `overdue:${ladderLoan}:${isoDay(0)}`,
      channel: "mock",
      recipientId: borrowerId,
      status: "sent",
      sentAt: now - 2 * 3_600_000,
      providerMessageId: "mock-overdue-ladder-demo",
      createdAt: now - 2 * 3_600_000,
    });

    await ctx.db.insert("automationIncidents", {
      idempotencyKey: incidentKey,
      workflow: "daily-overdue-reminders",
      executionId: "demo-execution-1",
      node: "Send email reminder",
      message:
        "Demo incident: the email provider timed out. The write-back retry is queued and no data was lost.",
      createdAt: now - 90 * 60_000,
    });

    await ctx.db.insert("auditLogs", {
      actorId: adminId,
      action: "loan.approved",
      entityType: "loan",
      entityId: drillLoan,
      createdAt: now - 2 * DAY + 3_600_000,
    });
    await ctx.db.insert("auditLogs", {
      actorId: adminId,
      action: "lender.trusted",
      entityType: "user",
      entityId: lenderId,
      createdAt: now - 3 * DAY,
    });

    return {
      users: userIds.length,
      tools: demoTools.length + 8,
      loans: 6,
    };
  },
});
