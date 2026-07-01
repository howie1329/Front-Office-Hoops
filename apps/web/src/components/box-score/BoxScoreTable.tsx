import type { PlayerGameStats, TeamWithRoster } from "@workspace/shared/types"
import {
  Card,
  CardContent,
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

import { playerName } from "./playerName"

export function BoxScoreTable({
  roster,
  stats,
}: {
  roster: TeamWithRoster
  stats: PlayerGameStats[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{roster.name} Box Score</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
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
            {stats.map((line) => (
              <TableRow key={line.playerId}>
                <TableCell>{playerName(roster.players, line.playerId)}</TableCell>
                <TableCell>{line.minutes}</TableCell>
                <TableCell>{line.pts}</TableCell>
                <TableCell>{line.reb}</TableCell>
                <TableCell>{line.ast}</TableCell>
                <TableCell>{line.stl}</TableCell>
                <TableCell>{line.blk}</TableCell>
                <TableCell>{line.tov}</TableCell>
                <TableCell>
                  {line.fgm}-{line.fga}
                </TableCell>
                <TableCell>
                  {line.tpm}-{line.tpa}
                </TableCell>
                <TableCell>
                  {line.ftm}-{line.fta}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
