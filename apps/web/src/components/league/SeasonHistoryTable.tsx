import type { SeasonHistoryEntry, SeasonState } from "@workspace/shared/types"
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

function formatPlayoffResult(result: SeasonHistoryEntry["userPlayoffResult"]): string {
  if (!result) {
    return "—"
  }

  return result.replaceAll("_", " ")
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

export function SeasonHistoryTable({
  history,
  teams,
}: {
  history: SeasonHistoryEntry[]
  teams: SeasonState["teams"]
}) {
  const teamLookup = new Map(teams.map((team) => [team.id, team.name]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>League history</CardTitle>
        <CardDescription>
          Summary of completed seasons: champion, your record, and playoff
          result.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {history.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Season</TableHead>
                <TableHead>Champion</TableHead>
                <TableHead>Runner-up</TableHead>
                <TableHead>Your record</TableHead>
                <TableHead>Your playoffs</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...history]
                .sort((a, b) => b.season - a.season)
                .map((entry) => (
                  <TableRow key={entry.season}>
                    <TableCell>{entry.season}</TableCell>
                    <TableCell>
                      {teamLookup.get(entry.championTeamId) ?? entry.championTeamId}
                    </TableCell>
                    <TableCell>
                      {entry.runnerUpTeamId
                        ? teamLookup.get(entry.runnerUpTeamId) ?? entry.runnerUpTeamId
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {entry.userTeamId
                        ? `${entry.userWins}-${entry.userLosses}`
                        : "—"}
                    </TableCell>
                    <TableCell>{formatPlayoffResult(entry.userPlayoffResult)}</TableCell>
                    <TableCell>{formatDate(entry.completedAt)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">
            No completed seasons yet. Finish a playoff run to archive your first
            season.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
