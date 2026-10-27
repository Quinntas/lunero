import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { logActivity } from "./lib/activity"
import { counterpartOf, isParty, publicUser, requireUser } from "./lib/auth"
import { fail } from "./lib/errors"
import { platformFeeCents } from "./lib/fee"
import { draftMilestone } from "./schema"
import { MAX_MILESTONES, MIN_CHARGE_CENTS, breakdown, sumCents } from "./shared/money"

type DraftMilestone = Doc<"drafts">["milestones"][number]
type Role = "freelancer" | "contractor"

const otherRole = (role: Role): Role => (role === "freelancer" ? "contractor" : "freelancer")

function newInviteToken() {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function cleanMilestones(milestones: DraftMilestone[]): DraftMilestone[] {
  if (milestones.length === 0) fail("draft.noMilestones")
  if (milestones.length > MAX_MILESTONES) fail("draft.tooManyMilestones", { max: MAX_MILESTONES })
  return milestones.map((milestone, i) => {
    const index = i + 1
    const name = milestone.name.trim()
    if (!name) fail("milestone.nameRequired", { index })
    if (name.length > 120) fail("milestone.nameTooLong", { index })
    if (milestone.description.length > 4000) fail("milestone.descriptionTooLong", { index })
    if (!Number.isInteger(milestone.priceCents) || milestone.priceCents <= 0) {
      fail("milestone.priceInvalid", { index })
    }
    if (
      milestone.etaDays !== undefined &&
      (!Number.isInteger(milestone.etaDays) || milestone.etaDays < 1 || milestone.etaDays > 3650)
    ) {
      fail("milestone.etaInvalid", { index })
    }
    return {
      name,
      description: milestone.description.trim(),
      priceCents: milestone.priceCents,
      ...(milestone.etaDays !== undefined ? { etaDays: milestone.etaDays } : {}),
    }
  })
}

function assertPriceCoversFee(milestones: DraftMilestone[], feeCents: number) {
  const minimum = Math.max(MIN_CHARGE_CENTS, feeCents + 1)
  if (sumCents(milestones) < minimum) fail("draft.minTotal", { amountCents: minimum })
}

function cleanText(title: string, description: string) {
  const cleanTitle = title.trim()
  if (cleanTitle.length < 3) fail("draft.titleRequired")
  if (cleanTitle.length > 160) fail("draft.titleTooLong")
  if (description.length > 10_000) fail("draft.descriptionTooLong")
  return { title: cleanTitle, description: description.trim() }
}

function roleOf(draft: Doc<"drafts">, userId: Id<"users">): Role | null {
  if (draft.freelancerId === userId) return "freelancer"
  if (draft.contractorId === userId) return "contractor"
  return null
}

function hasCounterpart(draft: Doc<"drafts">) {
  return Boolean(draft.freelancerId && draft.contractorId)
}

async function loadDraftForUser(ctx: QueryCtx, draftId: Id<"drafts">) {
  const user = await requireUser(ctx)
  const draft = await ctx.db.get(draftId)
  if (!draft || !isParty(user._id, draft)) fail("draft.notFound")
  return { user, draft }
}

/**
 * Loads a draft for someone answering it. Parties pass the id; people coming
 * from the invite link also pass the token, which lets them take the free seat.
 */
async function loadDraftForResponse(
  ctx: MutationCtx,
  draftId: Id<"drafts">,
  inviteToken: string | undefined,
) {
  const user = await requireUser(ctx)
  const draft = await ctx.db.get(draftId)
  if (!draft) fail("draft.notFound")
  if (isParty(user._id, draft)) return { user, draft }
  if (!inviteToken || inviteToken !== draft.inviteToken) fail("draft.notFound")
  if (hasCounterpart(draft)) fail("draft.linkTaken")
  return { user, draft }
}

/** Binds the current user to the free seat of a draft opened through its link. */
async function claimSeat(ctx: MutationCtx, draft: Doc<"drafts">, user: Doc<"users">) {
  if (isParty(user._id, draft)) return draft
  const seat = otherRole(draft.creatorRole)
  if (seat === "freelancer" && !user.isFreelancer) fail("draft.freelancerModeRequired")
  await ctx.db.patch(
    draft._id,
    seat === "freelancer" ? { freelancerId: user._id } : { contractorId: user._id },
  )
  await logActivity(ctx, { draftId: draft._id, actorId: user._id, kind: "draft.joined" })
  return (await ctx.db.get(draft._id))!
}

function permissions(draft: Doc<"drafts">, userId: Id<"users"> | null) {
  const party = userId !== null && isParty(userId, draft)
  const myTurn = userId !== null && draft.turnUserId === userId
  const openInvite =
    draft.status === "sent" &&
    !hasCounterpart(draft) &&
    userId !== null &&
    userId !== draft.creatorId
  const canRespond = (draft.status === "sent" && myTurn) || openInvite
  return {
    canEdit: draft.status === "editing" && myTurn,
    canSend: draft.status === "editing" && myTurn,
    canAccept: canRespond,
    canReject: canRespond,
    canCounter: canRespond,
    canCancel: party && (draft.status === "editing" || draft.status === "sent"),
    canShare:
      userId === draft.creatorId &&
      !hasCounterpart(draft) &&
      (draft.status === "editing" || draft.status === "sent"),
  }
}

async function summarize(ctx: QueryCtx, draft: Doc<"drafts">, userId: Id<"users">) {
  const counterpartId = counterpartOf(userId, draft)
  const counterpart = counterpartId ? await ctx.db.get(counterpartId) : null
  return {
    _id: draft._id,
    title: draft.title,
    status: draft.status,
    revision: draft.revision,
    updatedAt: draft.updatedAt,
    totalCents: sumCents(draft.milestones),
    milestoneCount: draft.milestones.length,
    myRole: roleOf(draft, userId) ?? draft.creatorRole,
    isMyTurn: draft.turnUserId === userId,
    isCreator: draft.creatorId === userId,
    counterpart: publicUser(counterpart),
    contractId: draft.contractId,
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx)
    const [asFreelancer, asContractor] = await Promise.all([
      ctx.db
        .query("drafts")
        .withIndex("by_freelancer", (q) => q.eq("freelancerId", user._id))
        .collect(),
      ctx.db
        .query("drafts")
        .withIndex("by_contractor", (q) => q.eq("contractorId", user._id))
        .collect(),
    ])
    const drafts = [...asFreelancer, ...asContractor].toSorted((a, b) => b.updatedAt - a.updatedAt)
    return Promise.all(drafts.map((draft) => summarize(ctx, draft, user._id)))
  },
})

