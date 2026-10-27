import { cn } from "@workspace/ui/lib/utils"
import { CheckIcon } from "lucide-react"

/** Horizontal progress stepper (wizard steps, contract lifecycle). */
export function Stepper({
  steps,
  current,
  onStepClick,
  className,
}: {
  steps: string[]
  /** Index of the current step; everything before it is complete. */
  current: number
  onStepClick?: (index: number) => void
  className?: string
}) {
  return (
    <ol className={cn("flex w-full items-center gap-2", className)}>
      {steps.map((label, index) => {
        const done = index < current
        const active = index === current
        const clickable = onStepClick && index < current
        return (
          <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick(index)}
              className={cn(
                "flex items-center gap-2 text-sm whitespace-nowrap",
                clickable ? "cursor-pointer" : "cursor-default",
              )}
              aria-current={active ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary text-primary ring-4 ring-primary/15",
                  !done && !active && "text-muted-foreground",
                )}
              >
                {done ? <CheckIcon className="size-3.5" /> : index + 1}
              </span>
              <span
                className={cn("hidden md:inline", active ? "font-medium" : "text-muted-foreground")}
              >
                {label}
              </span>
            </button>
            {index < steps.length - 1 ? (
              <span className={cn("h-px flex-1 bg-border", done && "bg-primary")} aria-hidden />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
