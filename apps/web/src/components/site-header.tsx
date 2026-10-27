import { Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { useConvexAuth } from "convex/react"
import type { ReactNode } from "react"
import { Logo } from "@/components/logo"
import { LocaleSwitcher, ThemeToggle } from "@/components/preferences"
import { useI18n } from "@/i18n"

/** Header for public pages (landing, invite links). */
export function SiteHeader({ nav }: { nav?: ReactNode }) {
  const { t } = useI18n()
  const { isAuthenticated } = useConvexAuth()
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <Link to="/">
          <Logo />
        </Link>
        {nav ? <nav className="hidden items-center gap-6 text-sm md:flex">{nav}</nav> : null}
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
          {isAuthenticated ? (
            <Button asChild className="ml-2">
              <Link to="/app">{t("common.openApp")}</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="ml-2 hidden sm:inline-flex">
                <Link to="/sign-in">{t("common.signIn")}</Link>
              </Button>
              <Button asChild>
                <Link to="/sign-in" search={{ mode: "sign-up" }}>
                  {t("common.getStarted")}
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
