import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

// The whole monorepo shares a single `.env` at the repository root.
const envDir = fileURLToPath(new URL("../..", import.meta.url))

export default defineConfig(({ mode }) => {
  // Expose server-only settings (Redis, S3, Convex URL) to server functions.
  Object.assign(process.env, { ...loadEnv(mode, envDir, ""), ...process.env })

  return {
    envDir,
    server: { port: 3000 },
    resolve: { tsconfigPaths: true },
    plugins: [tailwindcss(), tanstackStart(), viteReact()],
  }
})
