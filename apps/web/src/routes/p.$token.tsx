import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { BriefcaseIcon, LinkIcon, MessageSquareIcon } from "lucide-react"
import { useEffect } from "react"
import { MilestoneList, RespondActions } from "@/components/proposal-parts"
import { PriceSummary } from "@/components/proposal-editor"
import { SiteHeader } from "@/components/site-header"
import { UserAvatar } from "@/components/user-avatar"
import { useI18n } from "@/i18n"
import { useAction } from "@/lib/use-action"

export const Route = createFileRoute("/p/$token")({ component: InvitePage })

function InvitePage() {
  const { token } = Route.useParams()
  const invite = useQuery(api.drafts.getByInvite, { token })
  const navigate = useNavigate()

  // People who are already part of the proposal get the full page instead.
  useEffect(() => {
    if (!invite?.viewer?.isParty) return
    if (invite.contractId) {
      void navigate({
        to: "/app/contracts/$contractId",
        params: { contractId: invite.contractId },
        replace: true,
      })
    } else {
      void navigate({
        to: "/app/proposals/$proposalId",
        params: { proposalId: invite.draftId },
        replace: true,
      })
    }
  }, [invite, navigate])

  return (
    <div className="flex min-h-svh flex-col bg-muted/20">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        {invite === undefined ? (
          <Skeleton className="h-96" />
        ) : (
          <InviteBody token={token} invite={invite} />
        )}
      </main>
    </div>
  )
}

function InviteBody({
  token,
  invite,
}: {
  token: string
  invite: FunctionReturnType<typeof api.drafts.getByInvite>
}) {
  const { t, money } = useI18n()
  const navigate = useNavigate()
  const [enableFreelancer, enabling] = useAction(useMutation(api.users.setFreelancer))

  if (!invite) return <Closed title={t("invite.notFound")} />
  if (invite.viewer?.isParty) return <Skeleton className="h-96" />
  if (invite.seatTaken) return <Closed title={t("invite.taken")} />
  if (invite.status !== "sent") return <Closed title={t("invite.closed")} />

  const creatorName = invite.creator?.name ?? ""
  const visitorRole = invite.creatorRole === "freelancer" ? "contractor" : "freelancer"
  const needsFreelancer =
    visitorRole === "freelancer" && invite.viewer && !invite.viewer.isFreelancer
  const redirect = `/p/${token}`

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 sm:flex-row sm:items-center">
        <UserAvatar user={invite.creator} className="size-12" />
        <div className="flex flex-1 flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            {t("invite.invitedBy", { name: creatorName })}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{invite.title}</h1>
          <p className="text-sm text-muted-foreground">
            {visitorRole === "contractor"
              ? t("invite.asFreelancerText", { name: creatorName })
              : t("invite.asClientText", { name: creatorName })}
          </p>
        </div>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <p className="font-medium">
          {visitorRole === "contractor"
            ? t("proposal.nextRespondClient", { total: money(invite.breakdown.totalCents) })
            : t("proposal.nextRespondFreelancer", {
                total: money(invite.breakdown.totalCents),
                payout: money(invite.breakdown.freelancerCents),
              })}
        </p>
        {!invite.viewer ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">{t("invite.signInToRespond")}</span>
            <Button asChild>
              <Link to="/sign-in" search={{ mode: "sign-up", redirect }}>
                {t("common.signUp")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/sign-in" search={{ redirect }}>
                {t("common.signIn")}
              </Link>
            </Button>
          </div>
        ) : needsFreelancer ? (
          <Alert>
            <BriefcaseIcon />
            <AlertDescription className="flex flex-wrap items-center gap-3">
              {t("invite.needFreelancer")}
              <Button
                size="sm"
                disabled={enabling}
                onClick={() => enableFreelancer({ enabled: true })}
              >
                {t("invite.enableFreelancer")}
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-wrap gap-2">
            <RespondActions
              draftId={invite.draftId}
              inviteToken={token}
              onAccepted={(contractId) =>
                void navigate({ to: "/app/contracts/$contractId", params: { contractId } })
              }
              onCountered={() =>
                void navigate({
                  to: "/app/proposals/$proposalId",
                  params: { proposalId: invite.draftId },
                })
              }
            />
          </div>
        )}
      </section>

      {invite.message ? (
        <div className="flex gap-3 rounded-xl border bg-card p-4 text-sm">
          <MessageSquareIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="whitespace-pre-wrap">{invite.message}</p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          {invite.description ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("proposal.scope")}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap text-muted-foreground">
                {invite.description}
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>{t("proposal.milestones")}</CardTitle>
            </CardHeader>
            <CardContent>
              <MilestoneList milestones={invite.milestones} />
            </CardContent>
          </Card>
        </div>
        <PriceSummary
          milestones={invite.milestones}
          feeCents={invite.breakdown.feeCents}
          myRole={visitorRole}
        />
      </div>
    </div>
  )
}

function Closed({ title }: { title: string }) {
  const { t } = useI18n()
  return (
    <Empty className="border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LinkIcon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{t("landing.subtitle")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link to="/">{t("common.goHome")}</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
