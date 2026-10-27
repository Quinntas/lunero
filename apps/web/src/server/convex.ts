import { ConvexHttpClient } from "convex/browser"
import { ConvexError } from "convex/values"
import { serverEnv } from "./env"

/** A Convex client acting as the user who owns `token`. */
export function convexAs(token: string) {
  const client = new ConvexHttpClient(serverEnv().CONVEX_URL)
  client.setAuth(token)
  return client
}

/** Re-throws Convex errors as `code:<code>` so the client can translate them. */
export function userFacingError(error: unknown): never {
  if (error instanceof ConvexError && typeof error.data === "object" && error.data?.code) {
    throw new Error(`code:${String(error.data.code)}`)
  }
  throw error
}
