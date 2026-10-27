import { Link, createFileRoute } from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import type { Id } from "@workspace/backend/dataModel"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { useAction as useConvexAction, useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import {
  BanknoteIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleDashedIcon,
  ClipboardCheckIcon,
  CreditCardIcon,
  HourglassIcon,
  Loader2Icon,
  PartyPopperIcon,
  PlayIcon,
  RotateCcwIcon,
  SendIcon,
  UndoIcon,
  UploadIcon,
  XCircleIcon,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { z } from "zod"
import { ActivityFeed } from "@/components/activity-feed"
import { ConfirmButton } from "@/components/confirm-button"
import { NextStep } from "@/components/next-step"
import { PageHeader } from "@/components/page-header"
import { FilePicker, ProofFileList, useProofUpload } from "@/components/proof-files"
import { StatusBadge } from "@/components/status-badge"
import { Stepper } from "@/components/stepper"
import { UserAvatar } from "@/components/user-avatar"
import { useI18n } from "@/i18n"
import { useAction } from "@/lib/use-action"

export const Route = createFileRoute("/app/contracts/$contractId")({
  validateSearch: z.object({ checkout: z.enum(["success", "cancelled"]).optional() }),
  component: ContractPage,
})

type Contract = NonNullable<FunctionReturnType<typeof api.contracts.get>>
type Milestone = Contract["milestones"][number]

function lifecycleStep(status: Contract["status"]) {
  if (status === "completed") return 4
  if (status === "active") return 2
  return 1
}

function ContractPage() {
  const { t } = useI18n()
  const { contractId } = Route.useParams()
  const { checkout } = Route.useSearch()
  const contract = useQuery(api.contracts.get, { contractId: contractId as Id<"contracts"> })
  const [cancel, cancelling] = useAction(useMutation(api.contracts.cancel), t("contract.cancelled"))

  if (!contract) return <Skeleton className="h-96" />

  const isContractor = contract.myRole === "contractor"
  const counterpart = isContractor ? contract.freelancer : contract.contractor
  const nextOpen = contract.milestones.find((m) => m.status !== "approved")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {contract.title}
            <StatusBadge kind="contract" status={contract.status} />
          </span>
        }
        description={
          <>
            {t(isContractor ? "roles.youAreContractor" : "roles.youAreFreelancer")} ·{" "}
            {t("contract.withPerson", { name: counterpart?.name ?? "" })} ·{" "}
            <Link
              to="/app/proposals/$proposalId"
              params={{ proposalId: contract.draftId }}
              className="underline-offset-4 hover:underline"
            >
              {t("contract.original")}
            </Link>
          </>
        }
        actions={
          contract.permissions.canCancel ? (
            <ConfirmButton
              title={t("contract.cancelTitle")}
              description={t("contract.cancelText")}
              confirm={t("contract.cancel")}
              variant="ghost"
              pending={cancelling}
              onConfirm={() => cancel({ contractId: contract._id })}
            >
              {t("contract.cancel")}
            </ConfirmButton>
          ) : null
        }
      />

      {contract.status !== "cancelled" ? (
        <Card>
          <CardContent>
            <Stepper
              steps={[
                t("contract.stepAccepted"),
                t("contract.stepFunded"),
                t("contract.stepWork"),
                t("contract.stepDone"),
              ]}
              current={lifecycleStep(contract.status)}
            />
          </CardContent>
        </Card>
      ) : null}

      <ContractNextStep contract={contract} checkout={checkout} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{t("proposal.milestones")}</h2>
          <ol className="flex flex-col">
            {contract.milestones.map((milestone, index) => (
              <MilestoneItem
                key={milestone._id}
                milestone={milestone}
                isContractor={isContractor}
                funded={contract.status === "active" || contract.status === "completed"}
                isLast={index === contract.milestones.length - 1}
                defaultOpen={milestone._id === nextOpen?._id}
              />
            ))}
          </ol>
        </div>
        <div className="flex flex-col gap-6">
          <EscrowCard contract={contract} />
          <Card>
            <CardHeader>
              <CardTitle>{t("proposal.parties")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {(
                [
                  [t("roles.freelancer"), contract.freelancer],
                  [t("roles.contractor"), contract.contractor],
                ] as const
              ).map(([label, user]) => (
                <div key={label} className="flex items-center gap-3">
                  <UserAvatar user={user} className="size-9" />
                  <div className="min-w-0 text-sm">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="truncate font-medium">{user?.name}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          {contract.description ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("proposal.scope")}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap text-muted-foreground">
                {contract.description}
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>{t("proposal.history")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed entries={contract.activity} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ContractNextStep({ contract, checkout }: { contract: Contract; checkout?: string }) {
  const { t, money, errorMessage } = useI18n()
  const createCheckout = useConvexAction(api.stripe.createCheckout)
  const [paying, setPaying] = useState(false)
  const isContractor = contract.myRole === "contractor"

  async function pay() {
    setPaying(true)
    try {
      const { url } = await createCheckout({ contractId: contract._id })
      window.location.assign(url)
    } catch (error) {
      toast.error(errorMessage(error))
      setPaying(false)
    }
  }

  const total = money(contract.totalCents)
  switch (contract.status) {
    case "cancelled":
      return (
        <NextStep variant="closed" icon={XCircleIcon} title={t("contract.nextCancelledTitle")} />
      )
    case "completed":
      return (
        <NextStep
          variant="success"
          icon={PartyPopperIcon}
          title={t("contract.nextDoneTitle")}
          description={t("contract.nextDoneText")}
        />
      )
    case "awaiting_payment":
    case "payment_processing": {
      const processing = contract.status === "payment_processing" || checkout === "success"
      if (!isContractor) {
        return (
          <NextStep
            variant="waiting"
            icon={HourglassIcon}
            title={t("contract.nextWaitingFundTitle")}
            description={t("contract.nextWaitingFundText")}
          />
        )
      }
      return (
        <NextStep
          variant={processing ? "waiting" : "action"}
          icon={processing ? Loader2Icon : CreditCardIcon}
          title={processing ? t("contract.nextProcessingTitle") : t("contract.nextFundTitle")}
          description={
            processing ? t("contract.nextProcessingText") : t("contract.nextFundText", { total })
          }
        >
          <Button onClick={pay} disabled={paying} variant={processing ? "outline" : "default"}>
            {paying ? <Spinner /> : <CreditCardIcon />}
            {processing ? t("contract.reopenCheckout") : t("contract.pay", { total })}
          </Button>
        </NextStep>
      )
    }
    case "active": {
      if (isContractor) {
        const toReview = contract.milestones.find((m) => m.status === "submitted")
        if (toReview) {
          return (
            <NextStep
              variant="action"
              icon={ClipboardCheckIcon}
              title={t("contract.nextReviewTitle", { name: toReview.name })}
              description={t("contract.nextReviewText", { amount: money(toReview.payoutCents) })}
            >
              <ReviewActions milestone={toReview} />
            </NextStep>
          )
        }
        if (checkout === "success") {
          return (
            <NextStep variant="success" icon={CheckIcon} title={t("contract.paymentConfirmed")} />
          )
        }
        return (
          <NextStep
            variant="waiting"
            icon={HourglassIcon}
            title={t("contract.nextWaitingWorkTitle")}
            description={t("contract.nextWaitingWorkText")}
          />
        )
      }
      const toDeliver = contract.milestones.find((m) => m.permissions.canSubmit)
      return toDeliver ? (
        <NextStep
          variant="action"
          icon={UploadIcon}
          title={t("contract.nextDeliverTitle", { name: toDeliver.name })}
          description={t("contract.nextDeliverText", { amount: money(toDeliver.payoutCents) })}
        >
          <SubmitDialog milestone={toDeliver} />
        </NextStep>
      ) : (
        <NextStep
          variant="waiting"
          icon={HourglassIcon}
          title={t("contract.nextWaitingReviewTitle")}
          description={t("contract.nextWaitingReviewText")}
        />
      )
    }
  }
}

function EscrowCard({ contract }: { contract: Contract }) {
  const { t, money } = useI18n()
  const funded = contract.status === "active" || contract.status === "completed"
  const net = contract.totalCents - contract.feeCents
  const released = contract.releasedCents
  const held = funded ? net - released : 0
  const pct = (value: number) => (net > 0 ? (value / net) * 100 : 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("contract.escrowTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
          <div className="bg-emerald-500" style={{ width: `${pct(released)}%` }} />
          <div className="bg-sky-500" style={{ width: `${pct(held)}%` }} />
        </div>
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-emerald-500" />
              {t("contract.released")}
            </dt>
            <dd className="font-semibold tabular-nums">{money(released)}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-sky-500" />
              {t("contract.escrow")}
            </dt>
            <dd className="font-semibold tabular-nums">{money(held)}</dd>
          </div>
        </dl>
        <div className="flex flex-col gap-1 border-t pt-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("contract.total")}</span>
            <span className="tabular-nums">{money(contract.totalCents)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("contract.fee")}</span>
            <span className="tabular-nums">− {money(contract.feeCents)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const milestoneIcon = {
  pending: {
    icon: CircleDashedIcon,
    className: "border-border bg-background text-muted-foreground",
  },
  in_progress: { icon: Loader2Icon, className: "border-sky-500/40 bg-sky-500/10 text-sky-600" },
  submitted: {
    icon: ClipboardCheckIcon,
    className: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  },
  changes_requested: { icon: UndoIcon, className: "border-red-500/40 bg-red-500/10 text-red-600" },
  approved: { icon: CheckIcon, className: "border-emerald-500 bg-emerald-500 text-white" },
} as const

function MilestoneItem({
  milestone,
  isContractor,
  funded,
  isLast,
  defaultOpen,
}: {
  milestone: Milestone
  isContractor: boolean
  funded: boolean
  isLast: boolean
  defaultOpen: boolean
}) {
  const { t, tDynamic, money, date, relative } = useI18n()
  const [start, starting] = useAction(useMutation(api.milestones.start), t("contract.started"))
  const [retry, retrying] = useAction(
    useMutation(api.milestones.retryPayout),
    t("contract.retrying"),
  )
  const [open, setOpen] = useState(defaultOpen)
  const [now] = useState(() => Date.now())
  const { permissions } = milestone
  const style = milestoneIcon[milestone.status]
  const overdue =
    milestone.dueAt !== undefined && milestone.dueAt < now && milestone.status !== "approved"
  const payoutProblem = milestone.payoutStatus === "blocked" || milestone.payoutStatus === "failed"
  const hasActions =
    permissions.canStart ||
    permissions.canSubmit ||
    permissions.canReview ||
    permissions.canRetryPayout

  return (
    <li className="relative flex gap-4 pb-4">
      {!isLast ? (
        <span className="absolute top-10 bottom-0 left-[19px] w-px bg-border" aria-hidden />
      ) : null}
      <span
        className={cn(
          "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2",
          style.className,
        )}
      >
        <style.icon className="size-4" />
      </span>
      <Collapsible open={open} onOpenChange={setOpen} className="min-w-0 flex-1">
        <div className="rounded-xl border bg-card">
          <CollapsibleTrigger asChild>
            <button type="button" className="flex w-full items-start gap-3 p-4 text-left">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-medium">
                  {milestone.order + 1}. {milestone.name}
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground tabular-nums">
                    {money(milestone.priceCents)}
                  </span>
                  <span>{t("contract.receives", { amount: money(milestone.payoutCents) })}</span>
                  {milestone.dueAt ? (
                    <span
                      className={cn(
                        "flex items-center gap-1",
                        overdue && "font-medium text-red-600",
                      )}
                    >
                      <CalendarIcon className="size-3" />
                      {overdue
                        ? t("contract.overdue", { date: date(milestone.dueAt) })
                        : t("contract.due", { date: date(milestone.dueAt) })}
                    </span>
                  ) : milestone.etaDays ? (
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="size-3" />
                      {t("proposal.etaAfterPayment", { count: milestone.etaDays })}
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge kind="milestone" status={milestone.status} />
                {funded && milestone.status === "approved" ? (
                  <StatusBadge kind="payout" status={milestone.payoutStatus} />
                ) : null}
              </div>
              <ChevronDownIcon
                className={cn(
                  "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
                  open && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="flex flex-col gap-4 border-t p-4">
              {milestone.description ? (
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {milestone.description}
                </p>
              ) : null}

              {payoutProblem && milestone.payoutError ? (
                <Alert variant="destructive">
                  <BanknoteIcon />
                  <AlertTitle>{t("contract.payoutHeld")}</AlertTitle>
                  <AlertDescription>
                    {tDynamic(`payout.${milestone.payoutError}`, {}, milestone.payoutError)}
                    {!isContractor ? (
                      <Link
                        to="/app/settings"
                        search={{ tab: "freelancer" }}
                        className="font-medium underline underline-offset-4"
                      >
                        {t("contract.setupPayouts")}
                      </Link>
                    ) : null}
                  </AlertDescription>
                </Alert>
              ) : null}

              {milestone.submissions.length ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-medium">{t("contract.deliveries")}</p>
                  {milestone.submissions.map((submission) => (
                    <div
                      key={submission._id}
                      className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <time className="text-xs text-muted-foreground">
                          {relative(submission._creationTime)}
                        </time>
                        <StatusBadge kind="submission" status={submission.status} />
                      </div>
                      {submission.note ? (
                        <p className="text-sm whitespace-pre-wrap">{submission.note}</p>
                      ) : null}
                      <ProofFileList submissionId={submission._id} files={submission.files} />
                      {submission.reviewNote ? (
                        <p className="rounded-md border-l-2 border-primary bg-background p-2 text-sm whitespace-pre-wrap">
                          <span className="font-medium">{t("contract.clientNote")}: </span>
                          {submission.reviewNote}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {hasActions ? (
                <div className="flex flex-wrap gap-2">
                  {permissions.canStart ? (
                    <Button
                      variant="outline"
                      onClick={() => start({ milestoneId: milestone._id })}
                      disabled={starting}
                    >
                      <PlayIcon />
                      {t("contract.start")}
                    </Button>
                  ) : null}
                  {permissions.canSubmit ? <SubmitDialog milestone={milestone} /> : null}
                  {permissions.canReview ? <ReviewActions milestone={milestone} /> : null}
                  {permissions.canRetryPayout ? (
                    <Button
                      variant="outline"
                      onClick={() => retry({ milestoneId: milestone._id })}
                      disabled={retrying}
                    >
                      <RotateCcwIcon />
                      {t("contract.retryPayout")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </li>
  )
}

function SubmitDialog({ milestone }: { milestone: Milestone }) {
  const { t, money, errorMessage } = useI18n()
  const submit = useMutation(api.milestones.submit)
  const upload = useProofUpload(milestone._id)
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [pending, setPending] = useState(false)

  async function onSubmit() {
    setPending(true)
    try {
      const uploaded = await upload(files)
      await submit({ milestoneId: milestone._id, note, files: uploaded })
      toast.success(t("contract.submitted"))
      setOpen(false)
      setNote("")
      setFiles([])
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <SendIcon />
          {milestone.status === "changes_requested" ? t("contract.resubmit") : t("contract.submit")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("contract.submitTitle", { name: milestone.name })}</DialogTitle>
          <DialogDescription>
            {t("contract.submitText", { amount: money(milestone.payoutCents) })}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="submission-note">{t("contract.submitNote")}</FieldLabel>
            <Textarea
              id="submission-note"
              rows={5}
              value={note}
              placeholder={t("contract.submitNotePlaceholder")}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>{t("contract.submitFiles")}</FieldLabel>
            <FilePicker files={files} onChange={setFiles} />
            <FieldDescription>{t("contract.submitFilesHint")}</FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={pending || (!note.trim() && files.length === 0)}>
            {pending ? <Spinner /> : <SendIcon />}
            {t("contract.submitSend")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReviewActions({ milestone }: { milestone: Milestone }) {
  const { t, money } = useI18n()
  const [approve, approving] = useAction(
    useMutation(api.milestones.approve),
    t("contract.approved"),
  )
  const [requestChanges, requesting] = useAction(
    useMutation(api.milestones.requestChanges),
    t("contract.changesRequested"),
  )
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")

  return (
    <>
      <ConfirmButton
        title={t("contract.approveTitle", { name: milestone.name })}
        description={t("contract.approveText", { amount: money(milestone.payoutCents) })}
        confirm={t("contract.approve")}
        pending={approving}
        onConfirm={() => approve({ milestoneId: milestone._id })}
      >
        <CheckIcon />
        {t("contract.approve")}
      </ConfirmButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <UndoIcon />
            {t("contract.requestChanges")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("contract.requestChangesTitle")}</DialogTitle>
            <DialogDescription>{t("contract.requestChangesText")}</DialogDescription>
          </DialogHeader>
          <Textarea rows={5} value={note} onChange={(e) => setNote(e.target.value)} />
          <DialogFooter>
            <Button
              disabled={requesting || !note.trim()}
              onClick={async () => {
                if ((await requestChanges({ milestoneId: milestone._id, note })) !== undefined) {
                  setOpen(false)
                  setNote("")
                }
              }}
            >
              {requesting ? <Spinner /> : null}
              {t("contract.requestChangesSend")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
