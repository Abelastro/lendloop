import { ConvexError, v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { adminEmails, getViewer, requireAdmin, verifiedEmail } from "./lib/auth";
import { writeAudit } from "./lib/audit";

export const getById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    return { name: user.name, email: user.email };
  },
});

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    return await getViewer(ctx);
  },
});

export const ensureViewer = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Sign in to continue.");
    }
    const email = verifiedEmail(identity);
    const now = Date.now();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    const displayName =
      identity.name?.trim() ||
      identity.nickname?.trim() ||
      email.split("@")[0] ||
      "Neighbor";
    const imageUrl = identity.pictureUrl ?? undefined;
    const shouldBeAdmin = adminEmails().has(email);

    if (existing) {
      const role = shouldBeAdmin ? "admin" : existing.role;
      if (
        existing.email !== email ||
        existing.name !== displayName ||
        existing.imageUrl !== imageUrl ||
        existing.role !== role
      ) {
        await ctx.db.patch(existing._id, {
          email,
          name: displayName,
          imageUrl,
          role,
          updatedAt: now,
        });
        return {
          ...existing,
          email,
          name: displayName,
          imageUrl,
          role,
          updatedAt: now,
        };
      }
      return existing;
    }

    const userId = await ctx.db.insert("users", {
      clerkId: identity.subject,
      email,
      name: displayName,
      imageUrl,
      role: shouldBeAdmin ? "admin" : "user",
      trustedLender: false,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(userId);
  },
});

export const setTrustedLender = mutation({
  args: {
    userId: v.id("users"),
    trusted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const viewer = await requireAdmin(ctx);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new ConvexError("Member not found.");
    await ctx.db.patch(args.userId, {
      trustedLender: args.trusted,
      updatedAt: Date.now(),
    });
    await writeAudit(ctx, {
      actorId: viewer._id,
      action: args.trusted ? "lender.trusted" : "lender.untrusted",
      entityType: "user",
      entityId: args.userId,
    });
    return null;
  },
});
