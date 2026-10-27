import { useAuthActions } from "@convex-dev/auth/react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { useConvexAuth } from "convex/react"
import { CheckCircle2Icon } from "lucide-react"
import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { z } from "zod"
import { Logo } from "@/components/logo"
import { LocaleSwitcher, ThemeToggle } from "@/components/preferences"
import { useI18n } from "@/i18n"

export const Route = createFileRoute("/sign-in")({
  validateSearch: z.object({
    mode: z.enum(["sign-in", "sign-up"]).optional(),
    redirect: z.string().optional(),
  }),
  component: SignIn,
})

/** Only follow in-app redirects to avoid open redirects. */
const safeRedirect = (path: string | undefined) =>
  path && (path.startsWith("/app") || path.startsWith("/p/")) ? path : undefined

function SignIn() {
  const { t } = useI18n()
  const { mode = "sign-in", redirect } = Route.useSearch()
  const isSignUp = mode === "sign-up"
  const { signIn } = useAuthActions()
  const { isAuthenticated } = useConvexAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) return
    const target = safeRedirect(redirect)
    if (target) window.location.assign(target)
    else void navigate({ to: "/app" })
  }, [isAuthenticated, navigate, redirect])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(undefined)
    setPending(true)
    const formData = new FormData(event.currentTarget)
    formData.set("flow", isSignUp ? "signUp" : "signIn")
    try {
      await signIn("password", formData)
    } catch {
      setError(isSignUp ? t("auth.errorSignUp") : t("auth.errorSignIn"))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-6 p-6 md:p-10">
        <div className="flex items-center justify-between">
          <Link to="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-1">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-sm flex-col gap-6">
            <Tabs
              value={mode}
              onValueChange={(value) =>
                void navigate({ to: "/sign-in", search: { mode: value as typeof mode, redirect } })
              }
            >
              <TabsList className="w-full">
                <TabsTrigger value="sign-in">{t("common.signIn")}</TabsTrigger>
                <TabsTrigger value="sign-up">{t("common.signUp")}</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                {isSignUp ? t("auth.signUpTitle") : t("auth.signInTitle")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isSignUp ? t("auth.signUpSubtitle") : t("auth.signInSubtitle")}
              </p>
            </div>
            <form onSubmit={onSubmit} className="flex flex-col gap-6">
              <FieldGroup>
                {isSignUp ? (
                  <Field>
                    <FieldLabel htmlFor="name">{t("auth.name")}</FieldLabel>
                    <Input id="name" name="name" autoComplete="name" required minLength={2} />
                  </Field>
                ) : null}
                <Field>
                  <FieldLabel htmlFor="email">{t("auth.email")}</FieldLabel>
                  <Input id="email" name="email" type="email" autoComplete="email" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">{t("auth.password")}</FieldLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    required
                    minLength={8}
                  />
                  {isSignUp ? <FieldDescription>{t("auth.passwordHint")}</FieldDescription> : null}
                </Field>
                {error ? <FieldError>{error}</FieldError> : null}
              </FieldGroup>
              <Button type="submit" size="lg" className="w-full" disabled={pending}>
                {pending ? <Spinner /> : null}
                {isSignUp ? t("auth.submitSignUp") : t("auth.submitSignIn")}
              </Button>
            </form>
            <p className="text-center text-sm text-muted-foreground">
              {isSignUp ? t("auth.haveAccount") : t("auth.noAccount")}{" "}
              <Link
                to="/sign-in"
                search={{ mode: isSignUp ? "sign-in" : "sign-up", redirect }}
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                {isSignUp ? t("common.signIn") : t("common.signUp")}
              </Link>
            </p>
          </div>
        </div>
      </div>
      <aside className="relative hidden flex-col justify-end overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgb(255_255_255/0.12),transparent_55%)]"
          aria-hidden
        />
        <div className="relative flex max-w-md flex-col gap-6">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            {t("auth.asideTitle")}
          </h2>
          <ul className="flex flex-col gap-3">
            {[t("auth.aside1"), t("auth.aside2"), t("auth.aside3")].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 opacity-80" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}
