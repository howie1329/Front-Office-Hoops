import type { PlayoffSeries, SeasonState } from "@workspace/shared/types"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { teamAbbrev, teamName } from "./lib/teamFormat"

function roundLabel(round: PlayoffSeries["round"], teamCount: number): string {
  if (teamCount === 6) {
    return round === 1 ? "Semifinals" : "Finals"
  }

  switch (round) {
    case 1:
      return "First round"
    case 2:
      return "Conference semifinals"
    case 3:
      return "Conference finals"
    case 4:
      return "Finals"
    default:
      return `Round ${round}`
  }
}

function SeriesRow({
  state,
  series,
  userTeamId,
}: {
  state: SeasonState
  series: PlayoffSeries
  userTeamId: string | null
}) {
  const involvesUser =
    userTeamId === series.higherSeedTeamId ||
    userTeamId === series.lowerSeedTeamId

  return (
    <div
      className={`rounded-md border px-3 py-2 text-sm ${
        involvesUser ? "border-primary/40 bg-muted/40" : ""
      }`}
    >
      <p className="text-xs text-muted-foreground">
        {roundLabel(series.round, state.teams.length)}
        {series.conferenceId ? ` · ${series.conferenceId}` : ""}
      </p>
      <p>
        ({series.higherSeed}) {teamName(state, series.higherSeedTeamId)} vs (
        {series.lowerSeed}) {teamName(state, series.lowerSeedTeamId)}
      </p>
      <p className="text-xs text-muted-foreground">
        {teamAbbrev(state, series.higherSeedTeamId)} {series.winsHigher} –{" "}
        {series.winsLower} {teamAbbrev(state, series.lowerSeedTeamId)}
        {series.winnerId
          ? ` · Winner: ${teamAbbrev(state, series.winnerId)}`
          : ""}
      </p>
    </div>
  )
}

export function PlayoffBracket({
  state,
  userTeamId,
}: {
  state: SeasonState
  userTeamId: string | null
}) {
  const series = state.playoffBracket?.series ?? []

  if (series.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Playoff bracket</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No playoff series yet. Begin playoffs after the regular season ends.
          </p>
        </CardContent>
      </Card>
    )
  }

  const grouped = new Map<string, PlayoffSeries[]>()
  for (const entry of series) {
    const key = entry.conferenceId ?? "finals"
    const bucket = grouped.get(key) ?? []
    bucket.push(entry)
    grouped.set(key, bucket)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Playoff bracket</CardTitle>
        <CardDescription>
          Best-of-{state.teams.length === 30 ? 7 : 3} series. Your team is
          highlighted.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        {[...grouped.entries()].map(([group, entries]) => (
          <div key={group} className="flex flex-col gap-2">
            <h3 className="text-sm font-medium capitalize">{group}</h3>
            {entries
              .sort((a, b) => a.round - b.round || a.id.localeCompare(b.id))
              .map((entry) => (
                <SeriesRow
                  key={entry.id}
                  state={state}
                  series={entry}
                  userTeamId={userTeamId}
                />
              ))}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
