import { ConvexError } from "convex/values";
import {
  CATEGORIES,
  CONDITIONS,
  MAX_LOAN_DAYS,
  MAX_LOAN_NOTE,
  MAX_TOOL_DESCRIPTION,
  MAX_TOOL_NAME,
  type ToolCategory,
  type ToolCondition,
} from "./constants";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function isValidISODate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return false;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetween(start: string, end: string): number {
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  return Math.round((endMs - startMs) / 86_400_000);
}

export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function validateLoanRange(startDate: string, endDate: string): void {
  if (!isValidISODate(startDate) || !isValidISODate(endDate)) {
    throw new ConvexError("Choose valid start and end dates.");
  }
  if (startDate < todayISO()) {
    throw new ConvexError("The start date cannot be in the past.");
  }
  if (endDate < startDate) {
    throw new ConvexError("The end date must be on or after the start date.");
  }
  if (daysBetween(startDate, endDate) + 1 > MAX_LOAN_DAYS) {
    throw new ConvexError(`Loans can run for at most ${MAX_LOAN_DAYS} days.`);
  }
}

export function validateToolName(name: string): string {
  const cleaned = cleanText(name);
  if (cleaned.length < 3 || cleaned.length > MAX_TOOL_NAME) {
    throw new ConvexError(`Tool names must be 3 to ${MAX_TOOL_NAME} characters.`);
  }
  return cleaned;
}

export function validateToolDescription(description: string): string {
  const cleaned = description.trim();
  if (cleaned.length < 10 || cleaned.length > MAX_TOOL_DESCRIPTION) {
    throw new ConvexError(
      `Descriptions must be 10 to ${MAX_TOOL_DESCRIPTION} characters.`,
    );
  }
  return cleaned;
}

export function validateNote(note: string | undefined): string | undefined {
  if (!note) return undefined;
  const cleaned = note.trim();
  if (cleaned.length > MAX_LOAN_NOTE) {
    throw new ConvexError(`Notes must be ${MAX_LOAN_NOTE} characters or fewer.`);
  }
  return cleaned || undefined;
}

export function isToolCategory(value: string): value is ToolCategory {
  return CATEGORIES.some((category) => category === value);
}

function isToolCondition(value: string): value is ToolCondition {
  return CONDITIONS.some((condition) => condition === value);
}

export function validateCategory(category: string): ToolCategory {
  if (!isToolCategory(category)) {
    throw new ConvexError("Choose a valid tool category.");
  }
  return category;
}

export function validateCondition(condition: string): ToolCondition {
  if (!isToolCondition(condition)) {
    throw new ConvexError("Choose a valid tool condition.");
  }
  return condition;
}
