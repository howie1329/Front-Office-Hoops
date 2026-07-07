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
    <section className="shrink-0 rounded-lg border bg-muted/20 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <Metric label="Overall" value={String(overall)} />
        <Metric label="Offense" value={String(offense)} />
        <Metric label="Defense" value={String(defense)} />
        <Metric label="Payroll" value={payroll} />
        <Metric
          label="Cap space"
          value={capSpace}
          tone={capSpaceTone === "destructive" ? "destructive" : undefined}
        />
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Roster</span>
          {rosterOverLimit ? (
            <Badge variant="destructive">
              {rosterCount} · cut {cutsNeeded}
            </Badge>
          ) : (
            <span className="font-medium tabular-nums">{rosterCount} players</span>
          )}
        </div>
      </div>
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
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-medium tabular-nums",
          tone === "destructive" && "text-destructive",
        )}
      >
        {value}
      </span>
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
