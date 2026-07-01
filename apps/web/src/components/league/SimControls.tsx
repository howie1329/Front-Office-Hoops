import type { SeasonPhase, SeasonState } from "@workspace/shared/types"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import type { LeagueStatus, SaveStatus } from "@/hooks/useLeague"

type SimControlsProps = {
  state: SeasonState | null
  phase?: SeasonPhase
  status: LeagueStatus
  saveStatus: SaveStatus
  error: string | null
  seed: string
  onSeedChange: (seed: string) => void
  onNewSeason?: () => void
  onSimDay: () => void
  onSimWeek: () => void
  onSimSeason: () => void
  onSimPlayoffDay?: () => void
  onSimPlayoffs?: () => void
  showNewSeason?: boolean
  title?: string
  description?: string
}

export function SimControls({
  state,
  phase = "regular",
  status,
  saveStatus,
  error,
  seed,
  onSeedChange,
  onNewSeason,
  onSimDay,
  onSimWeek,
  onSimSeason,
  onSimPlayoffDay,
  onSimPlayoffs,
  showNewSeason = false,
  title = "Season controls",
  description = "Simulate by day, week, or full season.",
}: SimControlsProps) {
  const remainingGames =
    state?.schedule.filter((game) => game.status === "scheduled").length ?? 0

  if (phase === "complete") {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {phase === "playoffs"
            ? "Simulate playoff days or run the full postseason."
            : description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {showNewSeason ? (
          <div className="grid gap-2">
            <Label htmlFor="season-seed">Seed</Label>
            <Input
              id="season-seed"
              value={seed}
              onChange={(event) => onSeedChange(event.target.value)}
              placeholder="season-demo"
            />
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {showNewSeason && onNewSeason ? (
            <Button onClick={onNewSeason} disabled={status === "loading"}>
              New season
            </Button>
          ) : null}

          {phase === "regular" ? (
            <>
              <Button variant="secondary" onClick={onSimDay} disabled={!state}>
                Sim day
              </Button>
              <Button variant="secondary" onClick={onSimWeek} disabled={!state}>
                Sim week
              </Button>
              <Button variant="secondary" onClick={onSimSeason} disabled={!state}>
                Sim season
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={onSimPlayoffDay ?? onSimDay}
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
            </>
          )}
        </div>

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
          <p className="text-xs text-muted-foreground">
            Current day: {state.currentDay} · Games played: {state.games.length} ·
            Remaining: {remainingGames}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
