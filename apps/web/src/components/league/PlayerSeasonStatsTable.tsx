import { useMemo, useState } from "react"

import { sortPlayerSeasonStats } from "@workspace/sim"
import type { SeasonState } from "@workspace/shared/types"
import { playerName } from "@/components/box-score/playerName"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { teamAbbrev } from "./lib/teamFormat"

type PlayerSeasonStatsTableProps = {
  state: SeasonState
  defaultTeamFilter?: string
}

export function PlayerSeasonStatsTable({
  state,
  defaultTeamFilter = "all",
}: PlayerSeasonStatsTableProps) {
  const [teamFilter, setTeamFilter] = useState(defaultTeamFilter)

  const rows = useMemo(() => {
    const sorted = sortPlayerSeasonStats(state.playerSeasonStats)
    if (teamFilter === "all") {
      return sorted
    }

    return sorted.filter((row) => row.teamId === teamFilter)
  }, [state.playerSeasonStats, teamFilter])

  const allPlayers = state.teams.flatMap((team) => team.players)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Player season stats</CardTitle>
        <CardDescription>
          Aggregated from completed games. Sorted by points.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-2 max-w-xs">
          <Label htmlFor="stats-team-filter">Team filter</Label>
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger id="stats-team-filter" className="w-full">
              <SelectValue placeholder="All teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {state.teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>GP</TableHead>
              <TableHead>GS</TableHead>
              <TableHead>MIN</TableHead>
              <TableHead>PTS</TableHead>
              <TableHead>REB</TableHead>
              <TableHead>AST</TableHead>
              <TableHead>STL</TableHead>
              <TableHead>BLK</TableHead>
              <TableHead>TOV</TableHead>
              <TableHead>FG</TableHead>
              <TableHead>3PT</TableHead>
              <TableHead>FT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{playerName(allPlayers, row.playerId)}</TableCell>
                  <TableCell>{teamAbbrev(state, row.teamId)}</TableCell>
                  <TableCell>{row.gp}</TableCell>
                  <TableCell>{row.gs}</TableCell>
                  <TableCell>{row.min}</TableCell>
                  <TableCell>{row.pts}</TableCell>
                  <TableCell>{row.reb}</TableCell>
                  <TableCell>{row.ast}</TableCell>
                  <TableCell>{row.stl}</TableCell>
                  <TableCell>{row.blk}</TableCell>
                  <TableCell>{row.tov}</TableCell>
                  <TableCell>
                    {row.fgm}-{row.fga}
                  </TableCell>
                  <TableCell>
                    {row.tpm}-{row.tpa}
                  </TableCell>
                  <TableCell>
                    {row.ftm}-{row.fta}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={14} className="text-muted-foreground">
                  No player stats yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
