import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { useI18n } from "@/i18n"
import { contractTone, milestoneTone, payoutTone, proposalTone, submissionTone } from "@/lib/status"
import type { Tone } from "@/lib/status"

const kinds = {
  proposal: proposalTone,
  contract: contractTone,
  milestone: milestoneTone,
  payout: payoutTone,
  submission: submissionTone,
}

export const toneClasses: Record<Tone, string> = {
  neutral: "border-border bg-background text-foreground",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  danger: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  muted: "border-border bg-muted text-muted-foreground",
}

const dotClasses: Record<Tone, string> = {
  neutral: "bg-foreground/50",
  info: "bg-sky-500",
  warning: "bg-amber-500",
  success: "bg-emerald-500",
  danger: "bg-red-500",
  muted: "bg-muted-foreground/50",
}

export function StatusBadge({
  kind,
  status,
  className,
}: {
  kind: keyof typeof kinds
  status: string
  className?: string
}) {
  const { tDynamic } = useI18n()
  const tone = kinds[kind][status] ?? "neutral"
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", toneClasses[tone], className)}>
      <span className={cn("size-1.5 rounded-full", dotClasses[tone])} aria-hidden />
      {tDynamic(`status.${kind}.${status}`)}
    </Badge>
  )
}
