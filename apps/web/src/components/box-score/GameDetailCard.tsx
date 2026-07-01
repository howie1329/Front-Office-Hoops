import type { Game, TeamWithRoster } from "@workspace/shared/types"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { BoxScoreTable } from "./BoxScoreTable"
import { QuarterLineTable } from "./QuarterLineTable"

export function GameDetailCard({
  game,
  homeTeam,
  awayTeam,
}: {
  game: Game
  homeTeam: TeamWithRoster
  awayTeam: TeamWithRoster
}) {
  const { result } = game
  const winner =
    result.winnerId === homeTeam.id
      ? homeTeam
      : result.winnerId === awayTeam.id
        ? awayTeam
        : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Day {game.day}: {awayTeam.abbrev} @ {homeTeam.abbrev}
        </CardTitle>
        <CardDescription>
          Final: {awayTeam.abbrev} {result.awayScore} – {result.homeScore}{" "}
          {homeTeam.abbrev}
          {winner ? ` · Winner: ${winner.name}` : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <QuarterLineTable
          homeAbbrev={homeTeam.abbrev}
          awayAbbrev={awayTeam.abbrev}
          result={result}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <BoxScoreTable roster={homeTeam} stats={result.homePlayerStats} />
          <BoxScoreTable roster={awayTeam} stats={result.awayPlayerStats} />
        </div>
      </CardContent>
    </Card>
  )
}
