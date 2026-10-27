// Production server: serves the built client assets and hands everything else
// to the TanStack Start fetch handler. Run with `bun run build && bun run start`.
import { join } from "node:path"

const clientDir = join(import.meta.dir, "dist", "client")
const serverEntry = join(import.meta.dir, "dist", "server", "server.js")
const { default: app } = (await import(serverEntry)) as {
  default: { fetch: (request: Request) => Response | Promise<Response> }
}

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  async fetch(request) {
    const { pathname } = new URL(request.url)
    if (pathname !== "/" && !pathname.includes("..")) {
      const file = Bun.file(join(clientDir, pathname))
      if (await file.exists()) {
        const immutable = pathname.startsWith("/assets/")
        return new Response(file, {
          headers: immutable ? { "Cache-Control": "public, max-age=31536000, immutable" } : {},
        })
      }
    }
    return app.fetch(request)
  },
})

console.log(`Lunero running at ${server.url}`)
