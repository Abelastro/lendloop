import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type ViewerContext = QueryCtx | MutationCtx;

export async function getViewer(ctx: ViewerContext): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

export async function requireViewer(ctx: ViewerContext): Promise<Doc<"users">> {
  const viewer = await getViewer(ctx);
  if (!viewer) {
    throw new ConvexError("Sign in and finish setting up your profile first.");
  }
  return viewer;
}

export async function requireAdmin(ctx: ViewerContext): Promise<Doc<"users">> {
  const viewer = await requireViewer(ctx);
  if (viewer.role !== "admin") {
    throw new ConvexError("Admin access required.");
  }
  return viewer;
}

export function verifiedEmail(identity: {
  email?: string | null;
  emailVerified?: boolean | null;
}): string {
  if (!identity.email) {
    throw new ConvexError(
      "Your Clerk session is missing an email claim. Enable the Convex JWT template with an email claim.",
    );
  }
  if (identity.emailVerified !== true) {
    throw new ConvexError("Verify your email address before continuing.");
  }
  return identity.email.trim().toLowerCase();
}

export function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}
