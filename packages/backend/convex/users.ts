import { getAuthUserId } from "@convex-dev/auth/server"
import { v } from "convex/values"
import { internalMutation, internalQuery, mutation, query } from "./_generated/server"
import { publicUser, requireUser } from "./lib/auth"
import { fail } from "./lib/errors"
import { platformFeeCents } from "./lib/fee"

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const user = await ctx.db.get(userId)
    if (!user) return null
    return {
      ...publicUser(user)!,
      bio: user.bio,
      hasStripeAccount: Boolean(user.stripeAccountId),
      stripePayoutsEnabled: user.stripePayoutsEnabled ?? false,
    }
  },
})

/** Platform settings the UI needs to show price breakdowns. */
export const platformConfig = query({
  args: {},
  handler: async () => ({ feeCents: platformFeeCents(), currency: "brl" as const }),
})

export const updateProfile = mutation({
  args: {
    name: v.string(),
    headline: v.optional(v.string()),
    bio: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const name = args.name.trim()
    if (name.length < 2) fail("profile.nameRequired")
    await ctx.db.patch(user._id, {
      name,
      headline: args.headline?.trim() || undefined,
      bio: args.bio?.trim() || undefined,
    })
  },
})

export const setFreelancer = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    const user = await requireUser(ctx)
    await ctx.db.patch(user._id, { isFreelancer: enabled })
  },
})

/** Used by the draft form to preview who the draft will be sent to. */
export const findByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const me = await requireUser(ctx)
    const normalized = email.trim().toLowerCase()
    if (!normalized.includes("@")) return null
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalized))
      .unique()
    if (!user || user._id === me._id) return null
    return publicUser(user)
  },
})

export const getInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: (ctx, { userId }) => ctx.db.get(userId),
})

export const setStripeAccount = internalMutation({
  args: {
    userId: v.id("users"),
    stripeAccountId: v.string(),
    payoutsEnabled: v.boolean(),
  },
  handler: async (ctx, { userId, stripeAccountId, payoutsEnabled }) => {
    await ctx.db.patch(userId, { stripeAccountId, stripePayoutsEnabled: payoutsEnabled })
  },
})
