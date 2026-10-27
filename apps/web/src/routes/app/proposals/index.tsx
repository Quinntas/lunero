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
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { useQuery } from "convex/react"
import { FileTextIcon, LinkIcon, PlusIcon } from "lucide-react"
import { z } from "zod"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { UserAvatar } from "@/components/user-avatar"
import { useI18n } from "@/i18n"

const filters = ["action", "open", "closed"] as const
type Filter = (typeof filters)[number]

export const Route = createFileRoute("/app/proposals/")({
  validateSearch: z.object({ filter: z.enum(filters).optional() }),
  component: ProposalList,
})

function ProposalList() {
  const { t, money, relative } = useI18n()
  const proposals = useQuery(api.drafts.list)
  const navigate = useNavigate()
  const search = Route.useSearch()

  const isOpen = (status: string) => status === "editing" || status === "sent"
  const counts = {
    action: proposals?.filter((p) => isOpen(p.status) && p.isMyTurn).length ?? 0,
    open: proposals?.filter((p) => isOpen(p.status)).length ?? 0,
    closed: proposals?.filter((p) => !isOpen(p.status)).length ?? 0,
  }
  const filter: Filter = search.filter ?? (counts.action > 0 ? "action" : "open")
  const visible = proposals?.filter((p) => {
    if (filter === "action") return isOpen(p.status) && p.isMyTurn
    if (filter === "open") return isOpen(p.status)
    return !isOpen(p.status)
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("proposals.title")}
        description={t("proposals.subtitle")}
        actions={
          <Button asChild>
            <Link to="/app/proposals/new">
              <PlusIcon />
              {t("nav.newProposal")}
            </Link>
          </Button>
        }
      />
      <Tabs
        value={filter}
        onValueChange={(value) => void navigate({ to: ".", search: { filter: value as Filter } })}
      >
        <TabsList>
          {filters.map((value) => (
            <TabsTrigger key={value} value={value} className="gap-2">
              {t(
                value === "action"
                  ? "proposals.tabAction"
                  : value === "open"
                    ? "proposals.tabOpen"
                    : "proposals.tabClosed",
              )}
              {counts[value] > 0 ? (
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5 tabular-nums">
                  {counts[value]}
                </Badge>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {!visible ? (
        <Skeleton className="h-48" />
      ) : visible.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileTextIcon />
            </EmptyMedia>
            <EmptyTitle>{t("proposals.emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("proposals.emptyText")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link to="/app/proposals/new">
                <PlusIcon />
                {t("nav.newProposal")}
              </Link>
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
                <TableHead className="text-right">{t("proposals.colValue")}</TableHead>
                <TableHead>{t("proposals.colStatus")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("proposals.colUpdated")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((proposal) => (
                <TableRow
                  key={proposal._id}
                  className="cursor-pointer"
                  onClick={() =>
                    void navigate({
                      to: "/app/proposals/$proposalId",
                      params: { proposalId: proposal._id },
                    })
                  }
                >
                  <TableCell>
                    <Link
                      to="/app/proposals/$proposalId"
                      params={{ proposalId: proposal._id }}
                      className="font-medium hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {proposal.title}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      {t(
                        proposal.myRole === "freelancer"
                          ? "roles.youAreFreelancer"
                          : "roles.youAreContractor",
                      )}
                      {" · "}
                      {t("proposals.milestoneCount", { count: proposal.milestoneCount })}
                      {proposal.isMyTurn &&
                      (proposal.status === "sent" || proposal.status === "editing") ? (
                        <Badge className="h-5">{t("proposals.yourTurn")}</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {proposal.counterpart ? (
                      <span className="flex items-center gap-2">
                        <UserAvatar user={proposal.counterpart} className="size-6" />
                        <span className="truncate">{proposal.counterpart.name}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <LinkIcon className="size-4" />
                        {t("proposals.anyoneWithLink")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {money(proposal.totalCents)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="proposal" status={proposal.status} />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {relative(proposal.updatedAt)}
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
