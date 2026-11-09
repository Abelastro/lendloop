import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  MAX_ACTIVE_LISTINGS,
  MAX_LISTINGS_PER_HOUR,
  MAX_PENDING_REQUESTS,
  MAX_REQUESTS_PER_HOUR,
  REQUEST_WINDOW_MS,
} from "./constants";

export async function enforceListingRateLimit(
  ctx: MutationCtx,
  ownerId: Id<"users">,
): Promise<void> {
  const active = await ctx.db
    .query("tools")
    .withIndex("by_owner_active", (q) =>
      q.eq("ownerId", ownerId).eq("isRemoved", false),
    )
    .take(MAX_ACTIVE_LISTINGS);

  if (active.length >= MAX_ACTIVE_LISTINGS) {
    throw new ConvexError(`You can keep up to ${MAX_ACTIVE_LISTINGS} active listings.`);
  }

  const cutoff = Date.now() - REQUEST_WINDOW_MS;
  const recent = await ctx.db
    .query("tools")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .order("desc")
    .take(MAX_LISTINGS_PER_HOUR);
  const oldestRecent = recent[recent.length - 1];
  if (
    recent.length >= MAX_LISTINGS_PER_HOUR &&
    oldestRecent &&
    oldestRecent.createdAt >= cutoff
  ) {
    throw new ConvexError("You are listing tools too quickly. Try again later.");
  }
}

export async function enforceRequestRateLimit(
  ctx: MutationCtx,
  borrowerId: Id<"users">,
): Promise<void> {
  const pending = await ctx.db
    .query("loans")
    .withIndex("by_borrower_status", (q) =>
      q.eq("borrowerId", borrowerId).eq("status", "pending"),
    )
    .take(MAX_PENDING_REQUESTS);

  if (pending.length >= MAX_PENDING_REQUESTS) {
    throw new ConvexError(
      `You can have ${MAX_PENDING_REQUESTS} open requests. Cancel one first.`,
    );
  }

  const cutoff = Date.now() - REQUEST_WINDOW_MS;
  const recent = await ctx.db
    .query("loans")
    .withIndex("by_borrower", (q) => q.eq("borrowerId", borrowerId))
    .order("desc")
    .take(MAX_REQUESTS_PER_HOUR);
  const oldestRecent = recent[recent.length - 1];
  if (
    recent.length >= MAX_REQUESTS_PER_HOUR &&
    oldestRecent &&
    oldestRecent.createdAt >= cutoff
  ) {
    throw new ConvexError("You are requesting tools too quickly. Try again later.");
  }
}
