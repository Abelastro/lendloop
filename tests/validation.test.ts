import { describe, expect, it } from "vitest";
import {
  isValidISODate,
  rangesOverlap,
  validateLoanRange,
  validateToolName,
} from "../convex/lib/validation";

function iso(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

describe("date handling", () => {
  it("accepts real calendar dates and rejects impossible ones", () => {
    expect(isValidISODate("2024-02-29")).toBe(true);
    expect(isValidISODate("2026-02-29")).toBe(false);
    expect(isValidISODate("2026-13-01")).toBe(false);
    expect(isValidISODate("2026-1-01")).toBe(false);
  });

  it("detects overlapping inclusive ranges", () => {
    expect(rangesOverlap("2026-05-01", "2026-05-04", "2026-05-04", "2026-05-08")).toBe(
      true,
    );
    expect(rangesOverlap("2026-05-01", "2026-05-03", "2026-05-04", "2026-05-08")).toBe(
      false,
    );
  });

  it("accepts a normal future range", () => {
    expect(() => validateLoanRange(iso(1), iso(4))).not.toThrow();
  });

  it("rejects past, inverted, and overlong ranges", () => {
    expect(() => validateLoanRange(iso(-1), iso(2))).toThrow(/past/i);
    expect(() => validateLoanRange(iso(3), iso(2))).toThrow(/on or after/i);
    expect(() => validateLoanRange(iso(1), iso(61))).toThrow(/60 days/i);
  });
});

describe("listing validation", () => {
  it("trims and normalizes tool names", () => {
    expect(validateToolName("  Garden   hoe  ")).toBe("Garden hoe");
  });

  it("rejects short and oversized names", () => {
    expect(() => validateToolName("ab")).toThrow(/3 to 80/i);
    expect(() => validateToolName("x".repeat(81))).toThrow(/3 to 80/i);
  });
});
