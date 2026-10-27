// Pushes the Convex-side settings from the root `.env` to the Convex deployment.
import { join } from "node:path"
import { convex, readEnvFile, root } from "./lib"

const CONVEX_KEYS = ["SITE_URL", "LUNERO_FEE_CENTS", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]

const env = await readEnvFile(join(root, ".env"))
const current = await convex(["env", "list"])
const currentKeys = new Set(current.split(/\r?\n/).map((line) => line.split("=")[0]))

for (const key of CONVEX_KEYS) {
  const value = env[key]
  if (value) {
    await convex(["env", "set", key, "--", value])
    console.log(`✔ ${key}`)
  } else if (currentKeys.has(key)) {
    await convex(["env", "remove", key])
    console.log(`✖ ${key} (removed, empty in .env)`)
  } else {
    console.log(`- ${key} (not set)`)
  }
}