export const get = query({
  args: { draftId: v.id("drafts") },
  handler: async (ctx, { draftId }) => {
    const { user, draft } = await loadDraftForUser(ctx, draftId)
    const [freelancer, contractor, activity] = await Promise.all([
      draft.freelancerId ? ctx.db.get(draft.freelancerId) : null,
      draft.contractorId ? ctx.db.get(draft.contractorId) : null,
      ctx.db
        .query("activity")
        .withIndex("by_draft", (q) => q.eq("draftId", draft._id))
        .order("desc")
        .take(50),
    ])
    const names = new Map(
      [freelancer, contractor].filter((u) => u !== null).map((u) => [u._id, publicUser(u)!.name]),
    )
    return {
      ...(await summarize(ctx, draft, user._id)),
      description: draft.description,
      message: draft.message,
      milestones: draft.milestones,
      creatorRole: draft.creatorRole,
      freelancer: publicUser(freelancer),
      contractor: publicUser(contractor),
      inviteToken: draft.creatorId === user._id ? draft.inviteToken : undefined,
      breakdown: breakdown(
        draft.milestones.map((m) => m.priceCents),
        platformFeeCents(),
      ),
      permissions: permissions(draft, user._id),
      activity: activity.map((entry) => ({
        ...entry,
        actorName: entry.actorId ? names.get(entry.actorId) : undefined,
      })),
    }
  },
})

