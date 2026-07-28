import { formatMoney } from "@/components/league/lib/moneyFormat"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

type TeamMetricsStripProps = {
  overall: number
  offense: number
  defense: number
  payroll: string
  capSpace: string
  capSpaceTone?: "default" | "destructive"
  rosterCount: number
  rosterOverLimit?: boolean
  cutsNeeded?: number
}

export function TeamMetricsStrip({
  overall,
  offense,
  defense,
  payroll,
  capSpace,
  capSpaceTone = "default",
  rosterCount,
  rosterOverLimit = false,
  cutsNeeded = 0,
}: TeamMetricsStripProps) {
  return (
    <section
      className="shrink-0 overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10"
      aria-label="Team summary"
    >
      <dl className="grid grid-cols-3 text-xs sm:grid-cols-6">
        <Metric label="Overall" value={String(overall)} />
        <Metric label="Offense" value={String(offense)} />
        <Metric label="Defense" value={String(defense)} />
        <Metric label="Payroll" value={payroll} />
        <Metric
          label="Cap space"
          value={capSpace}
          tone={capSpaceTone === "destructive" ? "destructive" : undefined}
        />
        <div
          className={cn(
            "flex min-h-12 flex-col justify-center border-t px-3 py-1.5 sm:border-t-0 sm:border-l",
            rosterOverLimit && "bg-warning/10",
          )}
        >
          <dt className="text-muted-foreground">Roster</dt>
          {rosterOverLimit ? (
            <dd className="flex items-center gap-1.5 font-medium tabular-nums">
              <span>{rosterCount}</span>
              <Badge className="h-4 rounded-sm bg-warning/20 px-1.5 text-[0.625rem] text-foreground">
                cut {cutsNeeded}
              </Badge>
            </dd>
          ) : (
            <dd className="font-medium tabular-nums">{rosterCount} players</dd>
          )}
        </div>
      </dl>
    </section>
  )
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "destructive"
}) {
  return (
    <div className="flex min-h-12 flex-col justify-center border-t border-l px-3 py-1.5 first:border-l-0 sm:border-t-0 sm:first:border-l-0 [&:nth-child(-n+3)]:border-t-0 [&:nth-child(4)]:border-l-0 sm:[&:nth-child(4)]:border-l">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-medium tabular-nums",
          tone === "destructive" && "text-destructive",
        )}
      >
        {value}
      </dd>
    </div>
  )
}

export function formatCapSpaceMetric(value: number | null): {
  label: string
  tone: "default" | "destructive"
} {
  if (value === null) {
    return { label: "-", tone: "default" }
  }

  return {
    label: formatMoney(value),
    tone: value < 0 ? "destructive" : "default",
  }
}
