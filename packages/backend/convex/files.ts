import { v } from "convex/values"
import { query } from "./_generated/server"
import { requireUser } from "./lib/auth"
import { fail } from "./lib/errors"
import { MAX_PROOF_FILES, proofPrefix } from "./milestones"

// These queries are called by the web server (with the user's Convex token)
// before it signs S3 URLs, so object storage access follows Convex permissions.

export const authorizeUpload = query({
  args: { milestoneId: v.id("milestones") },
  handler: async (ctx, { milestoneId }) => {
    const user = await requireUser(ctx)
    const milestone = await ctx.db.get(milestoneId)
    const contract = milestone && (await ctx.db.get(milestone.contractId))
    if (!milestone || !contract || contract.freelancerId !== user._id) {
      fail("milestone.notFound")
    }
    if (contract.status !== "active") fail("contract.notActive")
    if (!["pending", "in_progress", "changes_requested"].includes(milestone.status)) {
      fail("milestone.notAcceptingSubmissions")
    }
    return {
      userId: user._id,
      prefix: proofPrefix(contract._id, milestone._id, user._id),
      maxFiles: MAX_PROOF_FILES,
    }
  },
})

export const authorizeDownload = query({
  args: { submissionId: v.id("submissions"), key: v.string() },
  handler: async (ctx, { submissionId, key }) => {
    const user = await requireUser(ctx)
    const submission = await ctx.db.get(submissionId)
    const contract = submission && (await ctx.db.get(submission.contractId))
    if (
      !submission ||
      !contract ||
      (contract.freelancerId !== user._id && contract.contractorId !== user._id)
    ) {
      fail("file.notFound")
    }
    const file = submission.files.find((f) => f.key === key)
    if (!file) fail("file.notFound")
    return { userId: user._id, file }
  },
})
