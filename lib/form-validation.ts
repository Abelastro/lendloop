import {
  MAX_LOAN_DAYS,
  MAX_LOAN_NOTE,
  MAX_TOOL_DESCRIPTION,
  MAX_TOOL_NAME,
} from "../convex/lib/constants";

export type ToolDraftErrors = {
  name?: string;
  description?: string;
};

export function validateToolDraft(input: {
  name: string;
  description: string;
}): ToolDraftErrors {
  const errors: ToolDraftErrors = {};
  const name = input.name.trim();
  const description = input.description.trim();

  if (name.length < 3) {
    errors.name = "Give the tool a name of at least 3 characters.";
  } else if (name.length > MAX_TOOL_NAME) {
    errors.name = `Keep the name to ${MAX_TOOL_NAME} characters or fewer.`;
  }

  if (description.length < 10) {
    errors.description = "Add a short description so neighbors know what to expect.";
  } else if (description.length > MAX_TOOL_DESCRIPTION) {
    errors.description = `Keep the description to ${MAX_TOOL_DESCRIPTION} characters or fewer.`;
  }

  return errors;
}

export type LoanDraftErrors = {
  startDate?: string;
  endDate?: string;
  note?: string;
};

export function validateLoanDraft(input: {
  startDate: string;
  endDate: string;
  note: string;
  today: string;
}): LoanDraftErrors {
  const errors: LoanDraftErrors = {};
  const start = Date.parse(`${input.startDate}T00:00:00Z`);
  const end = Date.parse(`${input.endDate}T00:00:00Z`);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    errors.startDate = "Choose a valid start and end date.";
    return errors;
  }

  if (input.startDate < input.today) {
    errors.startDate = "Pick a start date today or later.";
  }

  if (input.endDate < input.startDate) {
    errors.endDate = "The return date needs to be on or after the start date.";
  } else if ((end - start) / 86_400_000 + 1 > MAX_LOAN_DAYS) {
    errors.endDate = `Keep a request to ${MAX_LOAN_DAYS} days or fewer.`;
  }

  if (input.note.trim().length > MAX_LOAN_NOTE) {
    errors.note = `Keep the note to ${MAX_LOAN_NOTE} characters or fewer.`;
  }

  return errors;
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}