/** Public preview for the invite link. Works signed out (read-only). */
export const getByInvite = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const draft = await ctx.db
      .query("drafts")
      .withIndex("by_invite_token", (q) => q.eq("inviteToken", token))
      .unique()
    if (!draft || draft.status === "editing") return null
    const userId = await getAuthUserId(ctx)
    const viewer = userId ? await ctx.db.get(userId) : null
    const creator = await ctx.db.get(draft.creatorId)
    return {
      draftId: draft._id,
      title: draft.title,
      description: draft.description,
      message: draft.message,
      milestones: draft.milestones,
      status: draft.status,
      creatorRole: draft.creatorRole,
      creator: publicUser(creator),
      breakdown: breakdown(
        draft.milestones.map((m) => m.priceCents),
        platformFeeCents(),
      ),
      seatTaken: hasCounterpart(draft),
      contractId: viewer && isParty(viewer._id, draft) ? draft.contractId : undefined,
      viewer: viewer
        ? {
            isParty: isParty(viewer._id, draft),
            isFreelancer: viewer.isFreelancer ?? false,
            permissions: permissions(draft, viewer._id),
          }
        : null,
    }
  },
})

export const create = mutation({
  args: {
    role: v.union(v.literal("freelancer"), v.literal("contractor")),
    counterpartEmail: v.optional(v.string()),
    title: v.string(),
    description: v.string(),
    milestones: v.array(draftMilestone),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    if (args.role === "freelancer" && !user.isFreelancer) fail("draft.freelancerModeRequired")

    let counterpart: Doc<"users"> | null = null
    const email = args.counterpartEmail?.trim().toLowerCase()
    if (email) {
      counterpart = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .unique()
      if (!counterpart) fail("draft.counterpartNotFound")
      if (counterpart._id === user._id) fail("draft.selfInvite")
      if (args.role === "contractor" && !counterpart.isFreelancer) {
        fail("draft.counterpartNotFreelancer")
      }
    }

    const seats =
      args.role === "freelancer"
        ? { freelancerId: user._id, contractorId: counterpart?._id }
        : { contractorId: user._id, freelancerId: counterpart?._id }
    const draftId = await ctx.db.insert("drafts", {
      ...cleanText(args.title, args.description),
      ...seats,
      creatorId: user._id,
      creatorRole: args.role,
      status: "editing",
      turnUserId: user._id,
      inviteToken: newInviteToken(),
      revision: 0,
      milestones: cleanMilestones(args.milestones),
      message: args.message?.trim() || undefined,
      updatedAt: Date.now(),
    })
    await logActivity(ctx, { draftId, actorId: user._id, kind: "draft.created" })
    return draftId
  },
})

export const update = mutation({
  args: {
    draftId: v.id("drafts"),
    title: v.string(),
    description: v.string(),
    milestones: v.array(draftMilestone),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, draft } = await loadDraftForUser(ctx, args.draftId)
    if (!permissions(draft, user._id).canEdit) fail("draft.notEditable")
    await ctx.db.patch(draft._id, {
      ...cleanText(args.title, args.description),
      milestones: cleanMilestones(args.milestones),
      message: args.message?.trim() || undefined,
      updatedAt: Date.now(),
    })
  },
})

export const send = mutation({
  args: { draftId: v.id("drafts") },
  handler: async (ctx, { draftId }) => {
    const { user, draft } = await loadDraftForUser(ctx, draftId)
    if (!permissions(draft, user._id).canSend) fail("draft.notSendable")
    assertPriceCoversFee(draft.milestones, platformFeeCents())
    await ctx.db.patch(draft._id, {
      status: "sent",
      // Without a counterpart the draft waits for whoever opens the link.
      turnUserId: counterpartOf(user._id, draft),
      lastSentById: user._id,
      revision: draft.revision + 1,
      updatedAt: Date.now(),
    })
    await logActivity(ctx, {
      draftId,
      actorId: user._id,
      kind: "draft.sent",
      data: { revision: draft.revision + 1, totalCents: sumCents(draft.milestones) },
    })
  },
})

