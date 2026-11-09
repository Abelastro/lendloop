import { relativeTime } from "@/lib/utils";
import type { ActivityEventType } from "@/convex/lib/constants";
import type { ActivityItem } from "@/lib/types";

const eventLabels: Record<ActivityEventType, string> = {
  "request.created": "Request notification",
  "request.approved": "Approval notification",
  "request.declined": "Decline notification",
  "request.cancelled": "Cancellation notification",
  "loan.returned": "Return notification",
  "reminder.overdue": "Reminder",
};

function deliveryLabel(item: ActivityItem): string {
  if (item.source === "reminder") {
    return item.deliveryStatus === "sent" ? "sent" : "failed";
  }
  if (item.deliveryStatus === "delivered") return "sent";
  if (item.deliveryStatus === "pending") return "queued";
  if (item.deliveryStatus === "skipped") return "not sent";
  return "failed";
}

export function ActivityLine({ item }: { item: ActivityItem }) {
  const label = eventLabels[item.eventType];
  const delivery = deliveryLabel(item);

  return (
    <p className="text-faint flex items-start gap-2 text-[11px] leading-5">
      <span
        className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
          delivery === "failed" ? "bg-clay" : "bg-moss/70"
        }`}
        aria-hidden
      />
      <span>
        <span className="text-muted">{label}</span> {delivery}
        <span aria-hidden> · </span>
        {relativeTime(item.createdAt)}
      </span>
    </p>
  );
}
