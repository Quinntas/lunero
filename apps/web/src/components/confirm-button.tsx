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
import { Spinner } from "@workspace/ui/components/spinner"
import type { ReactNode } from "react"
import { useI18n } from "@/i18n"

export function ConfirmButton({
  title,
  description,
  confirm,
  onConfirm,
  pending,
  variant = "default",
  children,
}: {
  title: string
  description: string
  confirm: string
  onConfirm: () => unknown
  pending?: boolean
  variant?: "default" | "ghost" | "outline" | "destructive"
  children: ReactNode
}) {
  const { t } = useI18n()
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={variant} disabled={pending}>
          {pending ? <Spinner /> : null}
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.back")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => void onConfirm()}>{confirm}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
