import { Link } from "@tanstack/react-router"

import type { PlayerGameStats, TeamWithRoster } from "@workspace/shared/types"
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

import { playerName } from "./playerName"

export function BoxScoreTable({
  roster,
  stats,
  subtitle,
}: {
  roster: TeamWithRoster
  stats: PlayerGameStats[]
  subtitle?: string
}) {
  const totals = sumPlayerStats(stats)

  return (
    <Card className="h-full min-h-0">
      <CardHeader className="shrink-0 border-b">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>{roster.name}</CardTitle>
            <CardDescription>
              {subtitle ?? `${stats.length} player box score`}
            </CardDescription>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>{totals.pts} PTS</div>
            <div>
              {totals.reb} REB · {totals.ast} AST
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-hidden py-2">
        <div className="h-full min-h-0 overflow-auto">
          <Table className="min-w-[720px]">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead className="w-40 min-w-40">Player</TableHead>
                <TableHead className="w-12 text-right">MIN</TableHead>
                <TableHead className="w-12 text-right">PTS</TableHead>
                <TableHead className="w-12 text-right">REB</TableHead>
                <TableHead className="w-12 text-right">AST</TableHead>
                <TableHead className="text-right text-muted-foreground">
                  STL
                </TableHead>
                <TableHead className="text-right text-muted-foreground">
                  BLK
                </TableHead>
                <TableHead className="text-right text-muted-foreground">
                  TOV
                </TableHead>
                <TableHead className="w-16 text-right">FG</TableHead>
                <TableHead className="w-16 text-right">3PT</TableHead>
                <TableHead className="w-16 text-right">FT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((line) => (
                <TableRow key={line.playerId}>
                  <TableCell className="max-w-40">
                    <Link
                      to="/league/players/$playerId"
                      params={{ playerId: line.playerId }}
                      className="block truncate font-medium hover:underline"
                    >
                      {playerName(roster.players, line.playerId)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {line.minutes}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {line.pts}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {line.reb}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {line.ast}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {line.stl}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {line.blk}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {line.tov}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {line.fgm}-{line.fga}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {line.tpm}-{line.tpa}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {line.ftm}-{line.fta}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-medium">Team</TableCell>
                <TableCell className="text-right tabular-nums">-</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {totals.pts}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {totals.reb}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {totals.ast}
                </TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {totals.stl}
                </TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {totals.blk}
                </TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">
                  {totals.tov}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {totals.fgm}-{totals.fga}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {totals.tpm}-{totals.tpa}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {totals.ftm}-{totals.fta}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function sumPlayerStats(stats: PlayerGameStats[]): PlayerGameStats {
  return stats.reduce(
    (total, line) => ({
      playerId: "team",
      teamId: line.teamId,
      starter: false,
      minutes: total.minutes + line.minutes,
      pts: total.pts + line.pts,
      fgm: total.fgm + line.fgm,
      fga: total.fga + line.fga,
      tpm: total.tpm + line.tpm,
      tpa: total.tpa + line.tpa,
      ftm: total.ftm + line.ftm,
      fta: total.fta + line.fta,
      reb: total.reb + line.reb,
      ast: total.ast + line.ast,
      stl: total.stl + line.stl,
      blk: total.blk + line.blk,
      tov: total.tov + line.tov,
    }),
    {
      playerId: "team",
      teamId: "",
      starter: false,
      minutes: 0,
      pts: 0,
      fgm: 0,
      fga: 0,
      tpm: 0,
      tpa: 0,
      ftm: 0,
      fta: 0,
      reb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      tov: 0,
    }
  )
}
