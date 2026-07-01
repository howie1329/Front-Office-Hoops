import type { SeasonState } from "@workspace/shared/types"
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

import { formatStreak, teamName, winPct } from "./lib/teamFormat"

export function StandingsTable({ state }: { state: SeasonState }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Standings</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>W</TableHead>
              <TableHead>L</TableHead>
              <TableHead>PCT</TableHead>
              <TableHead>PF</TableHead>
              <TableHead>PA</TableHead>
              <TableHead>STRK</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.standings.map((row) => (
              <TableRow key={row.teamId}>
                <TableCell>{teamName(state, row.teamId)}</TableCell>
                <TableCell>{row.wins}</TableCell>
                <TableCell>{row.losses}</TableCell>
                <TableCell>{winPct(row.wins, row.losses)}</TableCell>
                <TableCell>{row.pointsFor}</TableCell>
                <TableCell>{row.pointsAgainst}</TableCell>
                <TableCell>{formatStreak(row.streak)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
