"use client";

import { useState, type FormEvent } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { CalendarBlank, PaperPlaneTilt } from "@phosphor-icons/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { MAX_LOAN_DAYS, MAX_LOAN_NOTE } from "@/convex/lib/constants";
import { getErrorMessage } from "@/lib/errors";
import {
  hasErrors,
  validateLoanDraft,
  type LoanDraftErrors,
} from "@/lib/form-validation";
import { addDaysISO, formatDay, todayInputValue } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";

export function RequestDialog({
  tool,
}: {
  tool: { _id: Id<"tools">; name: string; bookedUntil: string | null };
}) {
  const requestLoan = useMutation(api.loans.request);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<LoanDraftErrors>({});

  const today = todayInputValue();
  const firstFree =
    tool.bookedUntil && tool.bookedUntil >= today
      ? addDaysISO(tool.bookedUntil, 1)
      : today;
  const defaultStart = firstFree;
  const defaultEnd = addDaysISO(firstFree, 3);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [note, setNote] = useState("");

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setStartDate(defaultStart);
      setEndDate(defaultEnd);
      setNote("");
      setFormError(null);
      setFieldErrors({});
    } else {
      setFormError(null);
      setFieldErrors({});
      setPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const trimmedNote = note.trim();
    const errors = validateLoanDraft({
      startDate,
      endDate,
      note: trimmedNote,
      today,
    });
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    setPending(true);
    try {
      await requestLoan({
        toolId: tool._id,
        startDate,
        endDate,
        note: trimmedNote || undefined,
      });
      toast.success("Request sent. We'll notify the lender.");
      setOpen(false);
    } catch (cause) {
      setFormError(getErrorMessage(cause, "We could not send this request."));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => handleOpenChange(true)}
        aria-haspopup="dialog"
      >
        <CalendarBlank size={15} aria-hidden />
        Request
      </Button>
      <Modal
        open={open}
        onOpenChange={handleOpenChange}
        title={`Request ${tool.name}`}
        description="Pick the days you need. The lender approves before anything is confirmed."
      >
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {tool.bookedUntil && tool.bookedUntil >= today ? (
            <p className="border-line bg-sunken/65 text-muted rounded-field border px-3.5 py-3 text-xs leading-5">
              Already booked through {formatDay(tool.bookedUntil)}. We&apos;ve started
              you on the next free day.
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="loan-start">From</Label>
              <Input
                id="loan-start"
                name="startDate"
                type="date"
                min={today}
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
                aria-invalid={Boolean(fieldErrors.startDate)}
                aria-describedby={
                  fieldErrors.startDate ? "loan-start-error" : "loan-dates-hint"
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loan-end">Until</Label>
              <Input
                id="loan-end"
                name="endDate"
                type="date"
                min={startDate}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                required
                aria-invalid={Boolean(fieldErrors.endDate)}
                aria-describedby={
                  fieldErrors.endDate ? "loan-end-error" : "loan-dates-hint"
                }
              />
            </div>
          </div>
          {fieldErrors.startDate ? (
            <FieldError id="loan-start-error">{fieldErrors.startDate}</FieldError>
          ) : null}
          {fieldErrors.endDate ? (
            <FieldError id="loan-end-error">{fieldErrors.endDate}</FieldError>
          ) : null}
          <FieldHint id="loan-dates-hint">
            Pick a start date today or later, up to {MAX_LOAN_DAYS} days.
          </FieldHint>

          <div className="space-y-2">
            <Label htmlFor="loan-note" hint={`${note.length}/${MAX_LOAN_NOTE}`}>
              Note to the lender
            </Label>
            <Textarea
              id="loan-note"
              name="note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={MAX_LOAN_NOTE}
              placeholder="I'm building a raised garden bed and can pick it up Saturday."
              aria-invalid={Boolean(fieldErrors.note)}
              aria-describedby={fieldErrors.note ? "loan-note-error" : "loan-note-hint"}
            />
            {fieldErrors.note ? (
              <FieldError id="loan-note-error">{fieldErrors.note}</FieldError>
            ) : (
              <FieldHint id="loan-note-hint">
                Optional, up to {MAX_LOAN_NOTE} characters.
              </FieldHint>
            )}
          </div>

          <FieldError id="loan-form-error">{formError}</FieldError>

          <div className="border-line flex justify-end gap-2 border-t pt-5">
            <Button
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Not now
            </Button>
            <Button type="submit" disabled={pending}>
              <PaperPlaneTilt size={16} weight="bold" aria-hidden />
              {pending ? "Sending…" : "Send request"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
