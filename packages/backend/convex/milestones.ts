import { v } from "convex/values"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { internalMutation, internalQuery, mutation } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import { logActivity } from "./lib/activity"
import { fail } from "./lib/errors"
import { requireUser } from "./lib/auth"
import { proofFile } from "./schema"

export const MAX_PROOF_FILES = 10

/** S3 key prefix a freelancer is allowed to upload proof files into. */
export function proofPrefix(
  contractId: Id<"contracts">,
  milestoneId: Id<"milestones">,
  userId: Id<"users">,
) {
  return `contracts/${contractId}/milestones/${milestoneId}/${userId}/`
}

async function loadMilestone(ctx: MutationCtx, milestoneId: Id<"milestones">) {
  const user = await requireUser(ctx)
  const milestone = await ctx.db.get(milestoneId)
  const contract = milestone && (await ctx.db.get(milestone.contractId))
  if (!milestone || !contract) fail("milestone.notFound")
  if (contract.freelancerId !== user._id && contract.contractorId !== user._id) {
    fail("milestone.notFound")
  }
  if (contract.status !== "active") {
    fail("contract.notActive")
  }
  return { user, milestone, contract }
}

export const start = mutation({
  args: { milestoneId: v.id("milestones") },
  handler: async (ctx, { milestoneId }) => {
    const { user, milestone, contract } = await loadMilestone(ctx, milestoneId)
    if (contract.freelancerId !== user._id) fail("milestone.onlyFreelancer")
    if (milestone.status !== "pending") fail("milestone.alreadyStarted")
    await ctx.db.patch(milestone._id, { status: "in_progress" })
    await logActivity(ctx, {
      contractId: contract._id,
      actorId: user._id,
      kind: "milestone.started",
      data: { name: milestone.name },
    })
  },
})

export const submit = mutation({
  args: {
    milestoneId: v.id("milestones"),
    note: v.string(),
    files: v.array(proofFile),
  },
  handler: async (ctx, { milestoneId, note, files }) => {
    const { user, milestone, contract } = await loadMilestone(ctx, milestoneId)
    if (contract.freelancerId !== user._id) {
      fail("milestone.onlyFreelancer")
    }
    if (!["pending", "in_progress", "changes_requested"].includes(milestone.status)) {
      fail("milestone.notAcceptingSubmissions")
    }
    const cleanNote = note.trim()
    if (!cleanNote && files.length === 0) {
      fail("milestone.emptySubmission")
    }
    if (cleanNote.length > 10_000) fail("milestone.noteTooLong")
    if (files.length > MAX_PROOF_FILES) {
      fail("milestone.tooManyFiles", { max: MAX_PROOF_FILES })
    }
    const prefix = proofPrefix(contract._id, milestone._id, user._id)
    if (files.some((file) => !file.key.startsWith(prefix) || file.key.includes(".."))) {
      fail("file.invalid")
    }

    await ctx.db.insert("submissions", {
      contractId: contract._id,
      milestoneId: milestone._id,
      authorId: user._id,
      note: cleanNote,
      files,
      status: "pending",
    })
    await ctx.db.patch(milestone._id, { status: "submitted" })
    await logActivity(ctx, {
      contractId: contract._id,
      actorId: user._id,
      kind: "milestone.submitted",
      data: { name: milestone.name },
    })
  },
})

async function latestPendingSubmission(ctx: MutationCtx, milestoneId: Id<"milestones">) {
  const submission = await ctx.db
    .query("submissions")
    .withIndex("by_milestone", (q) => q.eq("milestoneId", milestoneId))
    .order("desc")
    .first()
  if (!submission || submission.status !== "pending") {
    fail("milestone.nothingToReview")
  }
  return submission
}

export const requestChanges = mutation({
  args: { milestoneId: v.id("milestones"), note: v.string() },
  handler: async (ctx, { milestoneId, note }) => {
    const { user, milestone, contract } = await loadMilestone(ctx, milestoneId)
    if (contract.contractorId !== user._id) {
      fail("milestone.onlyContractor")
    }
    if (milestone.status !== "submitted") fail("milestone.nothingToReview")
    const reviewNote = note.trim()
    if (!reviewNote) fail("milestone.reviewNoteRequired")

    const submission = await latestPendingSubmission(ctx, milestone._id)
    await ctx.db.patch(submission._id, {
      status: "rejected",
      reviewNote,
      reviewedAt: Date.now(),
    })
    await ctx.db.patch(milestone._id, { status: "changes_requested" })
    await logActivity(ctx, {
      contractId: contract._id,
      actorId: user._id,
      kind: "milestone.changesRequested",
      data: { name: milestone.name },
    })
  },
})

