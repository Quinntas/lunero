import { getAuthUserId } from "@convex-dev/auth/server"
import type { Doc, Id } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"
import { fail } from "./errors"

export async function requireUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx)
  if (!userId) fail("auth.required")
  const user = await ctx.db.get(userId)
  if (!user) fail("user.notFound")
  return user
}

type Parties = { freelancerId?: Id<"users">; contractorId?: Id<"users"> }

export function isParty(userId: Id<"users">, doc: Parties) {
  return doc.freelancerId === userId || doc.contractorId === userId
}

export function counterpartOf(userId: Id<"users">, doc: Parties) {
  return doc.freelancerId === userId ? doc.contractorId : doc.freelancerId
}

export function publicUser(user: Doc<"users"> | null) {
  if (!user) return null
  return {
    _id: user._id,
    name: user.name ?? user.email ?? "—",
    email: user.email ?? "",
    image: user.image,
    headline: user.headline,
    isFreelancer: user.isFreelancer ?? false,
  }
}
