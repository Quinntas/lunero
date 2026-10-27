import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import { internalMutation, internalQuery, mutation, query } from "./_generated/server"
import type { QueryCtx } from "./_generated/server"
import { logActivity } from "./lib/activity"
import { fail } from "./lib/errors"
import { counterpartOf, isParty, publicUser, requireUser } from "./lib/auth"

const DAY_MS = 24 * 60 * 60 * 1000

async function loadContractForUser(ctx: QueryCtx, contractId: Id<"contracts">) {
  const user = await requireUser(ctx)
  const contract = await ctx.db.get(contractId)
  if (!contract || !isParty(user._id, contract)) fail("contract.notFound")
  return { user, contract }
}

function milestonePermissions(
  contract: Doc<"contracts">,
  milestone: Doc<"milestones">,
  userId: Id<"users">,
) {
  const active = contract.status === "active"
  const isFreelancer = contract.freelancerId === userId
  const isContractor = contract.contractorId === userId
  return {
    canStart: active && isFreelancer && milestone.status === "pending",
    canSubmit:
      active &&
      isFreelancer &&
      (milestone.status === "pending" ||
        milestone.status === "in_progress" ||
        milestone.status === "changes_requested"),
    canReview: active && isContractor && milestone.status === "submitted",
    canRetryPayout:
      isFreelancer && (milestone.payoutStatus === "blocked" || milestone.payoutStatus === "failed"),
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx)
    const [asFreelancer, asContractor] = await Promise.all([
      ctx.db
        .query("contracts")
        .withIndex("by_freelancer", (q) => q.eq("freelancerId", user._id))
        .collect(),
      ctx.db
        .query("contracts")
        .withIndex("by_contractor", (q) => q.eq("contractorId", user._id))
        .collect(),
    ])
    const contracts = [...asFreelancer, ...asContractor].sort(
      (a, b) => b._creationTime - a._creationTime,
    )
    return Promise.all(
      contracts.map(async (contract) => {
        const [counterpart, milestones] = await Promise.all([
          ctx.db.get(counterpartOf(user._id, contract)!),
          ctx.db
            .query("milestones")
            .withIndex("by_contract", (q) => q.eq("contractId", contract._id))
            .collect(),
        ])
        const approved = milestones.filter((m) => m.status === "approved")
        return {
          _id: contract._id,
          _creationTime: contract._creationTime,
          title: contract.title,
          status: contract.status,
          totalCents: contract.totalCents,
          feeCents: contract.feeCents,
          myRole:
            contract.freelancerId === user._id ? ("freelancer" as const) : ("contractor" as const),
          counterpart: publicUser(counterpart),
          milestoneCount: milestones.length,
          approvedCount: approved.length,
          releasedCents: milestones
            .filter((m) => m.payoutStatus === "paid")
            .reduce((total, m) => total + m.payoutCents, 0),
          awaitingReview: milestones.filter((m) => m.status === "submitted").length,
          toDeliver: milestones.filter((m) =>
            ["pending", "in_progress", "changes_requested"].includes(m.status),
          ).length,
          blockedPayouts: milestones.filter(
            (m) => m.payoutStatus === "blocked" || m.payoutStatus === "failed",
          ).length,
        }
      }),
    )
  },
})

export const get = query({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, { contractId }) => {
    const { user, contract } = await loadContractForUser(ctx, contractId)
    const [freelancer, contractor, milestones, activity] = await Promise.all([
      ctx.db.get(contract.freelancerId),
      ctx.db.get(contract.contractorId),
      ctx.db
        .query("milestones")
        .withIndex("by_contract", (q) => q.eq("contractId", contract._id))
        .collect(),
      ctx.db
        .query("activity")
        .withIndex("by_contract", (q) => q.eq("contractId", contract._id))
        .order("desc")
        .take(100),
    ])
    const withSubmissions = await Promise.all(
      milestones.map(async (milestone) => ({
        ...milestone,
        submissions: await ctx.db
          .query("submissions")
          .withIndex("by_milestone", (q) => q.eq("milestoneId", milestone._id))
          .order("desc")
          .collect(),
        permissions: milestonePermissions(contract, milestone, user._id),
      })),
    )
    const actors = new Map(
      await Promise.all(
        [...new Set(activity.map((a) => a.actorId).filter((id) => id !== undefined))].map(
          async (id) => [id, publicUser(await ctx.db.get(id))?.name] as const,
        ),
      ),
    )
    const isContractor = contract.contractorId === user._id
    return {
      _id: contract._id,
      _creationTime: contract._creationTime,
      draftId: contract.draftId,
      title: contract.title,
      description: contract.description,
      status: contract.status,
      totalCents: contract.totalCents,
      feeCents: contract.feeCents,
      paidAt: contract.paidAt,
      completedAt: contract.completedAt,
      myRole: isContractor ? ("contractor" as const) : ("freelancer" as const),
      freelancer: publicUser(freelancer),
      contractor: publicUser(contractor),
      milestones: withSubmissions,
      releasedCents: milestones
        .filter((m) => m.payoutStatus === "paid")
        .reduce((total, m) => total + m.payoutCents, 0),
      permissions: {
        canPay:
          isContractor &&
          (contract.status === "awaiting_payment" || contract.status === "payment_processing"),
        canCancel: contract.status === "awaiting_payment",
      },
      activity: activity.map((entry) => ({
        ...entry,
        actorName: entry.actorId ? actors.get(entry.actorId) : undefined,
      })),
    }
  },
})

