import { Link, createFileRoute } from "@tanstack/react-router"
import type { LinkProps } from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Progress } from "@workspace/ui/components/progress"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import {
  BanknoteIcon,
  BriefcaseIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  CircleIcon,
  ClipboardCheckIcon,
  CreditCardIcon,
  FileTextIcon,
  PartyPopperIcon,
  PlusIcon,
  SendIcon,
  UploadIcon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { useI18n } from "@/i18n"
import type { I18n } from "@/i18n"
import { firstName } from "@/lib/format"

export const Route = createFileRoute("/app/")({ component: Dashboard })

type Proposals = FunctionReturnType<typeof api.drafts.list>
type Contracts = FunctionReturnType<typeof api.contracts.list>
type Me = NonNullable<FunctionReturnType<typeof api.users.me>>

type Todo = {
  key: string
  icon: LucideIcon
  title: string
  text: string
  link: LinkProps
}

function buildTodos(i18n: I18n, me: Me, proposals: Proposals, contracts: Contracts): Todo[] {
  const { t, money } = i18n
  const todos: Todo[] = []
  for (const p of proposals) {
    if (!p.isMyTurn) continue
    const link = { to: "/app/proposals/$proposalId", params: { proposalId: p._id } } as const
    if (p.status === "sent") {
      todos.push({
        key: `p-${p._id}`,
        icon: FileTextIcon,
        title: t("dashboard.todoReviewProposal", { title: p.title }),
        text: t("dashboard.todoReviewProposalText", { name: p.counterpart?.name ?? "" }),
        link,
      })
    } else if (p.status === "editing") {
      todos.push({
        key: `p-${p._id}`,
        icon: SendIcon,
        title: t("dashboard.todoSendProposal", { title: p.title }),
        text: t("dashboard.todoSendProposalText"),
        link,
      })
    }
  }
  for (const c of contracts) {
    const link = { to: "/app/contracts/$contractId", params: { contractId: c._id } } as const
    if (c.myRole === "contractor" && c.status === "awaiting_payment") {
      todos.push({
        key: `fund-${c._id}`,
        icon: CreditCardIcon,
        title: t("dashboard.todoFund", { title: c.title }),
        text: t("dashboard.todoFundText", { amount: money(c.totalCents) }),
        link,
      })
    }
    if (c.myRole === "contractor" && c.awaitingReview > 0) {
      todos.push({
        key: `review-${c._id}`,
        icon: ClipboardCheckIcon,
        title: t("dashboard.todoReview", { title: c.title, count: c.awaitingReview }),
        text: t("dashboard.todoReviewText"),
        link,
      })
    }
    if (c.myRole === "freelancer" && c.status === "active" && c.toDeliver > 0) {
      todos.push({
        key: `deliver-${c._id}`,
        icon: UploadIcon,
        title: t("dashboard.todoDeliver", { title: c.title }),
        text: t("dashboard.todoDeliverText", { count: c.toDeliver }),
        link,
      })
    }
  }
  const blocked = contracts.some((c) => c.myRole === "freelancer" && c.blockedPayouts > 0)
  if (blocked && !me.stripePayoutsEnabled) {
    todos.unshift({
      key: "payouts",
      icon: BanknoteIcon,
      title: t("dashboard.todoPayout"),
      text: t("dashboard.todoPayoutText"),
      link: { to: "/app/settings", search: { tab: "freelancer" } },
    })
  }
  return todos
}

function Dashboard() {
  const i18n = useI18n()
  const { t, money } = i18n
  const me = useQuery(api.users.me)
  const proposals = useQuery(api.drafts.list)
  const contracts = useQuery(api.contracts.list)

  if (!me || !proposals || !contracts) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-72" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  const todos = buildTodos(i18n, me, proposals, contracts)
  const funded = contracts.filter((c) => c.status === "active" || c.status === "completed")
  const escrow = funded.reduce((sum, c) => sum + (c.totalCents - c.feeCents - c.releasedCents), 0)
  const released = funded
    .filter((c) => c.myRole === "freelancer")
    .reduce((sum, c) => sum + c.releasedCents, 0)
  const active = contracts.filter((c) => c.status === "active").length
  const isNew = proposals.length === 0 && contracts.length === 0

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("dashboard.greeting", { name: firstName(me.name) })}
        description={t("dashboard.subtitle")}
        actions={
          <Button asChild>
            <Link to="/app/proposals/new">
              <PlusIcon />
              {t("nav.newProposal")}
            </Link>
          </Button>
        }
      />

      {isNew ? <Onboarding me={me} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Stat
          label={t("dashboard.statEscrow")}
          value={money(escrow)}
          hint={t("dashboard.statEscrowHint")}
        />
        <Stat
          label={t("dashboard.statReleased")}
          value={money(released)}
          hint={t("dashboard.statReleasedHint")}
        />
        <Stat
          label={t("dashboard.statActive")}
          value={String(active)}
          hint={t("dashboard.statActiveHint")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.attentionTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {todos.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                <PartyPopperIcon className="size-6" />
                {t("dashboard.attentionEmpty")}
              </div>
            ) : (
              <ItemGroup className="gap-2">
                {todos.map((todo) => (
                  <Item key={todo.key} variant="outline" asChild>
                    <Link {...todo.link}>
                      <ItemMedia variant="icon">
                        <todo.icon />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>{todo.title}</ItemTitle>
                        <ItemDescription>{todo.text}</ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <ChevronRightIcon className="size-4" />
                      </ItemActions>
                    </Link>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.recentTitle")}</CardTitle>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link to="/app/contracts">{t("common.viewAll")}</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {contracts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("dashboard.recentEmpty")}
              </p>
            ) : (
              <ItemGroup className="gap-2">
                {contracts.slice(0, 5).map((contract) => (
                  <Item key={contract._id} variant="outline" size="sm" asChild>
                    <Link to="/app/contracts/$contractId" params={{ contractId: contract._id }}>
                      <ItemContent className="gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <ItemTitle className="truncate">{contract.title}</ItemTitle>
                          <StatusBadge kind="contract" status={contract.status} />
                        </div>
                        <ItemDescription>
                          {t(
                            contract.myRole === "freelancer"
                              ? "roles.youAreFreelancer"
                              : "roles.youAreContractor",
                          )}{" "}
                          · {contract.counterpart?.name}
                        </ItemDescription>
                        <Progress
                          value={
                            (contract.approvedCount / Math.max(contract.milestoneCount, 1)) * 100
                          }
                        />
                      </ItemContent>
                    </Link>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>
    </Card>
  )
}

function Onboarding({ me }: { me: Me }) {
  const { t } = useI18n()
  const steps = [
    {
      done: Boolean(me.headline),
      label: t("dashboard.onboardingProfile"),
      link: { to: "/app/settings" },
    },
    {
      done: me.isFreelancer,
      label: t("dashboard.onboardingFreelancer"),
      link: { to: "/app/settings", search: { tab: "freelancer" } },
    },
    { done: false, label: t("dashboard.onboardingProposal"), link: { to: "/app/proposals/new" } },
  ] as const
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BriefcaseIcon className="size-5 text-primary" />
          {t("dashboard.onboardingTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-2 md:grid-cols-3">
          {steps.map((step) => (
            <li key={step.label}>
              <Link
                {...step.link}
                className={cn(
                  "flex h-full items-center gap-3 rounded-lg border bg-background p-3 text-sm transition-colors hover:bg-muted",
                  step.done && "text-muted-foreground line-through",
                )}
              >
                {step.done ? (
                  <CheckCircle2Icon className="size-5 shrink-0 text-emerald-600" />
                ) : (
                  <CircleIcon className="size-5 shrink-0 text-muted-foreground" />
                )}
                {step.label}
              </Link>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
