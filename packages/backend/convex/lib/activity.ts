import type { Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"

export type ActivityKind =
  | "draft.created"
  | "draft.sent"
  | "draft.joined"
  | "draft.countering"
  | "draft.rejected"
  | "draft.cancelled"
  | "draft.accepted"
  | "contract.cancelled"
  | "contract.completed"
  | "payment.processing"
  | "payment.failed"
  | "payment.succeeded"
  | "milestone.started"
  | "milestone.submitted"
  | "milestone.changesRequested"
  | "milestone.approved"
  | "payout.paid"

export async function logActivity(
  ctx: MutationCtx,
  entry: {
    draftId?: Id<"drafts">
    contractId?: Id<"contracts">
    actorId?: Id<"users">
    kind: ActivityKind
    data?: Record<string, string | number>
  },
) {
  await ctx.db.insert("activity", entry)
}
