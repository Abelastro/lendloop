import type { LoanStatus } from "@/convex/lib/constants";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/utils";

const tones = {
  pending: "warning",
  approved: "moss",
  declined: "clay",
  cancelled: "neutral",
  returned: "quiet",
} as const;

export function StatusBadge({ status }: { status: LoanStatus }) {
  const tone = tones[status] ?? "neutral";
  return <Badge tone={tone}>{STATUS_LABELS[status]}</Badge>;
}
