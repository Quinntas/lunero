// One-shot local setup: infra, Convex admin key, Convex Auth keys and env vars.
import { copyFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { backendDir, convex, readEnvFile, root, run } from "./lib"

const step = (message: string) => console.log(`\n▸ ${message}`)

step("Preparing .env")
if (!existsSync(join(root, ".env"))) {
  copyFileSync(join(root, ".env.example"), join(root, ".env"))
  console.log("Created .env from .env.example")
} else {
  console.log(".env already exists, keeping it")
}

step("Starting Convex, Redis and MinIO (docker compose)")
await run([
  "docker",
  "compose",
  "up",
  "-d",
  "--wait",
  "convex",
  "convex-dashboard",
  "redis",
  "minio",
])
await run(["docker", "compose", "run", "--rm", "minio-init"])

step("Connecting the Convex CLI to the self-hosted backend")
const backendEnvPath = join(backendDir, ".env.local")
const backendEnv = await readEnvFile(backendEnvPath)
if (!backendEnv.CONVEX_SELF_HOSTED_ADMIN_KEY) {
  const output = await run(["docker", "compose", "exec", "convex", "./generate_admin_key.sh"], {
    quiet: true,
  })
  const adminKey = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("convex-self-hosted|"))
  if (!adminKey) throw new Error(`Could not read the admin key from:\n${output}`)
  await Bun.write(
    backendEnvPath,
    `CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210\nCONVEX_SELF_HOSTED_ADMIN_KEY=${adminKey}\n`,
  )
  console.log("Wrote packages/backend/.env.local")
} else {
  console.log("packages/backend/.env.local already configured")
}

step("Configuring Convex Auth signing keys")
const existing = await convex(["env", "list"])
if (existing.includes("JWT_PRIVATE_KEY=")) {
  console.log("JWT keys already set")
} else {
  const keys = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )
  const pkcs8 = Buffer.from(await crypto.subtle.exportKey("pkcs8", keys.privateKey)).toString(
    "base64",
  )
  const privateKey = `-----BEGIN PRIVATE KEY----- ${pkcs8.match(/.{1,64}/g)!.join(" ")} -----END PRIVATE KEY-----`
  const publicJwk = await crypto.subtle.exportKey("jwk", keys.publicKey)
  const jwks = JSON.stringify({ keys: [{ use: "sig", alg: "RS256", ...publicJwk }] })
  await convex(["env", "set", "JWT_PRIVATE_KEY", "--", privateKey])
  await convex(["env", "set", "JWKS", "--", jwks])
  console.log("Generated and stored JWT_PRIVATE_KEY and JWKS")
}

step("Syncing .env settings to Convex")
await run(["bun", "scripts/sync-env.ts"])

console.log(`
✅ Setup complete.

  bun run dev            → web on http://localhost:3000 + convex dev (push & watch)
  Convex dashboard       → http://localhost:6791  (admin key in packages/backend/.env.local)
  MinIO console          → http://localhost:9001  (lunero / lunero-secret)
  bun run stripe:listen  → forward Stripe webhooks, then put the whsec_ in .env and run bun run env:sync
`)
