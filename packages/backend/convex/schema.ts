import { authTables } from "@convex-dev/auth/server"
import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export const draftStatus = v.union(
  v.literal("editing"),
  v.literal("sent"),
  v.literal("accepted"),
  v.literal("rejected"),
  v.literal("cancelled"),
)

export const contractStatus = v.union(
  v.literal("awaiting_payment"),
  v.literal("payment_processing"),
  v.literal("active"),
  v.literal("completed"),
  v.literal("cancelled"),
)

export const milestoneStatus = v.union(
  v.literal("pending"),
  v.literal("in_progress"),
  v.literal("submitted"),
  v.literal("changes_requested"),
  v.literal("approved"),
)

export const payoutStatus = v.union(
  v.literal("none"),
  v.literal("pending"),
  v.literal("blocked"),
  v.literal("failed"),
  v.literal("paid"),
)

export const draftMilestone = v.object({
  name: v.string(),
  description: v.string(),
  priceCents: v.number(),
  etaDays: v.optional(v.number()),
})

export const proofFile = v.object({
  key: v.string(),
  name: v.string(),
  size: v.number(),
  contentType: v.string(),
})

export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // Same account for everyone: this flag enables the freelancer behaviour.
    isFreelancer: v.optional(v.boolean()),
    headline: v.optional(v.string()),
    bio: v.optional(v.string()),
    stripeAccountId: v.optional(v.string()),
    stripePayoutsEnabled: v.optional(v.boolean()),
  }).index("email", ["email"]),

  // A job request under negotiation. Either party can author it and the two
  // sides send it back and forth until the receiver accepts or rejects it.
  // The other side is optional: it can be invited by e-mail or join later
  // through the shareable invite link.
  drafts: defineTable({
    title: v.string(),
    description: v.string(),
    creatorId: v.id("users"),
    creatorRole: v.union(v.literal("freelancer"), v.literal("contractor")),
    freelancerId: v.optional(v.id("users")),
    contractorId: v.optional(v.id("users")),
    status: draftStatus,
    // Who has the draft "in their court": the editor while editing, the
    // receiver while sent. Unset while a sent draft waits for someone to open
    // the invite link.
    turnUserId: v.optional(v.id("users")),
    inviteToken: v.string(),
    lastSentById: v.optional(v.id("users")),
    revision: v.number(),
    milestones: v.array(draftMilestone),
    message: v.optional(v.string()),
    contractId: v.optional(v.id("contracts")),
    updatedAt: v.number(),
  })
    .index("by_freelancer", ["freelancerId"])
    .index("by_contractor", ["contractorId"])
    .index("by_invite_token", ["inviteToken"]),

  // Immutable terms of an accepted draft plus its payment lifecycle.
  contracts: defineTable({
    draftId: v.id("drafts"),
    title: v.string(),
    description: v.string(),
    freelancerId: v.id("users"),
    contractorId: v.id("users"),
    status: contractStatus,
    totalCents: v.number(),
    feeCents: v.number(),
    currency: v.literal("brl"),
    stripeCheckoutSessionId: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
    stripeChargeId: v.optional(v.string()),
    paidAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_freelancer", ["freelancerId"])
    .index("by_contractor", ["contractorId"])
    .index("by_checkout_session", ["stripeCheckoutSessionId"]),

  milestones: defineTable({
    contractId: v.id("contracts"),
    order: v.number(),
    name: v.string(),
    description: v.string(),
    priceCents: v.number(),
    // priceCents minus this milestone's share of the platform fee.
    payoutCents: v.number(),
    etaDays: v.optional(v.number()),
    dueAt: v.optional(v.number()),
    status: milestoneStatus,
    approvedAt: v.optional(v.number()),
    payoutStatus: payoutStatus,
    payoutError: v.optional(v.string()),
    stripeTransferId: v.optional(v.string()),
    paidOutAt: v.optional(v.number()),
  })
    .index("by_contract", ["contractId", "order"])
    .index("by_payout_status", ["payoutStatus"]),

  // Proof of work sent by the freelancer for a milestone.
  submissions: defineTable({
    contractId: v.id("contracts"),
    milestoneId: v.id("milestones"),
    authorId: v.id("users"),
    note: v.string(),
    files: v.array(proofFile),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    reviewNote: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
  }).index("by_milestone", ["milestoneId"]),

  // Append-only history of everything that happened to a draft / contract.
  activity: defineTable({
    draftId: v.optional(v.id("drafts")),
    contractId: v.optional(v.id("contracts")),
    actorId: v.optional(v.id("users")),
    // Translated on the client from `kind` + `data`.
    kind: v.string(),
    data: v.optional(v.record(v.string(), v.union(v.string(), v.number()))),
  })
    .index("by_draft", ["draftId"])
    .index("by_contract", ["contractId"]),

  stripeEvents: defineTable({
    eventId: v.string(),
    type: v.string(),
  }).index("by_event_id", ["eventId"]),
})
