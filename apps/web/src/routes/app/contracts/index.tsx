import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Progress } from "@workspace/ui/components/progress"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { useQuery } from "convex/react"
import { HandshakeIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { UserAvatar } from "@/components/user-avatar"
import { useI18n } from "@/i18n"

export const Route = createFileRoute("/app/contracts/")({ component: ContractList })

function ContractList() {
  const { t, money } = useI18n()
  const contracts = useQuery(api.contracts.list)
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("contracts.title")} description={t("contracts.subtitle")} />
      {!contracts ? (
        <Skeleton className="h-48" />
      ) : contracts.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HandshakeIcon />
            </EmptyMedia>
            <EmptyTitle>{t("contracts.emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("contracts.emptyText")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild variant="outline">
              <Link to="/app/proposals">{t("contracts.seeProposals")}</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>{t("proposals.colTitle")}</TableHead>
                <TableHead>{t("proposals.colWith")}</TableHead>
                <TableHead className="w-48">{t("contracts.colProgress")}</TableHead>
                <TableHead className="text-right">{t("proposals.colValue")}</TableHead>
                <TableHead>{t("proposals.colStatus")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((contract) => (
                <TableRow
                  key={contract._id}
                  className="cursor-pointer"
                  onClick={() =>
                    void navigate({
                      to: "/app/contracts/$contractId",
                      params: { contractId: contract._id },
                    })
                  }
                >
                  <TableCell>
                    <Link
                      to="/app/contracts/$contractId"
                      params={{ contractId: contract._id }}
                      className="font-medium hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {contract.title}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      {t(
                        contract.myRole === "freelancer"
                          ? "roles.youAreFreelancer"
                          : "roles.youAreContractor",
                      )}
                      {contract.myRole === "contractor" && contract.awaitingReview > 0 ? (
                        <Badge className="h-5">
                          {t("contracts.toReview", { count: contract.awaitingReview })}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <UserAvatar user={contract.counterpart} className="size-6" />
                      <span className="truncate">{contract.counterpart?.name}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={
                          (contract.approvedCount / Math.max(contract.milestoneCount, 1)) * 100
                        }
                      />
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {contract.approvedCount}/{contract.milestoneCount}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {money(contract.totalCents)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="contract" status={contract.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
