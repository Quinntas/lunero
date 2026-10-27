import { cn } from "@workspace/ui/lib/utils"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

type Variant = "action" | "waiting" | "success" | "closed"

const variants: Record<Variant, { box: string; icon: string }> = {
  action: {
    box: "border-primary/30 bg-primary/5",
    icon: "bg-primary text-primary-foreground",
  },
  waiting: { box: "border-border bg-muted/40", icon: "bg-muted text-muted-foreground" },
  success: {
    box: "border-emerald-500/30 bg-emerald-500/5",
    icon: "bg-emerald-500 text-white",
  },
  closed: { box: "border-border bg-muted/30", icon: "bg-muted text-muted-foreground" },
}

/** The one thing the user should do (or wait for) next on this page. */
export function NextStep({
  variant,
  icon: Icon,
  title,
  description,
  children,
}: {
  variant: Variant
  icon: LucideIcon
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
}) {
  const styles = variants[variant]
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center",
        styles.box,
      )}
    >
      <div className="flex flex-1 items-start gap-4">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            styles.icon,
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-semibold">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {children ? <div className="flex flex-wrap gap-2 sm:justify-end">{children}</div> : null}
    </section>
  )
}
