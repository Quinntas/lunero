import { Link, createFileRoute } from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"
import { useConvexAuth, useQuery } from "convex/react"
import {
  BadgeCheckIcon,
  BriefcaseIcon,
  CheckCircle2Icon,
  CheckIcon,
  CircleDashedIcon,
  FileSignatureIcon,
  HandCoinsIcon,
  Loader2Icon,
  ShieldCheckIcon,
  UserIcon,
} from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { useI18n } from "@/i18n"

export const Route = createFileRoute("/")({ component: Landing })

const YEAR = new Date().getFullYear()

function Landing() {
  const { t, money } = useI18n()
  const { isAuthenticated } = useConvexAuth()
  const config = useQuery(api.users.platformConfig)

  const steps = [
    { icon: FileSignatureIcon, title: t("landing.step1Title"), text: t("landing.step1Text") },
    { icon: BadgeCheckIcon, title: t("landing.step2Title"), text: t("landing.step2Text") },
    { icon: ShieldCheckIcon, title: t("landing.step3Title"), text: t("landing.step3Text") },
    { icon: HandCoinsIcon, title: t("landing.step4Title"), text: t("landing.step4Text") },
  ]
  const faqs = [1, 2, 3, 4] as const

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader
        nav={
          <>
            <a href="#how" className="text-muted-foreground hover:text-foreground">
              {t("landing.navHow")}
            </a>
            <a href="#roles" className="text-muted-foreground hover:text-foreground">
              {t("landing.navRoles")}
            </a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground">
              {t("landing.navPricing")}
            </a>
            <a href="#faq" className="text-muted-foreground hover:text-foreground">
              {t("landing.navFaq")}
            </a>
          </>
        }
      />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-primary)/0.08,transparent_60%)]"
            aria-hidden
          />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.1fr_1fr] lg:py-28">
            <div className="flex flex-col gap-6">
              <Badge variant="outline" className="w-fit gap-1.5 py-1">
                <ShieldCheckIcon className="size-3.5" />
                {t("landing.badge")}
              </Badge>
              <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                {t("landing.title")}
              </h1>
              <p className="max-w-xl text-lg text-pretty text-muted-foreground">
                {t("landing.subtitle")}
              </p>
              <div className="flex flex-wrap gap-3">
                {isAuthenticated ? (
                  <Button asChild size="lg">
                    <Link to="/app">{t("common.openApp")}</Link>
                  </Button>
                ) : (
                  <Button asChild size="lg">
                    <Link to="/sign-in" search={{ mode: "sign-up" }}>
                      {t("landing.ctaPrimary")}
                    </Link>
                  </Button>
                )}
                <Button asChild size="lg" variant="outline">
                  <a href="#how">{t("landing.ctaSecondary")}</a>
                </Button>
              </div>
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                {[t("landing.trust1"), t("landing.trust2"), t("landing.trust3")].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <CheckIcon className="size-4 text-emerald-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <DemoProposal />
          </div>
        </section>

        <section id="how" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-20">
          <div className="mb-10 flex max-w-2xl flex-col gap-2">
            <h2 className="text-3xl font-semibold tracking-tight">{t("landing.howTitle")}</h2>
            <p className="text-muted-foreground">{t("landing.howSubtitle")}</p>
          </div>
          <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <li key={step.title} className="relative flex flex-col gap-3 rounded-xl border p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <step.icon className="size-5" />
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">0{index + 1}</span>
                </div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="roles" className="scroll-mt-20 border-y bg-muted/30">
          <div className="mx-auto w-full max-w-6xl px-6 py-20">
            <h2 className="mb-10 text-3xl font-semibold tracking-tight">
              {t("landing.rolesTitle")}
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <RoleCard
                icon={BriefcaseIcon}
                title={t("landing.freelancersTitle")}
                items={[
                  t("landing.freelancer1"),
                  t("landing.freelancer2"),
                  t("landing.freelancer3"),
                ]}
              />
              <RoleCard
                icon={UserIcon}
                title={t("landing.clientsTitle")}
                items={[t("landing.client1"), t("landing.client2"), t("landing.client3")]}
              />
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-20">
          <div className="flex flex-col items-start justify-between gap-8 rounded-2xl border bg-card p-8 md:flex-row md:items-center">
            <div className="flex max-w-xl flex-col gap-2">
              <h2 className="text-3xl font-semibold tracking-tight">{t("landing.pricingTitle")}</h2>
              <p className="text-muted-foreground">{t("landing.pricingText")}</p>
            </div>
            <div className="flex flex-col items-start md:items-end">
              <span className="text-4xl font-semibold tabular-nums">
                {config ? money(config.feeCents) : "—"}
              </span>
              <span className="text-sm text-muted-foreground">{t("landing.pricingFee")}</span>
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto w-full max-w-3xl scroll-mt-20 px-6 pb-24">
          <h2 className="mb-6 text-3xl font-semibold tracking-tight">{t("landing.faqTitle")}</h2>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((n) => (
              <AccordionItem key={n} value={`faq-${n}`}>
                <AccordionTrigger>{t(`landing.faq${n}Q`)}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {t(`landing.faq${n}A`)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {YEAR} Lunero · {t("landing.footer")}
      </footer>
    </div>
  )
}

function RoleCard({
  icon: Icon,
  title,
  items,
}: {
  icon: typeof UserIcon
  title: string
  items: string[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item} className="flex gap-2 text-sm">
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

/** Static illustration of a contract in progress. */
function DemoProposal() {
  const { t, money } = useI18n()
  const rows = [
    { name: t("landing.demoMilestone1"), price: 80_000, state: "done" },
    { name: t("landing.demoMilestone2"), price: 150_000, state: "active" },
    { name: t("landing.demoMilestone3"), price: 50_000, state: "todo" },
  ] as const
  return (
    <Card className="shadow-xl shadow-primary/5" aria-hidden>
      <CardHeader className="gap-1">
        <CardTitle>{t("landing.demoTitle")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("landing.demoSubtitle")}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ol className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.name} className="flex items-center gap-3 rounded-lg border p-3">
              {row.state === "done" ? (
                <CheckCircle2Icon className="size-5 text-emerald-600" />
              ) : row.state === "active" ? (
                <Loader2Icon className="size-5 animate-spin text-sky-600 [animation-duration:3s]" />
              ) : (
                <CircleDashedIcon className="size-5 text-muted-foreground" />
              )}
              <span className="flex-1 text-sm font-medium">{row.name}</span>
              <span className="text-sm tabular-nums">{money(row.price)}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-2">
          <Progress value={(80_000 / 280_000) * 100} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {t("landing.demoReleased")}: {money(80_000)}
            </span>
            <span>
              {t("landing.demoEscrow")}: {money(200_000)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
