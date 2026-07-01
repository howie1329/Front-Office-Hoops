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
  canStartNextSeason: boolean
  onBeginPlayoffs: () => void
  onStartNextSeason: () => void
}

function phaseLabel(phase: SeasonState["phase"]): string {
  if (phase === "playoffs") {
    return "Playoffs"
  }
  if (phase === "complete") {
    return "Season complete"
  }
  return "Regular season"
}

export function SeasonPhaseCard({
  state,
  championTeamId,
  canBeginPlayoffs,
  canStartNextSeason,
  onBeginPlayoffs,
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

        {canStartNextSeason ? (
          <Button onClick={() => void onStartNextSeason()}>
            Start Season {state.season + 1}
          </Button>
        ) : null}

        {state.phase === "complete" ? (
          <Button variant="outline" asChild>
            <Link to="/league/history">View history</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
