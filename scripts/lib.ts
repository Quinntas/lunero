import { existsSync } from "node:fs"
import { join } from "node:path"

export const root = join(import.meta.dir, "..")
export const backendDir = join(root, "packages", "backend")

export async function run(cmd: string[], options: { cwd?: string; quiet?: boolean } = {}) {
  const proc = Bun.spawn(cmd, {
    cwd: options.cwd ?? root,
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (code !== 0) {
    throw new Error(`\`${cmd.join(" ")}\` failed (${code}):\n${stderr || stdout}`)
  }
  if (!options.quiet && stdout.trim()) console.log(stdout.trim())
  return stdout
}

/** Runs the Convex CLI against the self-hosted deployment. */
export function convex(args: string[], quiet = true) {
  return run(["bun", "x", "convex", ...args], { cwd: backendDir, quiet })
}

export async function readEnvFile(path: string): Promise<Record<string, string>> {
  if (!existsSync(path)) return {}
  const env: Record<string, string> = {}
  for (const line of (await Bun.file(path).text()).split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!match) continue
    env[match[1]!] = match[2]!.replace(/^(['"])(.*)\1$/, "$2")
  }
  return env
}
