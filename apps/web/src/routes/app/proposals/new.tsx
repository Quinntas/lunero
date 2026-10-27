import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import { useMutation, useQuery } from "convex/react"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BriefcaseIcon,
  LinkIcon,
  MailIcon,
  SendIcon,
  UserIcon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useDeferredValue, useState } from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import {
  MilestonesEditor,
  PriceSummary,
  ProjectFields,
  emptyMilestone,
  toPayload,
  usePlatformFee,
} from "@/components/proposal-editor"
import type { ProposalForm } from "@/components/proposal-editor"
import { Stepper } from "@/components/stepper"
import { UserAvatar } from "@/components/user-avatar"
import { useI18n } from "@/i18n"
import { useAction } from "@/lib/use-action"

export const Route = createFileRoute("/app/proposals/new")({ component: NewProposal })

type Role = "freelancer" | "contractor"

function NewProposal() {
  const { t, money, errorMessage } = useI18n()
  const me = useQuery(api.users.me)
  const feeCents = usePlatformFee()
  const create = useMutation(api.drafts.create)
  const send = useMutation(api.drafts.send)
  const [enableFreelancer, enabling] = useAction(useMutation(api.users.setFreelancer))
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [role, setRole] = useState<Role>()
  const [recipient, setRecipient] = useState<"link" | "email">("link")
  const [email, setEmail] = useState("")
  const [pending, setPending] = useState<"draft" | "send">()
  const [form, setForm] = useState<ProposalForm>({
    title: "",
    description: "",
    message: "",
    milestones: [emptyMilestone()],
  })

  const deferredEmail = useDeferredValue(email.trim())
  const lookup = useQuery(
    api.users.findByEmail,
    recipient === "email" && deferredEmail.includes("@") ? { email: deferredEmail } : "skip",
  )

  if (!me) return <Spinner />

  const steps = [t("wizard.step1"), t("wizard.step2"), t("wizard.step3"), t("wizard.step4")]
  const total = form.milestones.reduce((sum, m) => sum + m.priceCents, 0)

  function validate(index: number): string | null {
    if (index === 0 && !role) return t("wizard.errorRole")
    if (index === 0 && role === "freelancer" && !me?.isFreelancer)
      return t("errors.draft.freelancerModeRequired")
    if (index === 1 && form.title.trim().length < 3) return t("wizard.errorTitle")
    if (index === 2) {
      if (form.milestones.some((m) => !m.name.trim() || m.priceCents <= 0)) {
        return t("wizard.errorMilestones")
      }
      if (total <= feeCents) return t("wizard.errorTotal", { fee: money(feeCents) })
    }
    return null
  }

  function next() {
    const problem = validate(step)
    if (problem) return void toast.error(problem)
    setStep(step + 1)
  }

  const emailProblem =
    recipient === "email" && deferredEmail.includes("@")
      ? lookup === null
        ? t("wizard.emailNotFound")
        : role === "contractor" && lookup && !lookup.isFreelancer
          ? t("wizard.emailNotFreelancer")
          : null
      : null

  async function submit(andSend: boolean) {
    setPending(andSend ? "send" : "draft")
    try {
      const proposalId = await create({
        role: role!,
        counterpartEmail: recipient === "email" && email.trim() ? email.trim() : undefined,
        title: form.title,
        description: form.description,
        message: form.message || undefined,
        milestones: toPayload(form.milestones),
      })
      if (andSend) {
        await send({ draftId: proposalId })
        toast.success(t("proposal.sent"))
      }
      await navigate({
        to: "/app/proposals/$proposalId",
        params: { proposalId },
        search: andSend && recipient === "link" ? { share: true } : {},
      })
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(undefined)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("wizard.title")} description={t("wizard.subtitle")} />
      <Stepper steps={steps} current={step} onStepClick={setStep} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          {step === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("wizard.roleQuestion")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <RoleOption
                  icon={BriefcaseIcon}
                  title={t("wizard.roleFreelancerTitle")}
                  text={t("wizard.roleFreelancerText")}
                  selected={role === "freelancer"}
                  onSelect={() => setRole("freelancer")}
                >
                  {!me.isFreelancer ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {t("wizard.freelancerModeNeeded")}
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={enabling}
                        onClick={(e) => {
                          e.stopPropagation()
                          setRole("freelancer")
                          void enableFreelancer({ enabled: true })
                        }}
                      >
                        {t("wizard.freelancerModeEnable")}
                      </Button>
                    </div>
                  ) : null}
                </RoleOption>
                <RoleOption
                  icon={UserIcon}
                  title={t("wizard.roleContractorTitle")}
                  text={t("wizard.roleContractorText")}
                  selected={role === "contractor"}
                  onSelect={() => setRole("contractor")}
                />
              </CardContent>
            </Card>
          ) : null}

          {step === 1 ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("wizard.step2")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ProjectFields value={form} onChange={(patch) => setForm({ ...form, ...patch })} />
              </CardContent>
            </Card>
          ) : null}

          {step === 2 ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("wizard.step3")}</CardTitle>
                <CardDescription>{t("wizard.milestonesHint")}</CardDescription>
              </CardHeader>
              <CardContent>
                <MilestonesEditor
                  milestones={form.milestones}
                  onChange={(milestones) => setForm({ ...form, milestones })}
                />
              </CardContent>
            </Card>
          ) : null}

          {step === 3 ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{form.title}</CardTitle>
                  <CardDescription>
                    {t(role === "freelancer" ? "roles.youAreFreelancer" : "roles.youAreContractor")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {form.description ? (
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                      {form.description}
                    </p>
                  ) : null}
                  <ol className="flex flex-col gap-2">
                    {form.milestones.map((m, index) => (
                      <li
                        key={m.uid}
                        className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                      >
                        <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                          {index + 1}
                        </span>
                        <span className="flex-1 font-medium">{m.name}</span>
                        {m.etaDays ? (
                          <span className="text-xs text-muted-foreground">
                            {t("common.days", { count: m.etaDays })}
                          </span>
                        ) : null}
                        <span className="tabular-nums">{money(m.priceCents)}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{t("wizard.recipientTitle")}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <RadioGroup
                    value={recipient}
                    onValueChange={(value) => setRecipient(value as typeof recipient)}
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    {(
                      [
                        [
                          "link",
                          LinkIcon,
                          t("wizard.recipientLink"),
                          t("wizard.recipientLinkText"),
                        ],
                        [
                          "email",
                          MailIcon,
                          t("wizard.recipientEmail"),
                          t("wizard.recipientEmailText"),
                        ],
                      ] as const
                    ).map(([value, Icon, title, text]) => (
                      <FieldLabel key={value} htmlFor={`recipient-${value}`}>
                        <Field orientation="horizontal">
                          <FieldContent>
                            <FieldTitle>
                              <Icon className="size-4" />
                              {title}
                            </FieldTitle>
                            <FieldDescription>{text}</FieldDescription>
                          </FieldContent>
                          <RadioGroupItem value={value} id={`recipient-${value}`} />
                        </Field>
                      </FieldLabel>
                    ))}
                  </RadioGroup>
                  {recipient === "email" ? (
                    <Field data-invalid={emailProblem ? true : undefined}>
                      <FieldLabel htmlFor="email">{t("wizard.emailLabel")}</FieldLabel>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        placeholder="nome@exemplo.com"
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      {lookup ? (
                        <div className="flex items-center gap-2 text-sm">
                          <UserAvatar user={lookup} className="size-6" />
                          <span className="font-medium">{lookup.name}</span>
                        </div>
                      ) : null}
                      {emailProblem ? (
                        <FieldDescription className="text-destructive">
                          {emailProblem}
                        </FieldDescription>
                      ) : null}
                    </Field>
                  ) : null}
                  <Field>
                    <FieldLabel htmlFor="message">{t("wizard.messageLabel")}</FieldLabel>
                    <Textarea
                      id="message"
                      rows={2}
                      value={form.message}
                      placeholder={t("wizard.messagePlaceholder")}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                    />
                  </Field>
                </CardContent>
              </Card>
            </>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
              <ArrowLeftIcon />
              {t("common.back")}
            </Button>
            {step < 3 ? (
              <Button onClick={next}>
                {t("common.next")}
                <ArrowRightIcon />
              </Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={pending !== undefined}
                  onClick={() => submit(false)}
                >
                  {pending === "draft" ? <Spinner /> : null}
                  {t("wizard.saveDraft")}
                </Button>
                <Button
                  disabled={
                    pending !== undefined ||
                    Boolean(emailProblem) ||
                    (recipient === "email" && !lookup)
                  }
                  onClick={() => submit(true)}
                >
                  {pending === "send" ? (
                    <Spinner />
                  ) : recipient === "link" ? (
                    <LinkIcon />
                  ) : (
                    <SendIcon />
                  )}
                  {recipient === "link" ? t("wizard.createAndShare") : t("wizard.createAndSend")}
                </Button>
              </div>
            )}
          </div>
        </div>

        <PriceSummary
          milestones={form.milestones}
          feeCents={feeCents}
          myRole={role ?? "freelancer"}
          className="lg:sticky lg:top-20"
        />
      </div>
    </div>
  )
}

function RoleOption({
  icon: Icon,
  title,
  text,
  selected,
  onSelect,
  children,
}: {
  icon: LucideIcon
  title: string
  text: string
  selected: boolean
  onSelect: () => void
  children?: React.ReactNode
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col gap-2 rounded-xl border p-5 transition-colors hover:bg-muted/50 has-focus-visible:ring-2 has-focus-visible:ring-ring",
        selected && "border-primary bg-primary/5 ring-2 ring-primary/20",
      )}
    >
      <input type="radio" name="role" className="sr-only" checked={selected} onChange={onSelect} />
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-lg bg-muted",
          selected && "bg-primary text-primary-foreground",
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="font-semibold">{title}</span>
      <span className="text-sm text-muted-foreground">{text}</span>
      {children}
    </label>
  )
}
