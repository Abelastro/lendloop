import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const REPLAY_TTL_MS = 15 * 60_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

export const beginSignedRequest = internalMutation({
  args: {
    key: v.string(),
    route: v.string(),
    applyReplay: v.boolean(),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const bucket = `${args.route}:${Math.floor(now / RATE_LIMIT_WINDOW_MS)}`;
    const rate = await ctx.db
      .query("webhookRateLimits")
      .withIndex("by_bucket", (q) => q.eq("bucket", bucket))
      .unique();
    if (rate && rate.count >= RATE_LIMIT_MAX) {
      return { ok: false as const, reason: "rate_limited" as const };
    }
    if (rate) {
      await ctx.db.patch(rate._id, { count: rate.count + 1, updatedAt: now });
    } else {
      await ctx.db.insert("webhookRateLimits", { bucket, count: 1, updatedAt: now });
    }

    if (!args.applyReplay) {
      return { ok: true as const, key: args.key };
    }

    const existing = await ctx.db
      .query("signedRequestReplays")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (existing) {
      if (existing.status === "completed") {
        return { ok: false as const, reason: "duplicate" as const };
      }
      if (existing.status === "processing") {
        return { ok: false as const, reason: "in_progress" as const };
      }
      await ctx.db.patch(existing._id, {
        status: "processing",
        updatedAt: now,
        expiresAt: now + REPLAY_TTL_MS,
      });
      return { ok: true as const, key: args.key };
    }

    await ctx.db.insert("signedRequestReplays", {
      key: args.key,
      route: args.route,
      status: "processing",
      createdAt: now,
      updatedAt: now,
      expiresAt: now + REPLAY_TTL_MS,
    });
    return { ok: true as const, key: args.key };
  },
});

export const finishSignedRequest = internalMutation({
  args: {
    key: v.string(),
    status: v.union(v.literal("completed"), v.literal("failed")),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const existing = await ctx.db
      .query("signedRequestReplays")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (!existing) return false;
    await ctx.db.patch(existing._id, {
      status: args.status,
      updatedAt: now,
      expiresAt: now + REPLAY_TTL_MS,
    });
    return true;
  },
});

export const pruneGuards = internalMutation({
  args: { now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const expired = await ctx.db
      .query("signedRequestReplays")
      .withIndex("by_expires_at", (q) => q.lt("expiresAt", now))
      .take(20);
    for (const row of expired) {
      await ctx.db.delete(row._id);
    }
    return expired.length;
  },
});
