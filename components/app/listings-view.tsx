"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  CalendarCheck,
  SealCheck,
  Toolbox,
  Trash,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { CONDITION_LABELS } from "@/convex/lib/constants";
import { getErrorMessage } from "@/lib/errors";
import type { MyTool } from "@/lib/types";
import { formatDay } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "./empty-state";
import { PageHeader } from "./page-header";
import { ToolFormDialog } from "./tool-form-dialog";
import { useViewer } from "./workspace";

function ListingRow({ tool }: { tool: MyTool }) {
  const removeTool = useMutation(api.tools.remove);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove() {
    setPending(true);
    setError(null);
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
    <article className="border-line bg-surface rounded-card border p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="quiet">{tool.category}</Badge>
            <Badge>{CONDITION_LABELS[tool.condition]}</Badge>
            {tool.onLoan ? <Badge tone="warning">On loan</Badge> : null}
            {tool.pendingCount > 0 ? (
              <Badge tone="moss">{tool.pendingCount} pending</Badge>
            ) : null}
          </div>
          <h2 className="mt-3 text-[17px] font-semibold tracking-[-0.02em]">
            {tool.name}
          </h2>
          <p className="text-muted mt-1.5 max-w-2xl text-[13px] leading-6">
            {tool.description}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-end sm:self-start">
          <ToolFormDialog tool={tool} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            aria-label={`Remove ${tool.name}`}
          >
            <Trash size={15} />
            <span className="hidden sm:inline">Remove</span>
          </Button>
        </div>
      </div>

      <div className="border-line text-muted mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-4 text-[12px]">
        <span className="inline-flex items-center gap-1.5">
          <SealCheck size={15} className="text-moss" />
          Listed by you
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarCheck size={15} />
          {tool.onLoan
            ? "Currently with a neighbor"
            : tool.nextReturn
              ? `Next return ${formatDay(tool.nextReturn)}`
              : "Not on loan"}
        </span>
        {tool.pendingCount > 0 ? (
          <Link
            href="/app/incoming"
            className="text-moss ml-auto inline-flex items-center gap-1 font-medium hover:gap-2"
          >
            Review requests
            <ArrowRight size={14} weight="bold" />
          </Link>
        ) : null}
      </div>

      <Modal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove this listing?"
        description="It will disappear from the public board. Pending requests for it will be declined."
      >
        <p className="text-muted text-sm leading-6">
          {tool.name} will stay in the audit trail, but neighbors can no longer request
          it. You can list it again later.
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

export function ListingsView() {
  const viewer = useViewer();
  const tools = useQuery(api.tools.listMine);

  return (
    <div className="space-y-7">
      <PageHeader
        title="My listings"
        description="What you've put into the loop. Keep descriptions honest and availability accurate."
        action={<ToolFormDialog />}
      />

      {tools && tools.length > 0 ? (
        <div className="border-line bg-surface text-muted rounded-field flex flex-wrap items-center gap-2 border px-4 py-3 text-xs">
          <span className="text-ink font-medium">{tools.length}</span> active listings
          <span className="text-line">·</span>
          <span className="inline-flex items-center gap-1.5">
            <SealCheck
              size={15}
              className={viewer.trustedLender ? "text-moss" : "text-faint"}
            />
            {viewer.trustedLender
              ? "Trusted lender"
              : "Build trust by returning on time"}
          </span>
        </div>
      ) : null}

      {!tools ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="border-line bg-surface rounded-card h-36 border p-5"
            >
              <div className="bg-sunken h-5 w-24 rounded-full" />
              <div className="bg-sunken mt-4 h-4 w-1/3 rounded-full" />
              <div className="bg-sunken/70 mt-3 h-3 w-2/3 rounded-full" />
            </div>
          ))}
        </div>
      ) : tools.length === 0 ? (
        <EmptyState
          icon={Toolbox}
          title="Your shelf is empty."
          body="List the drill, ladder, or tent that mostly lives in storage. You decide who borrows it and when."
          action={<ToolFormDialog />}
        />
      ) : (
        <div className="space-y-3">
          {tools.map((tool) => (
            <ListingRow key={tool._id} tool={tool} />
          ))}
        </div>
      )}
    </div>
  );
}
