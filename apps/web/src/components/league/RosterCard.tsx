import type { TeamWithRoster } from "@workspace/shared/types"
import { Button } from "@workspace/ui/components/button"
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

type RosterCardProps = {
  roster: TeamWithRoster
  showRelease?: boolean
  onReleasePlayer?: (playerId: string) => void
}

export function RosterCard({
  roster,
  showRelease = false,
  onReleasePlayer,
}: RosterCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{roster.name}</CardTitle>
        <CardDescription>
          {roster.abbrev} · {roster.overall} OVR · {roster.pace} pace ·{" "}
          {roster.players.length} players
          {roster.divisionId ? ` · ${roster.divisionId}` : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead>Pos</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>OVR</TableHead>
              <TableHead>POT</TableHead>
              {showRelease ? <TableHead /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {roster.players.map((player) => (
              <TableRow key={player.id}>
                <TableCell>
                  {player.firstName} {player.lastName}
                </TableCell>
                <TableCell>{player.position}</TableCell>
                <TableCell>{player.age}</TableCell>
                <TableCell>{player.ratings.overall}</TableCell>
                <TableCell>{player.ratings.potential}</TableCell>
                {showRelease ? (
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onReleasePlayer?.(player.id)}
                    >
                      Release
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
