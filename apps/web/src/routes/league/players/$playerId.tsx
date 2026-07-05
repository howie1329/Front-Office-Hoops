import { createFileRoute } from "@tanstack/react-router"

import { playerName } from "@/components/box-score/playerName"
import { formatMoney } from "@/components/league/lib/moneyFormat"
import { teamAbbrev, teamName } from "@/components/league/lib/teamFormat"
import { useLeagueContext } from "@/contexts/LeagueContext"
import {
  getCurrentSalary,
  getPlayerContract,
  getYearsRemaining,
} from "@workspace/sim"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

export const Route = createFileRoute("/league/players/$playerId")({
  component: PlayerProfilePage,
})

function PlayerProfilePage() {
  const { playerId } = Route.useParams()
  const { league, seasonState } = useLeagueContext()

  if (!league || !seasonState) {
    return null
  }

  const allPlayers = [
    ...seasonState.teams.flatMap((team) => team.players),
    ...league.freeAgentPool,
  ]
  const player = allPlayers.find((entry) => entry.id === playerId)
  const contract = player
    ? getPlayerContract(league.contracts, player)
    : undefined
  const snapshots = league.playerCareerSnapshots
    .filter((entry) => entry.playerId === playerId)
    .sort((a, b) => a.season - b.season)
  const awards = league.seasonAwards.filter(
    (entry) => entry.playerId === playerId
  )
  const transactions = league.leagueLog.filter(
    (entry) => entry.playerId === playerId
  )

  if (!player && snapshots.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Player not found</CardTitle>
          <CardDescription>
            This player is not in the current league.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {player ? playerName(allPlayers, player.id) : playerId}
          </CardTitle>
          <CardDescription>
            {player
              ? `${player.position} · ${player.age} years old · ${player.ratings.overall} OVR / ${player.ratings.potential} POT`
              : "Archived player"}
          </CardDescription>
        </CardHeader>
        {player ? (
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Team</span>
              <span>
                {player.teamId
                  ? teamName(seasonState, player.teamId)
                  : "Free agent"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Contract</span>
              <span>
                {formatMoney(getCurrentSalary(contract))} ·{" "}
                {getYearsRemaining(contract)} yrs
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Draft</span>
              <span>
                {player.draftInfo
                  ? `${player.draftInfo.year} R${player.draftInfo.round} #${player.draftInfo.overallPick}`
                  : "Undrafted"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Archetype</span>
              <span>{player.archetype.replaceAll("_", " ")}</span>
            </div>
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Career</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Season</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>GP</TableHead>
                <TableHead>PTS</TableHead>
                <TableHead>REB</TableHead>
                <TableHead>AST</TableHead>
                <TableHead>Awards</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    Career snapshots are archived at season end.
                  </TableCell>
                </TableRow>
              ) : null}
              {snapshots.map((snapshot) => (
                <TableRow key={snapshot.id}>
                  <TableCell>{snapshot.season}</TableCell>
                  <TableCell>
                    {teamAbbrev(seasonState, snapshot.teamId)}
                  </TableCell>
                  <TableCell>{snapshot.gp}</TableCell>
                  <TableCell>{snapshot.pts}</TableCell>
                  <TableCell>{snapshot.reb}</TableCell>
                  <TableCell>{snapshot.ast}</TableCell>
                  <TableCell>{snapshot.awards.join(", ") || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Awards and transactions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="text-sm">
            <p className="mb-2 font-medium">Awards</p>
            {awards.length === 0 ? (
              <p className="text-muted-foreground">No awards yet.</p>
            ) : (
              <ul className="space-y-1">
                {awards.map((award) => (
                  <li key={award.id}>
                    Season {award.season}: {award.type.replaceAll("_", " ")}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="text-sm">
            <p className="mb-2 font-medium">Transactions</p>
            {transactions.length === 0 ? (
              <p className="text-muted-foreground">No transactions logged.</p>
            ) : (
              <ul className="space-y-1">
                {transactions.map((entry) => (
                  <li key={entry.id}>
                    {entry.dateLabel}: {entry.type.replaceAll("_", " ")}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
