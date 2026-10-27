import { ConvexAuthProvider } from "@convex-dev/auth/react"
import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { ConvexReactClient } from "convex/react"
import { DefaultCatchBoundary } from "@/components/default-catch-boundary"
import { NotFound } from "@/components/not-found"
import { routeTree } from "./routeTree.gen"

export function getRouter() {
  const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined
  if (!convexUrl) throw new Error("Missing VITE_CONVEX_URL (see .env.example)")
  const convex = new ConvexReactClient(convexUrl, { unsavedChangesWarning: false })

  return createTanStackRouter({
    routeTree,
    context: { convex },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <NotFound />,
    Wrap: ({ children }) => <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>,
  })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
