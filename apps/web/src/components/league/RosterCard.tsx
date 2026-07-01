import type { TeamWithRoster } from "@workspace/shared/types"
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

export function RosterCard({ roster }: { roster: TeamWithRoster }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{roster.name}</CardTitle>
        <CardDescription>
          {roster.abbrev} · {roster.overall} OVR · {roster.pace} pace
          {roster.divisionId ? ` · ${roster.divisionId}` : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead>Pos</TableHead>
              <TableHead>OVR</TableHead>
              <TableHead>USG</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roster.players.map((player) => (
              <TableRow key={player.id}>
                <TableCell>
                  {player.firstName} {player.lastName}
                </TableCell>
                <TableCell>{player.position}</TableCell>
                <TableCell>{player.ratings.overall}</TableCell>
                <TableCell>{player.ratings.usage}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
