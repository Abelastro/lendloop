import type { Doc, Id } from "@/convex/_generated/dataModel";
import type {
  ActivityDeliveryStatus,
  ActivityEventType,
  LoanStatus,
  ToolCategory,
  ToolCondition,
} from "@/convex/lib/constants";

export type Viewer = Doc<"users">;

export type ActivityItem = {
  id: string;
  source: "automation" | "reminder";
  eventType: ActivityEventType;
  deliveryStatus: ActivityDeliveryStatus;
  channel?: string;
  createdAt: number;
};

export type ToolListItem = {
  _id: Id<"tools">;
  name: string;
  category: ToolCategory;
  condition: ToolCondition;
  description: string;
  ownerId: Id<"users">;
  ownerName: string;
  ownerTrusted: boolean;
  isOwner: boolean;
  bookedUntil: string | null;
  onLoanNow: boolean;
  pendingRequests: number;
  createdAt: number;
};

export type MyTool = {
  _id: Id<"tools">;
  name: string;
  category: ToolCategory;
  condition: ToolCondition;
  description: string;
  pendingCount: number;
  onLoan: boolean;
  nextReturn: string | null;
  createdAt: number;
};

export type LoanCardData = {
  _id: Id<"loans">;
  toolId: Id<"tools">;
  toolName: string;
  toolCategory: ToolCategory;
  toolRemoved: boolean;
  ownerId: Id<"users">;
  ownerName: string;
  ownerTrusted: boolean;
  borrowerId: Id<"users">;
  borrowerName: string;
  borrowerTrusted: boolean;
  startDate: string;
  endDate: string;
  status: LoanStatus;
  note: string | null;
  createdAt: number;
  returnedAt: number | null;
  activity: ActivityItem[];
};