export const approve = mutation({
  args: { milestoneId: v.id("milestones"), note: v.optional(v.string()) },
  handler: async (ctx, { milestoneId, note }) => {
    const { user, milestone, contract } = await loadMilestone(ctx, milestoneId)
    if (contract.contractorId !== user._id) {
      fail("milestone.onlyContractor")
    }
    if (milestone.status !== "submitted") fail("milestone.nothingToReview")

    const now = Date.now()
    const submission = await latestPendingSubmission(ctx, milestone._id)
    await ctx.db.patch(submission._id, {
      status: "approved",
      reviewNote: note?.trim() || undefined,
      reviewedAt: now,
    })
    await ctx.db.patch(milestone._id, {
      status: "approved",
      approvedAt: now,
      payoutStatus: "pending",
      payoutError: undefined,
    })
    await logActivity(ctx, {
      contractId: contract._id,
      actorId: user._id,
      kind: "milestone.approved",
      data: { name: milestone.name, amountCents: milestone.payoutCents },
    })
    await ctx.scheduler.runAfter(0, internal.stripe.releaseMilestone, {
      milestoneId: milestone._id,
    })

    const milestones = await ctx.db
      .query("milestones")
      .withIndex("by_contract", (q) => q.eq("contractId", contract._id))
      .collect()
    const allApproved = milestones.every((m) => m._id === milestone._id || m.status === "approved")
    if (allApproved) {
      await ctx.db.patch(contract._id, { status: "completed", completedAt: now })
      await logActivity(ctx, {
        contractId: contract._id,
        kind: "contract.completed",
      })
    }
  },
})

export const retryPayout = mutation({
  args: { milestoneId: v.id("milestones") },
  handler: async (ctx, { milestoneId }) => {
    const user = await requireUser(ctx)
    const milestone = await ctx.db.get(milestoneId)
    const contract = milestone && (await ctx.db.get(milestone.contractId))
    if (!milestone || !contract || contract.freelancerId !== user._id) {
      fail("milestone.notFound")
    }
    if (milestone.payoutStatus !== "blocked" && milestone.payoutStatus !== "failed") {
      fail("milestone.noPayoutPending")
    }
    await ctx.db.patch(milestone._id, { payoutStatus: "pending", payoutError: undefined })
    await ctx.scheduler.runAfter(0, internal.stripe.releaseMilestone, { milestoneId })
  },
})

// ---------------------------------------------------------------------------
// Internal payout bookkeeping, driven by the Stripe actions.
// ---------------------------------------------------------------------------

export const getForPayout = internalQuery({
  args: { milestoneId: v.id("milestones") },
  handler: async (ctx, { milestoneId }) => {
    const milestone = await ctx.db.get(milestoneId)
    const contract = milestone && (await ctx.db.get(milestone.contractId))
    const freelancer = contract && (await ctx.db.get(contract.freelancerId))
    if (!milestone || !contract || !freelancer) return null
    return { milestone, contract, freelancer }
  },
})

export const setPayoutResult = internalMutation({
  args: {
    milestoneId: v.id("milestones"),
    result: v.union(
      v.object({ status: v.literal("paid"), transferId: v.string() }),
      v.object({ status: v.literal("blocked"), error: v.string() }),
      v.object({ status: v.literal("failed"), error: v.string() }),
    ),
  },
  handler: async (ctx, { milestoneId, result }) => {
    const milestone = await ctx.db.get(milestoneId)
    if (!milestone || milestone.payoutStatus === "paid") return
    if (result.status === "paid") {
      await ctx.db.patch(milestoneId, {
        payoutStatus: "paid",
        payoutError: undefined,
        stripeTransferId: result.transferId,
        paidOutAt: Date.now(),
      })
      await logActivity(ctx, {
        contractId: milestone.contractId,
        kind: "payout.paid",
        data: { name: milestone.name, amountCents: milestone.payoutCents },
      })
    } else {
      await ctx.db.patch(milestoneId, { payoutStatus: result.status, payoutError: result.error })
    }
  },
})

/** Called after a freelancer finishes Stripe onboarding to flush held payouts. */
export const retryBlockedForFreelancer = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const contracts = await ctx.db
      .query("contracts")
      .withIndex("by_freelancer", (q) => q.eq("freelancerId", userId))
      .collect()
    for (const contract of contracts) {
      const milestones = await ctx.db
        .query("milestones")
        .withIndex("by_contract", (q) => q.eq("contractId", contract._id))
        .collect()
      for (const milestone of milestones) {
        if (milestone.payoutStatus !== "blocked") continue
        await ctx.db.patch(milestone._id, { payoutStatus: "pending", payoutError: undefined })
        await ctx.scheduler.runAfter(0, internal.stripe.releaseMilestone, {
          milestoneId: milestone._id,
        })
      }
    }
  },
})