/** Either party can walk away while nothing has been paid yet. */
export const cancel = mutation({
  args: { contractId: v.id("contracts") },
  handler: async (ctx, { contractId }) => {
    const { user, contract } = await loadContractForUser(ctx, contractId)
    if (contract.status !== "awaiting_payment") {
      fail("contract.cancelOnlyUnpaid")
    }
    await ctx.db.patch(contract._id, { status: "cancelled" })
    await logActivity(ctx, {
      contractId,
      draftId: contract.draftId,
      actorId: user._id,
      kind: "contract.cancelled",
    })
  },
})

// ---------------------------------------------------------------------------
// Internal functions used by the Stripe actions / webhook.
// ---------------------------------------------------------------------------

export const getForCheckout = internalQuery({
  args: { contractId: v.id("contracts"), userId: v.id("users") },
  handler: async (ctx, { contractId, userId }) => {
    const contract = await ctx.db.get(contractId)
    if (!contract || contract.contractorId !== userId) {
      fail("contract.onlyContractorPays")
    }
    if (contract.status !== "awaiting_payment" && contract.status !== "payment_processing") {
      fail("contract.notAwaitingPayment")
    }
    const contractor = await ctx.db.get(contract.contractorId)
    return { contract, contractorEmail: contractor?.email }
  },
})

export const setCheckoutSession = internalMutation({
  args: { contractId: v.id("contracts"), sessionId: v.string() },
  handler: async (ctx, { contractId, sessionId }) => {
    await ctx.db.patch(contractId, { stripeCheckoutSessionId: sessionId })
  },
})

/** Pix is asynchronous: the session completes before the money arrives. */
export const markPaymentProcessing = internalMutation({
  args: { contractId: v.id("contracts"), sessionId: v.string() },
  handler: async (ctx, { contractId, sessionId }) => {
    const contract = await ctx.db.get(contractId)
    if (!contract || contract.status !== "awaiting_payment") return
    await ctx.db.patch(contractId, {
      status: "payment_processing",
      stripeCheckoutSessionId: sessionId,
    })
    await logActivity(ctx, {
      contractId,
      kind: "payment.processing",
    })
  },
})

export const markPaymentFailed = internalMutation({
  args: {
    contractId: v.id("contracts"),
    reason: v.union(v.literal("expired"), v.literal("pixFailed")),
  },
  handler: async (ctx, { contractId, reason }) => {
    const contract = await ctx.db.get(contractId)
    if (!contract || contract.status !== "payment_processing") return
    await ctx.db.patch(contractId, { status: "awaiting_payment" })
    await logActivity(ctx, { contractId, kind: "payment.failed", data: { reason } })
  },
})

export const markFunded = internalMutation({
  args: {
    contractId: v.id("contracts"),
    sessionId: v.string(),
    paymentIntentId: v.string(),
    chargeId: v.string(),
  },
  handler: async (ctx, args) => {
    const contract = await ctx.db.get(args.contractId)
    if (!contract) return
    if (contract.status !== "awaiting_payment" && contract.status !== "payment_processing") return

    const paidAt = Date.now()
    await ctx.db.patch(contract._id, {
      status: "active",
      paidAt,
      stripeCheckoutSessionId: args.sessionId,
      stripePaymentIntentId: args.paymentIntentId,
      stripeChargeId: args.chargeId,
    })
    const milestones = await ctx.db
      .query("milestones")
      .withIndex("by_contract", (q) => q.eq("contractId", contract._id))
      .collect()
    await Promise.all(
      milestones
        .filter((m) => m.etaDays !== undefined)
        .map((m) => ctx.db.patch(m._id, { dueAt: paidAt + m.etaDays! * DAY_MS })),
    )
    await logActivity(ctx, {
      contractId: contract._id,
      kind: "payment.succeeded",
      data: { totalCents: contract.totalCents },
    })
  },
})
