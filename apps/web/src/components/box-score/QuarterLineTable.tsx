import type { QuarterScores, TeamMatchupResult } from "@workspace/shared/types"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

export function QuarterLineTable({
  homeAbbrev,
  awayAbbrev,
  result,
}: {
  homeAbbrev: string
  awayAbbrev: string
  result: TeamMatchupResult
}) {
  return (
    <div className="overflow-x-auto rounded-md border bg-muted/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Team</TableHead>
            <TableHead className="text-right">Q1</TableHead>
            <TableHead className="text-right">Q2</TableHead>
            <TableHead className="text-right">Q3</TableHead>
            <TableHead className="text-right">Q4</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <QuarterRow
            abbrev={awayAbbrev}
            quarters={result.awayQuarterScores}
            total={result.awayScore}
          />
          <QuarterRow
            abbrev={homeAbbrev}
            quarters={result.homeQuarterScores}
            total={result.homeScore}
          />
        </TableBody>
      </Table>
    </div>
  )
}

function QuarterRow({
  abbrev,
  quarters,
  total,
}: {
  abbrev: string
  quarters: QuarterScores
  total: number
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">{abbrev}</TableCell>
      {quarters.map((score, index) => (
        <TableCell key={index} className="text-right tabular-nums">
          {score}
        </TableCell>
      ))}
      <TableCell className="text-right font-medium tabular-nums">
        {total}
      </TableCell>
    </TableRow>
  )
}
