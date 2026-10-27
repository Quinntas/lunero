import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import type { Id } from "@workspace/backend/dataModel"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import {
  ArrowRightIcon,
  FileCheck2Icon,
  HourglassIcon,
  LinkIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SendIcon,
  XCircleIcon,
} from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { z } from "zod"
import { ActivityFeed } from "@/components/activity-feed"
import { MilestoneList, RespondActions } from "@/components/proposal-parts"
import { NextStep } from "@/components/next-step"
import { PageHeader } from "@/components/page-header"
import {
  MilestonesEditor,
  PriceSummary,
  ProjectFields,
  toEditable,
  toPayload,
} from "@/components/proposal-editor"
import type { ProposalForm } from "@/components/proposal-editor"
import { ShareDialog } from "@/components/share-dialog"
import { StatusBadge } from "@/components/status-badge"
import { UserAvatar } from "@/components/user-avatar"
import { useI18n } from "@/i18n"
import { firstName } from "@/lib/format"
import { useAction } from "@/lib/use-action"

export const Route = createFileRoute("/app/proposals/$proposalId")({
  validateSearch: z.object({ share: z.boolean().optional() }),
  component: ProposalPage,
})

type Proposal = NonNullable<FunctionReturnType<typeof api.drafts.get>>

function ProposalPage() {
  const { t, relative, errorMessage } = useI18n()
  const { proposalId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const id = proposalId as Id<"drafts">
  const proposal = useQuery(api.drafts.get, { draftId: id })

  const update = useMutation(api.drafts.update)
  const [send, sending] = useAction(useMutation(api.drafts.send), t("proposal.sent"))
  const [cancel] = useAction(useMutation(api.drafts.cancel), t("proposal.cancelled"))
  const [shareOpen, setShareOpen] = useState(Boolean(search.share))
  const [edits, setEdits] = useState<ProposalForm | null>(null)
  const [saving, setSaving] = useState(false)

  // Unsaved local edits; while null the editor shows the live server version.
  const serverForm = useMemo<ProposalForm | undefined>(
    () =>
      proposal && {
        title: proposal.title,
        description: proposal.description,
        message: proposal.message ?? "",
        milestones: toEditable(proposal.milestones),
      },
    [proposal],
  )

  if (!proposal || !serverForm) return <Skeleton className="h-96" />

  const form = edits ?? serverForm
  const dirty = edits !== null
  const { permissions } = proposal

  async function save() {
    setSaving(true)
    try {
      await update({
        draftId: id,
        title: form.title,
        description: form.description,
        message: form.message || undefined,
        milestones: toPayload(form.milestones),
      })
      setEdits(null)
      return true
    } catch (error) {
      toast.error(errorMessage(error))
      return false
    } finally {
      setSaving(false)
    }
  }

  async function saveAndSend() {
    if (dirty && !(await save())) return
    const done = await send({ draftId: id })
    if (done !== undefined && !proposal?.counterpart) setShareOpen(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {proposal.title}
            <StatusBadge kind="proposal" status={proposal.status} />
          </span>
        }
        description={[
          t(proposal.myRole === "freelancer" ? "roles.youAreFreelancer" : "roles.youAreContractor"),
          t("proposal.revision", { revision: proposal.revision }),
          t("proposal.updated", { time: relative(proposal.updatedAt) }),
        ].join(" · ")}
        actions={
          <>
            {permissions.canShare && proposal.inviteToken ? (
              <Button variant="outline" onClick={() => setShareOpen(true)}>
                <LinkIcon />
                {t("proposal.share")}
              </Button>
            ) : null}
            {permissions.canCancel ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="More">
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <CancelProposal onConfirm={() => cancel({ draftId: id })} />
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </>
        }
      />

      <ProposalNextStep
        proposal={proposal}
        sending={sending || saving}
        onSend={saveAndSend}
        onShare={() => setShareOpen(true)}
        onAccepted={(contractId) =>
          void navigate({ to: "/app/contracts/$contractId", params: { contractId } })
        }
      />

      {proposal.message ? (
        <div className="flex gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
          <MessageSquareIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="whitespace-pre-wrap">{proposal.message}</p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          {permissions.canEdit ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{t("wizard.step2")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ProjectFields
                    value={form}
                    onChange={(patch) => setEdits({ ...form, ...patch })}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{t("proposal.milestones")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <MilestonesEditor
                    milestones={form.milestones}
                    onChange={(milestones) => setEdits({ ...form, milestones })}
                  />
                </CardContent>
              </Card>
              {dirty ? (
                <div className="sticky bottom-4 z-20 flex items-center justify-between gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
                  <span className="text-sm font-medium">{t("proposal.unsaved")}</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setEdits(null)}>
                      {t("proposal.discard")}
                    </Button>
                    <Button onClick={save} disabled={saving}>
                      {saving ? <Spinner /> : null}
                      {t("proposal.save")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{t("proposal.scope")}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {proposal.description || t("proposal.noScope")}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{t("proposal.milestones")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <MilestoneList milestones={proposal.milestones} />
                </CardContent>
              </Card>
            </>
          )}
        </div>
        <div className="flex flex-col gap-6">
          <PriceSummary
            milestones={form.milestones}
            feeCents={proposal.breakdown.feeCents}
            myRole={proposal.myRole}
          />
          <Card>
            <CardHeader>
              <CardTitle>{t("proposal.parties")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Party label={t("roles.freelancer")} user={proposal.freelancer} />
              <Party label={t("roles.contractor")} user={proposal.contractor} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("proposal.history")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed entries={proposal.activity} />
            </CardContent>
          </Card>
        </div>
      </div>

      {proposal.inviteToken ? (
        <ShareDialog
          token={proposal.inviteToken}
          sent={proposal.status === "sent"}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />
      ) : null}
    </div>
  )
}

function Party({
  label,
  user,
}: {
  label: string
  user: { name: string; email: string; image?: string } | null
}) {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-3">
      {user ? (
        <UserAvatar user={user} className="size-9" />
      ) : (
        <span className="flex size-9 items-center justify-center rounded-full border border-dashed">
          <LinkIcon className="size-4 text-muted-foreground" />
        </span>
      )}
      <div className="min-w-0 text-sm">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-medium">{user?.name ?? t("proposal.pending")}</p>
      </div>
    </div>
  )
}

function CancelProposal({ onConfirm }: { onConfirm: () => unknown }) {
  const { t } = useI18n()
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
          <XCircleIcon />
          {t("proposal.cancel")}
        </DropdownMenuItem>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("proposal.cancelTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("proposal.cancelText")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.back")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => void onConfirm()}>
            {t("proposal.cancel")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ProposalNextStep({
  proposal,
  sending,
  onSend,
  onShare,
  onAccepted,
}: {
  proposal: Proposal
  sending: boolean
  onSend: () => void
  onShare: () => void
  onAccepted: (contractId: Id<"contracts">) => void
}) {
  const { t, money } = useI18n()
  const name = firstName(proposal.counterpart?.name)
  const { permissions } = proposal

  if (proposal.status === "accepted" && proposal.contractId) {
    return (
      <NextStep
        variant="success"
        icon={FileCheck2Icon}
        title={t("proposal.nextAcceptedTitle")}
        description={t("proposal.nextAcceptedText")}
      >
        <Button asChild>
          <Link to="/app/contracts/$contractId" params={{ contractId: proposal.contractId }}>
            {t("proposal.goToContract")}
            <ArrowRightIcon />
          </Link>
        </Button>
      </NextStep>
    )
  }
  if (proposal.status === "rejected" || proposal.status === "cancelled") {
    return <NextStep variant="closed" icon={XCircleIcon} title={t("proposal.nextClosedTitle")} />
  }
  if (proposal.status === "editing") {
    if (!permissions.canEdit) {
      return (
        <NextStep
          variant="waiting"
          icon={HourglassIcon}
          title={t("proposal.nextWaitingEditTitle", { name })}
          description={t("proposal.nextWaitingEditText")}
        />
      )
    }
    const countering = proposal.revision > 0
    return (
      <NextStep
        variant="action"
        icon={PencilIcon}
        title={countering ? t("proposal.nextEditingCounterTitle") : t("proposal.nextEditingTitle")}
        description={
          countering
            ? t("proposal.nextEditingCounterText", { name })
            : t("proposal.nextEditingText")
        }
      >
        <Button onClick={onSend} disabled={sending}>
          {sending ? <Spinner /> : proposal.counterpart ? <SendIcon /> : <LinkIcon />}
          {proposal.counterpart ? t("proposal.sendTo", { name }) : t("proposal.sendAndShare")}
        </Button>
      </NextStep>
    )
  }
  // status === "sent"
  if (permissions.canAccept) {
    const isClient = proposal.myRole === "contractor"
    return (
      <NextStep
        variant="action"
        icon={FileCheck2Icon}
        title={t("proposal.nextRespondTitle")}
        description={
          isClient
            ? t("proposal.nextRespondClient", { total: money(proposal.breakdown.totalCents) })
            : t("proposal.nextRespondFreelancer", {
                total: money(proposal.breakdown.totalCents),
                payout: money(proposal.breakdown.freelancerCents),
              })
        }
      >
        <RespondActions draftId={proposal._id} onAccepted={onAccepted} />
      </NextStep>
    )
  }
  if (!proposal.counterpart) {
    return (
      <NextStep
        variant="action"
        icon={LinkIcon}
        title={t("proposal.nextWaitingLinkTitle")}
        description={t("proposal.nextWaitingLinkText")}
      >
        <Button onClick={onShare}>
          <LinkIcon />
          {t("proposal.share")}
        </Button>
      </NextStep>
    )
  }
  return (
    <NextStep
      variant="waiting"
      icon={HourglassIcon}
      title={t("proposal.nextWaitingTitle", { name })}
      description={t("proposal.nextWaitingText")}
    />
  )
}
