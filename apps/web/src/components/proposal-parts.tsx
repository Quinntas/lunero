import { api } from "@workspace/backend/api"
import type { Doc, Id } from "@workspace/backend/dataModel"
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
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation } from "convex/react"
import { CheckIcon, ClockIcon, PencilIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { ConfirmButton } from "@/components/confirm-button"
import { useI18n } from "@/i18n"
import { useAction } from "@/lib/use-action"

export function MilestoneList({ milestones }: { milestones: Doc<"drafts">["milestones"] }) {
  const { t, money } = useI18n()
  return (
    <ol className="flex flex-col gap-3">
      {milestones.map((milestone, index) => (
        <li key={`${index}-${milestone.name}`} className="flex gap-3 rounded-xl border p-4">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {index + 1}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">{milestone.name}</p>
              <p className="font-semibold tabular-nums">{money(milestone.priceCents)}</p>
            </div>
            {milestone.description ? (
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                {milestone.description}
              </p>
            ) : null}
            {milestone.etaDays ? (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <ClockIcon className="size-3" />
                {t("proposal.etaAfterPayment", { count: milestone.etaDays })}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Accept / propose changes / decline, shared with the public invite page. */
export function RespondActions({
  draftId,
  inviteToken,
  onAccepted,
  onCountered,
}: {
  draftId: Id<"drafts">
  inviteToken?: string
  onAccepted: (contractId: Id<"contracts">) => void
  onCountered?: () => void
}) {
  const { t } = useI18n()
  const [accept, accepting] = useAction(useMutation(api.drafts.accept), t("proposal.accepted"))
  const [counter, countering] = useAction(
    useMutation(api.drafts.counter),
    t("proposal.counterStarted"),
  )
  const [reject, rejecting] = useAction(useMutation(api.drafts.reject), t("proposal.declined"))
  const [reason, setReason] = useState("")

  return (
    <>
      <ConfirmButton
        title={t("proposal.acceptTitle")}
        description={t("proposal.acceptText")}
        confirm={t("proposal.acceptConfirm")}
        pending={accepting}
        onConfirm={async () => {
          const contractId = await accept({ draftId, inviteToken })
          if (contractId) onAccepted(contractId)
        }}
      >
        <CheckIcon />
        {t("proposal.accept")}
      </ConfirmButton>
      <Button
        variant="outline"
        disabled={countering}
        onClick={async () => {
          if ((await counter({ draftId, inviteToken })) !== undefined) onCountered?.()
        }}
      >
        <PencilIcon />
        {t("proposal.counter")}
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" disabled={rejecting}>
            <XIcon />
            {t("proposal.decline")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("proposal.declineTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("proposal.declineText")}</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder={t("proposal.declineReason")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.back")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void reject({ draftId, inviteToken, reason: reason || undefined })}
            >
              {t("proposal.decline")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