/** The receiver takes the draft back to propose changes before sending it back. */
export const counter = mutation({
  args: { draftId: v.id("drafts"), inviteToken: v.optional(v.string()) },
  handler: async (ctx, { draftId, inviteToken }) => {
    const loaded = await loadDraftForResponse(ctx, draftId, inviteToken)
    if (!permissions(loaded.draft, loaded.user._id).canCounter) fail("draft.cannotCounter")
    const draft = await claimSeat(ctx, loaded.draft, loaded.user)
    await ctx.db.patch(draft._id, {
      status: "editing",
      turnUserId: loaded.user._id,
      updatedAt: Date.now(),
    })
    await logActivity(ctx, { draftId, actorId: loaded.user._id, kind: "draft.countering" })
    return draft._id
  },
})

export const reject = mutation({
  args: {
    draftId: v.id("drafts"),
    inviteToken: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { draftId, inviteToken, reason }) => {
    const loaded = await loadDraftForResponse(ctx, draftId, inviteToken)
    if (!permissions(loaded.draft, loaded.user._id).canReject) fail("draft.cannotReject")
    const draft = await claimSeat(ctx, loaded.draft, loaded.user)
    await ctx.db.patch(draft._id, { status: "rejected", updatedAt: Date.now() })
    await logActivity(ctx, {
      draftId,
      actorId: loaded.user._id,
      kind: "draft.rejected",
      ...(reason?.trim() ? { data: { reason: reason.trim().slice(0, 500) } } : {}),
    })
  },
})

export const cancel = mutation({
  args: { draftId: v.id("drafts") },
  handler: async (ctx, { draftId }) => {
    const { user, draft } = await loadDraftForUser(ctx, draftId)
    if (!permissions(draft, user._id).canCancel) fail("draft.cannotCancel")
    await ctx.db.patch(draft._id, { status: "cancelled", updatedAt: Date.now() })
    await logActivity(ctx, { draftId, actorId: user._id, kind: "draft.cancelled" })
  },
})

export const accept = mutation({
  args: { draftId: v.id("drafts"), inviteToken: v.optional(v.string()) },
  handler: async (ctx, { draftId, inviteToken }) => {
    const loaded = await loadDraftForResponse(ctx, draftId, inviteToken)
    if (!permissions(loaded.draft, loaded.user._id).canAccept) fail("draft.cannotAccept")
    const feeCents = platformFeeCents()
    assertPriceCoversFee(loaded.draft.milestones, feeCents)
    const draft = await claimSeat(ctx, loaded.draft, loaded.user)

    const freelancer = await ctx.db.get(draft.freelancerId!)
    if (!freelancer?.isFreelancer) fail("draft.freelancerDisabled")
    const contractId = await createContract(ctx, draft, feeCents)

    await ctx.db.patch(draft._id, { status: "accepted", contractId, updatedAt: Date.now() })
    await logActivity(ctx, {
      draftId,
      contractId,
      actorId: loaded.user._id,
      kind: "draft.accepted",
    })
    return contractId
  },
})

async function createContract(ctx: MutationCtx, draft: Doc<"drafts">, feeCents: number) {
  const prices = draft.milestones.map((m) => m.priceCents)
  const { totalCents, payouts } = breakdown(prices, feeCents)
  const contractId = await ctx.db.insert("contracts", {
    draftId: draft._id,
    title: draft.title,
    description: draft.description,
    freelancerId: draft.freelancerId!,
    contractorId: draft.contractorId!,
    status: "awaiting_payment",
    totalCents,
    feeCents,
    currency: "brl",
  })
  await Promise.all(
    draft.milestones.map((milestone, order) =>
      ctx.db.insert("milestones", {
        contractId,
        order,
        name: milestone.name,
        description: milestone.description,
        priceCents: milestone.priceCents,
        payoutCents: payouts[order]!,
        etaDays: milestone.etaDays,
        status: "pending",
        payoutStatus: "none",
      }),
    ),
  )
  return contractId
}
