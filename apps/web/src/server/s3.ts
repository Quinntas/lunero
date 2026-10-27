import { serverEnv } from "./env"

let client: Bun.S3Client | undefined

export function s3() {
  if (!client) {
    const env = serverEnv()
    client = new Bun.S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      bucket: env.S3_BUCKET,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    })
  }
  return client
}
