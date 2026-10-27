import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { CheckIcon, CopyIcon, LinkIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { useI18n } from "@/i18n"

export function inviteUrl(token: string) {
  return `${window.location.origin}/p/${token}`
}

export function ShareDialog({
  token,
  sent,
  open,
  onOpenChange,
}: {
  token: string
  sent: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const url = typeof window === "undefined" ? "" : inviteUrl(token)

  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success(t("shareDialog.copyToast"))
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("shareDialog.title")}</DialogTitle>
          <DialogDescription>{t("shareDialog.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label htmlFor="invite-url" className="text-sm font-medium">
            {t("shareDialog.linkLabel")}
          </label>
          <InputGroup>
            <InputGroupAddon>
              <LinkIcon />
            </InputGroupAddon>
            <InputGroupInput
              id="invite-url"
              readOnly
              value={url}
              onFocus={(e) => e.target.select()}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton onClick={copy} aria-label={t("common.copy")}>
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? t("common.copied") : t("common.copy")}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {!sent ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {t("shareDialog.notSentYet")}
            </p>
          ) : null}
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
