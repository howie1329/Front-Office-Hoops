import type { SeasonPhase, SeasonState } from "@workspace/shared/types"
import type {
  AdvancePolicy,
  AdvanceResult,
  AdvanceStopReason,
  AdvanceTarget,
} from "@workspace/sim"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"

import type { LeagueStatus, SaveStatus } from "@/hooks/useLeague"

type AdvanceControlsProps = {
  state: SeasonState | null
  phase?: SeasonPhase
  status: LeagueStatus
  saveStatus: SaveStatus
  error: string | null
  lastAdvanceResult: AdvanceResult | null
  onAdvance: (target: AdvanceTarget, policy?: AdvancePolicy) => void
  onSimPlayoffs?: () => void
  title?: string
  description?: string
}

const bulkTargets: { value: AdvanceTarget; label: string }[] = [
  { value: "week", label: "Advance 1 week" },
  { value: "month_end", label: "Until month end" },
  { value: "trade_deadline", label: "Until trade deadline" },
  { value: "playoffs", label: "Until playoffs" },
  { value: "regular_season_end", label: "Rest of regular season" },
]

export function AdvanceControls({
  state,
  phase = "regular",
  status,
  saveStatus,
  error,
  lastAdvanceResult,
  onAdvance,
  onSimPlayoffs,
  title = "Advance league",
  description = "Advance one day at a time, or run bulk simulation through your games.",
}: AdvanceControlsProps) {
  const remainingGames =
    state?.schedule.filter((game) => game.status === "scheduled").length ?? 0

  if (phase === "complete" || phase === "offseason") {
    return null
  }

  const canAdvance =
    phase === "regular" || phase === "preseason" || phase === "playoffs"

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {phase === "playoffs"
            ? "Simulate playoff rounds or run the full postseason."
            : description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {canAdvance ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="sm:flex-1"
              onClick={() => onAdvance("day", "stopAtUserGames")}
              disabled={!state || status === "loading"}
            >
              Advance 1 day
            </Button>

            {phase !== "playoffs" ? (
              <Select
                onValueChange={(value) =>
                  onAdvance(value as AdvanceTarget, "runThrough")
                }
              >
                <SelectTrigger className="sm:w-[220px]">
                  <SelectValue placeholder="Play until…" />
                </SelectTrigger>
                <SelectContent>
                  {bulkTargets.map((target) => (
                    <SelectItem key={target.value} value={target.value}>
                      {target.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        ) : null}

        {phase === "playoffs" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => onAdvance("day", "runThrough")}
              disabled={!state}
            >
              Sim playoff day
            </Button>
            <Button
              variant="secondary"
              onClick={onSimPlayoffs}
              disabled={!state || !onSimPlayoffs}
            >
              Sim all playoffs
            </Button>
          </div>
        ) : null}

        {lastAdvanceResult ? (
          <p className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            {formatAdvanceSummary(lastAdvanceResult)}
          </p>
        ) : null}

        {status === "loading" ? (
          <p className="text-xs text-muted-foreground">Loading saved league…</p>
        ) : null}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        {saveStatus === "saving" ? (
          <p className="text-xs text-muted-foreground">Saving…</p>
        ) : saveStatus === "saved" && state ? (
          <p className="text-xs text-muted-foreground">Saved locally</p>
        ) : null}

        {state ? (
          <div className="grid gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs sm:grid-cols-3">
            <AdvanceMetric label="Day" value={String(state.currentDay)} />
            <AdvanceMetric label="Played" value={String(state.games.length)} />
            <AdvanceMetric label="Remaining" value={String(remainingGames)} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function AdvanceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 sm:block">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums sm:mt-0.5 sm:block">
        {value}
      </span>
    </div>
  )
}

function formatAdvanceSummary(result: AdvanceResult): string {
  const parts = [
    `Simulated ${result.daysSimmed} day${result.daysSimmed === 1 ? "" : "s"}`,
    `${result.gamesSimmed} game${result.gamesSimmed === 1 ? "" : "s"}`,
  ]

  if (result.stoppedReason) {
    parts.push(`stopped: ${stopReasonLabel(result.stoppedReason)}`)
  }

  return parts.join(" · ")
}

function stopReasonLabel(reason: AdvanceStopReason): string {
  switch (reason) {
    case "user_game":
      return "your next game"
    case "target_reached":
      return "target reached"
    case "roster_cuts":
      return "roster cuts required"
    case "begin_playoffs":
      return "playoffs ready"
    case "begin_regular_season":
      return "regular season ready"
    case "draft_pick":
      return "draft pick on the clock"
  }
}
