import type { QuarterScores, TeamMatchupResult } from "@workspace/shared/types"

function formatQuarterLine(
  abbrev: string,
  quarters: QuarterScores,
  total: number,
): string {
  return `${abbrev}  ${quarters.join("  ")}  (${total})`
}

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
    <div className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-[0.75rem] leading-relaxed">
      <div className="mb-1 text-muted-foreground">Q1   Q2   Q3   Q4   (T)</div>
      <div>
        {formatQuarterLine(homeAbbrev, result.homeQuarterScores, result.homeScore)}
      </div>
      <div>
        {formatQuarterLine(awayAbbrev, result.awayQuarterScores, result.awayScore)}
      </div>
    </div>
  )
}
