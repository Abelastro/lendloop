import { describe, expect, it } from "vitest";

import {
  hasErrors,
  validateLoanDraft,
  validateToolDraft,
} from "../lib/form-validation";
import {
  MAX_LOAN_DAYS,
  MAX_LOAN_NOTE,
  MAX_TOOL_DESCRIPTION,
  MAX_TOOL_NAME,
} from "../convex/lib/constants";

describe("validateToolDraft", () => {
  it("accepts a complete tool draft", () => {
    const errors = validateToolDraft({
      name: "Cordless drill",
      description: "Includes two batteries and a full bit set.",
    });
    expect(errors).toEqual({});
    expect(hasErrors(errors)).toBe(false);
  });

  it("rejects names that are too short or too long", () => {
    expect(
      validateToolDraft({ name: "ab", description: "Long enough text" }).name,
    ).toBeDefined();
    expect(
      validateToolDraft({
        name: "a".repeat(MAX_TOOL_NAME + 1),
        description: "Long enough text",
      }).name,
    ).toBeDefined();
  });

  it("rejects descriptions that are too short or too long", () => {
    expect(
      validateToolDraft({ name: "Cordless drill", description: "short" }).description,
    ).toBeDefined();
    expect(
      validateToolDraft({
        name: "Cordless drill",
        description: "a".repeat(MAX_TOOL_DESCRIPTION + 1),
      }).description,
    ).toBeDefined();
  });

  it("trims whitespace before measuring length", () => {
    const errors = validateToolDraft({
      name: "  Saw  ",
      description: "     A fine pull saw.     ",
    });
    expect(errors).toEqual({});
  });
});

describe("validateLoanDraft", () => {
  const today = "2026-11-06";
  const valid = {
    startDate: "2026-11-07",
    endDate: "2026-11-08",
    note: "Weekend project.",
    today,
  };

  it("accepts a valid request", () => {
    const errors = validateLoanDraft(valid);
    expect(errors).toEqual({});
    expect(hasErrors(errors)).toBe(false);
  });

  it("rejects a start date in the past", () => {
    const errors = validateLoanDraft({ ...valid, startDate: "2026-11-01" });
    expect(errors.startDate).toMatch(/today or later/i);
  });

  it("rejects an inverted range", () => {
    const errors = validateLoanDraft({
      ...valid,
      startDate: "2026-11-10",
      endDate: "2026-11-08",
    });
    expect(errors.endDate).toMatch(/on or after/i);
  });

  it("rejects ranges longer than the maximum", () => {
    const end = new Date(Date.parse(`${today}T00:00:00Z`));
    end.setUTCDate(end.getUTCDate() + MAX_LOAN_DAYS);
    const errors = validateLoanDraft({
      startDate: today,
      endDate: end.toISOString().slice(0, 10),
      note: "",
      today,
    });
    expect(errors.endDate).toMatch(new RegExp(`${MAX_LOAN_DAYS} days`));
  });

  it("rejects an overlong note", () => {
    const errors = validateLoanDraft({
      ...valid,
      note: "a".repeat(MAX_LOAN_NOTE + 1),
    });
    expect(errors.note).toBeDefined();
  });

  it("rejects malformed dates", () => {
    const errors = validateLoanDraft({ ...valid, startDate: "not-a-date" });
    expect(errors.startDate).toMatch(/valid start and end date/i);
  });
});
