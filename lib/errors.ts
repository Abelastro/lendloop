import { ConvexError } from "convex/values";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong.",
): string {
  if (error instanceof ConvexError) {
    if (typeof error.data === "string" && error.data.trim()) return error.data;
    if (isRecord(error.data) && typeof error.data.message === "string") {
      return error.data.message;
    }
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
