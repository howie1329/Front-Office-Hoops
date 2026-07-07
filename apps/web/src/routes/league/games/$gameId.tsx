import { createFileRoute, Link } from "@tanstack/react-router"

import { GameDetailCard } from "@/components/box-score/GameDetailCard"
import { getTeamById } from "@/components/league/lib/teamFormat"
import { useLeagueContext } from "@/contexts/LeagueContext"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

export const Route = createFileRoute("/league/games/$gameId")({
  component: LeagueGameDetailPage,
})

function LeagueGameDetailPage() {
  const { gameId } = Route.useParams()
  const { seasonState } = useLeagueContext()

  if (!seasonState) {
    return null
  }

  const game = seasonState.games.find((entry) => entry.id === gameId)
  const homeTeam = game ? getTeamById(seasonState, game.homeTeamId) : undefined
  const awayTeam = game ? getTeamById(seasonState, game.awayTeamId) : undefined

  if (!game || !homeTeam || !awayTeam) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Game not found</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            This game is not in your saved league yet.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link to="/league/calendar">Back to calendar</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-px">
      <div className="flex shrink-0 justify-end">
        <Button variant="outline" size="sm" asChild>
          <Link to="/league/schedule">Back to schedule</Link>
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-px">
        <GameDetailCard game={game} homeTeam={homeTeam} awayTeam={awayTeam} />
      </div>
    </div>
  )
}
