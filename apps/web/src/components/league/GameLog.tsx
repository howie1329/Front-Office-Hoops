import { Link } from "@tanstack/react-router"
import { useMemo } from "react"

import type { SeasonState } from "@workspace/shared/types"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { formatGameLine } from "./lib/teamFormat"

type GameLogProps = {
  state: SeasonState
  selectedGameId?: string | null
  onGameClick?: (gameId: string) => void
  getGameHref?: (gameId: string) => string
}

export function GameLog({
  state,
  selectedGameId,
  onGameClick,
  getGameHref,
}: GameLogProps) {
  const completedGames = useMemo(
    () =>
      state.games
        .slice()
        .sort((a, b) => b.day - a.day || b.id.localeCompare(a.id)),
    [state.games],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Game log</CardTitle>
        <CardDescription>
          {getGameHref
            ? "Open a completed game to view quarters and box scores."
            : "Click a completed game to view quarters and box scores."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex max-h-96 flex-col gap-1 overflow-y-auto text-sm">
        {completedGames.length > 0 ? (
          completedGames.map((game) => {
            const label = formatGameLine(state, game)

            if (getGameHref) {
              return (
                <Button
                  key={game.id}
                  variant="ghost"
                  className="h-auto justify-start px-2 py-1.5 text-left font-normal"
                  asChild
                >
                  <Link to={getGameHref(game.id)}>{label}</Link>
                </Button>
              )
            }

            return (
              <Button
                key={game.id}
                variant="ghost"
                className="h-auto justify-start px-2 py-1.5 text-left font-normal"
                aria-selected={selectedGameId === game.id}
                onClick={() => onGameClick?.(game.id)}
              >
                {label}
              </Button>
            )
          })
        ) : (
          <p className="text-muted-foreground">No games played yet.</p>
        )}
      </CardContent>
    </Card>
  )
}
