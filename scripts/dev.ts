// Runs `convex dev` and the web dev server side by side. (`bun --filter` runs
// workspaces in dependency order, so web would wait for convex dev to exit.)
import { join } from "node:path"
import { backendDir, root } from "./lib"

const tasks = [
  { name: "convex", color: "\x1b[35m", cwd: backendDir },
  { name: "web", color: "\x1b[36m", cwd: join(root, "apps", "web") },
]

const procs = tasks.map((task) => {
  const proc = Bun.spawn(["bun", "run", "dev"], {
    cwd: task.cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, FORCE_COLOR: "1" },
  })
  const prefix = `${task.color}[${task.name}]\x1b[0m `
  for (const stream of [proc.stdout, proc.stderr]) {
    void (async () => {
      const decoder = new TextDecoder()
      let buffer = ""
      for await (const chunk of stream) {
        buffer += decoder.decode(chunk, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) process.stdout.write(prefix + line + "\n")
      }
    })()
  }
  return proc
})

const stop = () => {
  for (const proc of procs) proc.kill()
  process.exit(0)
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)

// If either side dies, take the other one down too.
const code = await Promise.race(procs.map((proc) => proc.exited))
for (const proc of procs) proc.kill()
process.exit(code)
