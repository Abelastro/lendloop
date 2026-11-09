"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { ArrowSquareOut, SealCheck, Trash, Toolbox, User } from "@phosphor-icons/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { CONDITION_LABELS } from "@/convex/lib/constants";
import { getErrorMessage } from "@/lib/errors";
import type { ToolListItem } from "@/lib/types";
import { formatDay } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useViewer } from "./workspace";
import { RequestDialog } from "./request-dialog";
import { ToolFormDialog } from "./tool-form-dialog";

const conditionLabels = CONDITION_LABELS;

export function ToolCard({ tool }: { tool: ToolListItem }) {
  const viewer = useViewer();
  const removeTool = useMutation(api.tools.remove);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = viewer.role === "admin";

  const availability = tool.onLoanNow
    ? { label: "Out on loan", tone: "warning" as const }
    : tool.bookedUntil
      ? { label: `Booked to ${formatDay(tool.bookedUntil)}`, tone: "neutral" as const }
      : { label: "Available", tone: "moss" as const };

  async function handleRemove() {
    setError(null);
    setPending(true);
    try {
      await removeTool({ toolId: tool._id });
      toast.success("Listing removed.");
      setConfirmOpen(false);
    } catch (cause) {
      setError(getErrorMessage(cause, "We could not remove this listing."));
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="border-line bg-surface hover:border-faint/70 rounded-card flex h-full flex-col border p-5 transition">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="quiet">{tool.category}</Badge>
          <Badge>{conditionLabels[tool.condition]}</Badge>
        </div>
        <Badge tone={availability.tone}>{availability.label}</Badge>
      </div>

      <h2 className="mt-4 text-[17px] leading-6 font-semibold tracking-[-0.02em]">
        {tool.name}
      </h2>
      <p className="text-muted mt-2 line-clamp-3 flex-1 text-[13px] leading-6">
        {tool.description}
      </p>

      <div className="text-muted mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <User size={14} />
          {tool.ownerName}
        </span>
        {tool.ownerTrusted ? (
          <span className="text-moss inline-flex items-center gap-1">
            <SealCheck size={14} weight="fill" />
            Trusted lender
          </span>
        ) : null}
        {tool.isOwner && tool.pendingRequests > 0 ? (
          <span className="text-warning inline-flex items-center gap-1">
            <ArrowSquareOut size={14} />
            {tool.pendingRequests} pending
          </span>
        ) : null}
      </div>

      <div className="border-line mt-5 flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        {tool.isOwner ? (
          <>
            <Badge tone="quiet" className="mr-auto">
              <Toolbox size={13} />
              Your listing
            </Badge>
            <ToolFormDialog tool={tool} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              aria-label={`Remove ${tool.name}`}
            >
              <Trash size={15} />
              Remove
            </Button>
          </>
        ) : (
          <>
            {isAdmin ? (
              <Button
                variant="danger"
                size="sm"
                className="mr-auto"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash size={15} />
                Admin remove
              </Button>
            ) : null}
            {!tool.onLoanNow ? (
              <RequestDialog
                tool={{
                  _id: tool._id,
                  name: tool.name,
                  bookedUntil: tool.bookedUntil,
                }}
              />
            ) : (
              <p className="text-faint text-[11px]">Request it after it returns.</p>
            )}
          </>
        )}
      </div>

      <Modal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove this listing?"
        description={
          isAdmin && !tool.isOwner
            ? "This is an admin action. Pending requests for this tool will be declined."
            : "It will disappear from the board. Pending requests for it will be declined."
        }
      >
        <p className="text-muted text-sm leading-6">
          {tool.name} will stay in the audit trail, but neighbors can no longer request
          it.
        </p>
        {error ? <p className="text-clay mt-3 text-xs leading-5">{error}</p> : null}
        <div className="border-line mt-6 flex justify-end gap-2 border-t pt-5">
          <Button
            variant="ghost"
            onClick={() => setConfirmOpen(false)}
            disabled={pending}
          >
            Keep listing
          </Button>
          <Button
            variant="danger"
            onClick={() => void handleRemove()}
            disabled={pending}
          >
            {pending ? "Removing…" : "Remove listing"}
          </Button>
        </div>
      </Modal>
    </article>
  );
}
