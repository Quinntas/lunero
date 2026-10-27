import { api } from "@workspace/backend/api"
import { MAX_MILESTONES, breakdown } from "@workspace/backend/shared/money"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group"
import { Separator } from "@workspace/ui/components/separator"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { useQuery } from "convex/react"
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { MoneyInput } from "@/components/money-input"
import { useI18n } from "@/i18n"

export type MilestoneDraft = {
  /** Client-only key so inputs keep their identity when milestones move. */
  uid: string
  name: string
  description: string
  priceCents: number
  etaDays?: number
}

export type ProposalForm = {
  title: string
  description: string
  message: string
  milestones: MilestoneDraft[]
}

export const emptyMilestone = (): MilestoneDraft => ({
  uid: crypto.randomUUID(),
  name: "",
  description: "",
  priceCents: 0,
})

export const toEditable = (milestones: Omit<MilestoneDraft, "uid">[]): MilestoneDraft[] =>
  milestones.map((milestone) => ({ ...milestone, uid: crypto.randomUUID() }))

export const toPayload = (milestones: MilestoneDraft[]) =>
  milestones.map(({ uid: _uid, ...milestone }) => milestone)

export function usePlatformFee() {
  return useQuery(api.users.platformConfig)?.feeCents ?? 0
}

export function ProjectFields({
  value,
  onChange,
}: {
  value: Pick<ProposalForm, "title" | "description">
  onChange: (patch: Partial<ProposalForm>) => void
}) {
  const { t } = useI18n()
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="title">{t("wizard.projectTitle")}</FieldLabel>
        <Input
          id="title"
          value={value.title}
          maxLength={160}
          placeholder={t("wizard.projectTitlePlaceholder")}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="description">{t("wizard.projectDescription")}</FieldLabel>
        <Textarea
          id="description"
          rows={6}
          value={value.description}
          placeholder={t("wizard.projectDescriptionPlaceholder")}
          onChange={(e) => onChange({ description: e.target.value })}
        />
        <FieldDescription>{t("wizard.projectDescriptionHint")}</FieldDescription>
      </Field>
    </FieldGroup>
  )
}

export function MilestonesEditor({
  milestones,
  onChange,
}: {
  milestones: MilestoneDraft[]
  onChange: (milestones: MilestoneDraft[]) => void
}) {
  const { t } = useI18n()
  const update = (index: number, patch: Partial<MilestoneDraft>) =>
    onChange(milestones.map((m, i) => (i === index ? { ...m, ...patch } : m)))
  const move = (index: number, delta: number) => {
    const next = [...milestones]
    const [item] = next.splice(index, 1)
    next.splice(index + delta, 0, item!)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      {milestones.map((milestone, index) => (
        <div
          key={milestone.uid}
          className="group relative flex gap-3 rounded-xl border bg-card p-4"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {index + 1}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Field>
              <FieldLabel htmlFor={`m-${index}-name`} className="sr-only">
                {t("editor.name")}
              </FieldLabel>
              <Input
                id={`m-${index}-name`}
                value={milestone.name}
                maxLength={120}
                placeholder={t("editor.namePlaceholder")}
                aria-label={t("editor.name")}
                onChange={(e) => update(index, { name: e.target.value })}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`m-${index}-price`} className="sr-only">
                  {t("editor.price")}
                </FieldLabel>
                <MoneyInput
                  id={`m-${index}-price`}
                  aria-label={t("editor.price")}
                  value={milestone.priceCents}
                  onValueChange={(priceCents) => update(index, { priceCents })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`m-${index}-eta`} className="sr-only">
                  {t("editor.eta")}
                </FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id={`m-${index}-eta`}
                    type="number"
                    min={1}
                    max={3650}
                    aria-label={t("editor.eta")}
                    title={t("editor.etaHint")}
                    placeholder={t("editor.etaPlaceholder")}
                    value={milestone.etaDays ?? ""}
                    onChange={(e) =>
                      update(index, {
                        etaDays: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                  />
                  <InputGroupAddon align="inline-end" className="text-xs">
                    {t("editor.etaPlaceholder").toLowerCase()}
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            </div>
            <Textarea
              id={`m-${index}-description`}
              rows={2}
              value={milestone.description}
              aria-label={t("editor.description")}
              placeholder={t("editor.descriptionPlaceholder")}
              onChange={(e) => update(index, { description: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("editor.moveUp")}
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              <ArrowUpIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("editor.moveDown")}
              disabled={index === milestones.length - 1}
              onClick={() => move(index, 1)}
            >
              <ArrowDownIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("editor.remove")}
              disabled={milestones.length === 1}
              onClick={() => onChange(milestones.filter((_, i) => i !== index))}
            >
              <Trash2Icon />
            </Button>
          </div>
        </div>
      ))}
      <Button
        variant="outline"
        className="border-dashed"
        disabled={milestones.length >= MAX_MILESTONES}
        onClick={() => onChange([...milestones, emptyMilestone()])}
      >
        <PlusIcon />
        {t("editor.add")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("editor.etaHint")}</p>
    </div>
  )
}

/** Price breakdown written from the viewer's point of view. */
export function PriceSummary({
  milestones,
  feeCents,
  myRole,
  className,
}: {
  milestones: { name: string; priceCents: number }[]
  feeCents: number
  myRole: "freelancer" | "contractor"
  className?: string
}) {
  const { t, money } = useI18n()
  const totals = breakdown(
    milestones.map((m) => m.priceCents),
    feeCents,
  )
  const feeTooHigh = totals.totalCents <= feeCents
  const isClient = myRole === "contractor"

  return (
    <Card className={cn("h-fit", className)}>
      <CardHeader>
        <CardTitle>{t("summary.title")}</CardTitle>
        <CardDescription>{t("summary.feeNote")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {milestones.map((milestone, index) => (
          <div key={`${index}-${milestone.name}`} className="flex justify-between gap-4">
            <span className="truncate text-muted-foreground">
              {index + 1}. {milestone.name || t("summary.noName")}
            </span>
            <span className="tabular-nums">{money(milestone.priceCents)}</span>
          </div>
        ))}
        <Separator />
        <div className="flex justify-between">
          <span>{isClient ? t("summary.youPay") : t("summary.clientPays")}</span>
          <span className="font-semibold tabular-nums">{money(totals.totalCents)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>{t("summary.fee")}</span>
          <span className="tabular-nums">− {money(feeCents)}</span>
        </div>
        <div className="flex justify-between rounded-lg bg-muted/60 px-3 py-2">
          <span className="font-medium">
            {isClient ? t("summary.freelancerGets") : t("summary.youGet")}
          </span>
          <span className="font-semibold tabular-nums">
            {money(feeTooHigh ? 0 : totals.freelancerCents)}
          </span>
        </div>
        {feeTooHigh ? <p className="text-xs text-destructive">{t("summary.feeTooHigh")}</p> : null}
      </CardContent>
    </Card>
  )
}
