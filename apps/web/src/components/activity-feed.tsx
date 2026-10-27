import type { Doc } from "@workspace/backend/dataModel"
import { useI18n } from "@/i18n"

type Entry = Pick<Doc<"activity">, "_id" | "_creationTime" | "kind" | "data"> & {
  actorName?: string
}

export function ActivityFeed({ entries }: { entries: Entry[] }) {
  const { t, tDynamic, money, relative, dateTime } = useI18n()
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("activity.empty")}</p>
  }
  return (
    <ol className="relative flex flex-col gap-5 border-l pl-5">
      {entries.map((entry) => {
        const data = { ...entry.data }
        if (typeof data.totalCents === "number") data.total = money(data.totalCents)
        if (typeof data.amountCents === "number") data.amount = money(data.amountCents)
        if (entry.kind === "payment.failed") delete data.reason
        const key =
          entry.kind === "draft.rejected" && data.reason ? "draft.rejectedReason" : entry.kind
        return (
          <li key={entry._id} className="relative text-sm">
            <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-primary" />
            <p className="leading-snug">
              <span className="font-medium">{entry.actorName ?? t("activity.system")}</span>{" "}
              <span className="text-muted-foreground">
                {tDynamic(`activity.${key}`, data, entry.kind)}
              </span>
            </p>
            <time
              className="text-xs text-muted-foreground"
              dateTime={new Date(entry._creationTime).toISOString()}
              title={dateTime(entry._creationTime)}
            >
              {relative(entry._creationTime)}
            </time>
          </li>
        )
      })}
    </ol>
  )
}
