import { v } from "convex/values"
import { internalMutation } from "./_generated/server"

/** Records a Stripe event id; returns false when it was already processed. */
export const record = internalMutation({
  args: { eventId: v.string(), type: v.string() },
  handler: async (ctx, { eventId, type }) => {
    const existing = await ctx.db
      .query("stripeEvents")
      .withIndex("by_event_id", (q) => q.eq("eventId", eventId))
      .unique()
    if (existing) return false
    await ctx.db.insert("stripeEvents", { eventId, type })
    return true
  },
})
