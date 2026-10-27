import { Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { useI18n } from "@/i18n"

export function NotFound() {
  const { t } = useI18n()
  return (
    <Empty className="min-h-[60svh]">
      <EmptyHeader>
        <p className="text-5xl font-semibold tracking-tight">404</p>
        <EmptyTitle>{t("common.notFoundTitle")}</EmptyTitle>
        <EmptyDescription>{t("common.notFoundText")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link to="/">{t("common.goHome")}</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
