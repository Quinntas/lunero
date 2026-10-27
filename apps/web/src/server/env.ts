import { z } from "zod"

const schema = z.object({
  CONVEX_URL: z.url(),
  REDIS_URL: z.string().min(1),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
})

let cached: z.infer<typeof schema> | undefined

/** Server-only configuration, validated on first use. */
export function serverEnv() {
  return (cached ??= schema.parse(process.env))
}
