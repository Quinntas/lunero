import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router"
import { Toaster } from "@workspace/ui/components/sonner"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import appCss from "@workspace/ui/globals.css?url"
import type { ConvexReactClient } from "convex/react"
import { ThemeProvider } from "next-themes"
import type { ReactNode } from "react"
import { I18nProvider, detectLocale } from "@/i18n"
import { en } from "@/i18n/messages/en"
import { ptBR } from "@/i18n/messages/pt-BR"

export const Route = createRootRouteWithContext<{ convex: ConvexReactClient }>()({
  beforeLoad: () => ({ locale: detectLocale() }),
  head: ({ match }) => {
    const meta = match.context.locale === "pt-BR" ? ptBR.meta : en.meta
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: meta.title },
        { name: "description", content: meta.description },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "icon", href: "/favicon.ico" },
      ],
    }
  },
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  const { locale } = Route.useRouteContext()
  return (
    // next-themes sets the theme class on <html> before hydration.
    <html lang={locale} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-svh bg-background font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProvider initialLocale={locale}>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster richColors position="top-right" />
          </I18nProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
