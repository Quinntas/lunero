import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"
import { useAction as useConvexAction, useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { BanknoteIcon, ExternalLinkIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"
import { PageHeader } from "@/components/page-header"
import { PreferenceControls } from "@/components/preferences"
import { UserAvatar } from "@/components/user-avatar"
import { useI18n } from "@/i18n"

const tabs = ["profile", "freelancer", "preferences"] as const

export const Route = createFileRoute("/app/settings")({
  validateSearch: z.object({
    tab: z.enum(tabs).optional(),
    stripe: z.enum(["return", "refresh"]).optional(),
  }),
  component: Settings,
})

type Me = NonNullable<FunctionReturnType<typeof api.users.me>>

function Settings() {
  const { t } = useI18n()
  const me = useQuery(api.users.me)
  const { tab, stripe } = Route.useSearch()
  const navigate = useNavigate()
  if (!me) return <Skeleton className="h-96" />
  const current = tab ?? (stripe ? "freelancer" : "profile")

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title={t("settings.title")} description={t("settings.subtitle")} />
      <Tabs
        value={current}
        onValueChange={(value) =>
          void navigate({ to: ".", search: { tab: value as (typeof tabs)[number] }, replace: true })
        }
      >
        <TabsList>
          <TabsTrigger value="profile">{t("settings.tabProfile")}</TabsTrigger>
          <TabsTrigger value="freelancer">{t("settings.tabFreelancer")}</TabsTrigger>
          <TabsTrigger value="preferences">{t("settings.tabPreferences")}</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-4">
          <ProfileCard me={me} />
        </TabsContent>
        <TabsContent value="freelancer" className="mt-4">
          <FreelancerCard me={me} />
        </TabsContent>
        <TabsContent value="preferences" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("settings.preferencesTitle")}</CardTitle>
              <CardDescription>{t("settings.preferencesText")}</CardDescription>
            </CardHeader>
            <CardContent>
              <PreferenceControls />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ProfileCard({ me }: { me: Me }) {
  const { t, errorMessage } = useI18n()
  const updateProfile = useMutation(api.users.updateProfile)
  const [name, setName] = useState(me.name)
  const [headline, setHeadline] = useState(me.headline ?? "")
  const [bio, setBio] = useState(me.bio ?? "")
  const [pending, setPending] = useState(false)

  async function save() {
    setPending(true)
    try {
      await updateProfile({ name, headline, bio })
      toast.success(t("settings.saved"))
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        <UserAvatar user={me} className="size-12" />
        <div>
          <CardTitle>{me.name}</CardTitle>
          <CardDescription>{me.email}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="name">{t("settings.name")}</FieldLabel>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="headline">{t("settings.headline")}</FieldLabel>
            <Input
              id="headline"
              value={headline}
              placeholder={t("settings.headlinePlaceholder")}
              onChange={(e) => setHeadline(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="bio">{t("settings.bio")}</FieldLabel>
            <Textarea id="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter>
        <Button onClick={save} disabled={pending}>
          {pending ? <Spinner /> : null}
          {t("common.save")}
        </Button>
      </CardFooter>
    </Card>
  )
}

function FreelancerCard({ me }: { me: Me }) {
  const { t, errorMessage } = useI18n()
  const setFreelancer = useMutation(api.users.setFreelancer)
  const startOnboarding = useConvexAction(api.stripe.createConnectOnboarding)
  const syncAccount = useConvexAction(api.stripe.syncConnectAccount)
  const { stripe } = Route.useSearch()
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const synced = useRef(false)

  // Coming back from Stripe onboarding: refresh status (and flush held payouts).
  useEffect(() => {
    if (!stripe || synced.current) return
    synced.current = true
    if (stripe === "refresh") {
      void startOnboarding().then(({ url }) => window.location.assign(url))
      return
    }
    void syncAccount()
      .then(({ payoutsEnabled }) =>
        payoutsEnabled
          ? toast.success(t("settings.payoutsEnabled"))
          : toast.info(t("settings.payoutsPending")),
      )
      .catch((error) => toast.error(errorMessage(error)))
      .finally(() => navigate({ to: ".", search: { tab: "freelancer" }, replace: true }))
  }, [stripe, startOnboarding, syncAccount, navigate, t, errorMessage])

  async function onboard() {
    setPending(true)
    try {
      const { url } = await startOnboarding()
      window.location.assign(url)
    } catch (error) {
      toast.error(errorMessage(error))
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.freelancerTitle")}</CardTitle>
        <CardDescription>{t("settings.freelancerText")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Field orientation="horizontal" className="rounded-lg border p-4">
          <FieldContent>
            <FieldLabel htmlFor="freelancer">{t("settings.freelancerToggle")}</FieldLabel>
            <FieldDescription>{t("settings.freelancerToggleHint")}</FieldDescription>
          </FieldContent>
          <Switch
            id="freelancer"
            checked={me.isFreelancer}
            onCheckedChange={(enabled) =>
              setFreelancer({ enabled }).catch((error) => toast.error(errorMessage(error)))
            }
          />
        </Field>

        {me.isFreelancer ? (
          <div className="flex flex-col gap-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <BanknoteIcon className="size-4" />
              <span className="font-medium">{t("settings.payoutsTitle")}</span>
              {me.stripePayoutsEnabled ? (
                <Badge>{t("settings.payoutsActive")}</Badge>
              ) : me.hasStripeAccount ? (
                <Badge variant="secondary">{t("settings.payoutsIncomplete")}</Badge>
              ) : (
                <Badge variant="outline">{t("settings.payoutsMissing")}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{t("settings.payoutsText")}</p>
            <Button variant="outline" className="w-fit" onClick={onboard} disabled={pending}>
              {pending ? <Spinner /> : <ExternalLinkIcon />}
              {me.hasStripeAccount ? t("settings.payoutsContinue") : t("settings.payoutsSetup")}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
