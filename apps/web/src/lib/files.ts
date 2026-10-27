import { api } from "@workspace/backend/api"
import type { Id } from "@workspace/backend/dataModel"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

export const MAX_FILE_BYTES = 25 * 1024 * 1024
const UPLOAD_URL_TTL_SECS = 10 * 60
const DOWNLOAD_URL_TTL_SECS = 15 * 60

function safeFileName(name: string) {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "")
    .slice(-120)
  return cleaned || "arquivo"
}

/** Signs one S3 PUT URL per proof file, after Convex confirms the user may upload. */
export const createUploadUrls = createServerFn({ method: "POST" })
  .validator(
    z.object({
      token: z.string().min(1),
      milestoneId: z.string().min(1),
      files: z
        .array(
          z.object({
            name: z.string().min(1).max(255),
            type: z.string().max(255),
            size: z.number().int().positive().max(MAX_FILE_BYTES),
          }),
        )
        .min(1)
        .max(10),
    }),
  )
  .handler(async ({ data }) => {
    const { convexAs, userFacingError } = await import("@/server/convex")
    const { rateLimit } = await import("@/server/redis")
    const { s3 } = await import("@/server/s3")

    const auth = await convexAs(data.token)
      .query(api.files.authorizeUpload, { milestoneId: data.milestoneId as Id<"milestones"> })
      .catch(userFacingError)
    await rateLimit(`upload:${auth.userId}`, 60, 60)

    return data.files.map((file) => {
      const key = `${auth.prefix}${crypto.randomUUID()}-${safeFileName(file.name)}`
      const contentType = file.type || "application/octet-stream"
      return {
        key,
        contentType,
        url: s3().presign(key, {
          method: "PUT",
          expiresIn: UPLOAD_URL_TTL_SECS,
          type: contentType,
        }),
      }
    })
  })

/** Signs a short-lived GET URL for a proof file the user is allowed to see. */
export const createDownloadUrl = createServerFn({ method: "POST" })
  .validator(
    z.object({
      token: z.string().min(1),
      submissionId: z.string().min(1),
      key: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const { convexAs, userFacingError } = await import("@/server/convex")
    const { cached, rateLimit } = await import("@/server/redis")
    const { s3 } = await import("@/server/s3")

    const { userId, file } = await convexAs(data.token)
      .query(api.files.authorizeDownload, {
        submissionId: data.submissionId as Id<"submissions">,
        key: data.key,
      })
      .catch(userFacingError)
    await rateLimit(`download:${userId}`, 120, 60)

    // Reuse a signed URL for most of its lifetime so repeated clicks hit Redis.
    const url = await cached(`signed-get:${file.key}`, DOWNLOAD_URL_TTL_SECS - 60, () =>
      s3().presign(file.key, {
        method: "GET",
        expiresIn: DOWNLOAD_URL_TTL_SECS,
        contentDisposition: `attachment; filename="${safeFileName(file.name)}"`,
      }),
    )
    return { url }
  })
