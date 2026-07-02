import { Link } from "@tanstack/react-router"

import type { SeasonState } from "@workspace/shared/types"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { teamName } from "./lib/teamFormat"

type SeasonPhaseCardProps = {
  state: SeasonState
  championTeamId: string | null
  canBeginPlayoffs: boolean
  canBeginOffseason: boolean
  canStartNextSeason: boolean
  onBeginPlayoffs: () => void
  onBeginOffseason: () => void
  onStartNextSeason: () => void
}

function phaseLabel(phase: SeasonState["phase"]): string {
  if (phase === "playoffs") {
    return "Playoffs"
  }
  if (phase === "complete") {
    return "Season complete"
  }
  if (phase === "offseason") {
    return "Offseason"
  }
  return "Regular season"
}

export function SeasonPhaseCard({
  state,
  championTeamId,
  canBeginPlayoffs,
  canBeginOffseason,
  canStartNextSeason,
  onBeginPlayoffs,
  onBeginOffseason,
  onStartNextSeason,
}: SeasonPhaseCardProps) {
  const championName = championTeamId
    ? teamName(state, championTeamId)
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Season {state.season} · {phaseLabel(state.phase)}
        </CardTitle>
        <CardDescription>
          {state.phase === "regular"
            ? "Finish the regular season, then begin the playoffs."
            : state.phase === "playoffs"
              ? "Sim playoff games from the bracket page."
              : state.phase === "offseason"
                ? "Player development applied. Start the next season when ready."
                : championName
                  ? `${championName} won the championship.`
                  : "Champion crowned."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {canBeginPlayoffs ? (
          <Button onClick={onBeginPlayoffs}>Begin playoffs</Button>
        ) : null}

        {state.phase === "playoffs" ? (
          <Button variant="secondary" asChild>
            <Link to="/league/playoffs">View playoff bracket</Link>
          </Button>
        ) : null}

        {canBeginOffseason ? (
          <Button onClick={onBeginOffseason}>Begin offseason</Button>
        ) : null}

        {canStartNextSeason ? (
          <Button onClick={() => void onStartNextSeason()}>
            Start Season {state.season + 1}
          </Button>
        ) : null}

        {state.phase === "complete" || state.phase === "offseason" ? (
          <Button variant="outline" asChild>
            <Link to="/league/history">View history</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
