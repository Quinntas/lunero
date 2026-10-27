import { Link, useRouter } from "@tanstack/react-router"
import type { ErrorComponentProps } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { TriangleAlertIcon } from "lucide-react"
import { useI18n } from "@/i18n"

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter()
  const { t, errorMessage } = useI18n()
  return (
    <Empty className="min-h-[60svh]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>{t("common.errorTitle")}</EmptyTitle>
        <EmptyDescription>{errorMessage(error)}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        <Button variant="outline" onClick={() => router.invalidate()}>
          {t("common.tryAgain")}
        </Button>
        <Button asChild>
          <Link to="/">{t("common.goHome")}</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
