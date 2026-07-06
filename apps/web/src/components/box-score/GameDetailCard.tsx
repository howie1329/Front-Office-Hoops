import type {
  Game,
  PlayerGameStats,
  TeamGameStats,
  TeamWithRoster,
} from "@workspace/shared/types"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { BoxScoreTable } from "./BoxScoreTable"
import { QuarterLineTable } from "./QuarterLineTable"
import { playerName } from "./playerName"

export function GameDetailCard({
  game,
  homeTeam,
  awayTeam,
}: {
  game: Game
  homeTeam: TeamWithRoster
  awayTeam: TeamWithRoster
}) {
  const { result } = game
  const winner =
    result.winnerId === homeTeam.id
      ? homeTeam
      : result.winnerId === awayTeam.id
        ? awayTeam
        : null
  const loser =
    winner?.id === homeTeam.id
      ? awayTeam
      : winner?.id === awayTeam.id
        ? homeTeam
        : null
  const topScorer = topPlayer(
    [...result.homePlayerStats, ...result.awayPlayerStats],
    "pts",
    [homeTeam, awayTeam]
  )
  const topRebounder = topPlayer(
    [...result.homePlayerStats, ...result.awayPlayerStats],
    "reb",
    [homeTeam, awayTeam]
  )
  const topPasser = topPlayer(
    [...result.homePlayerStats, ...result.awayPlayerStats],
    "ast",
    [homeTeam, awayTeam]
  )
  const homeStats = result.meta.homeTeamStats
  const awayStats = result.meta.awayTeamStats

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-px">
      <Card size="sm" className="shrink-0">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle>
                Day {game.day}: {awayTeam.abbrev} @ {homeTeam.abbrev}
              </CardTitle>
              <CardDescription>
                Final ·{" "}
                {winner ? `${winner.name} over ${loser?.name}` : "No winner"}
              </CardDescription>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[420px]">
              <ScoreMetric
                label={awayTeam.abbrev}
                value={result.awayScore}
                muted={winner?.id !== awayTeam.id}
              />
              <ScoreMetric
                label={homeTeam.abbrev}
                value={result.homeScore}
                muted={winner?.id !== homeTeam.id}
              />
              <ScoreMetric
                label="Margin"
                value={Math.abs(result.homeScore - result.awayScore)}
                muted={false}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 py-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-3">
            <div className="grid gap-2 md:grid-cols-3">
              <InsightMetric label="Top scorer" value={topScorer} />
              <InsightMetric label="Glass" value={topRebounder} />
              <InsightMetric label="Creation" value={topPasser} />
            </div>
            <QuarterLineTable
              homeAbbrev={homeTeam.abbrev}
              awayAbbrev={awayTeam.abbrev}
              result={result}
            />
          </div>
          <div className="grid gap-2">
            <TeamContextRow
              abbrev={awayTeam.abbrev}
              score={result.awayScore}
              offensiveRating={result.meta.awayOffRtg}
              possessions={result.meta.awayPossessions}
              stats={awayStats}
            />
            <TeamContextRow
              abbrev={homeTeam.abbrev}
              score={result.homeScore}
              offensiveRating={result.meta.homeOffRtg}
              possessions={result.meta.homePossessions}
              stats={homeStats}
            />
          </div>
        </CardContent>
      </Card>

      <div className="-m-px grid min-h-0 flex-1 gap-4 overflow-hidden p-px xl:grid-cols-2">
        <BoxScoreTable
          roster={awayTeam}
          stats={result.awayPlayerStats}
          subtitle={teamSubtitle(awayTeam, result.awayPlayerStats)}
        />
        <BoxScoreTable
          roster={homeTeam}
          stats={result.homePlayerStats}
          subtitle={teamSubtitle(homeTeam, result.homePlayerStats)}
        />
      </div>
    </div>
  )
}

function ScoreMetric({
  label,
  value,
  muted,
}: {
  label: string
  value: number
  muted: boolean
}) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={
          muted
            ? "mt-0.5 text-base font-medium text-muted-foreground tabular-nums"
            : "mt-0.5 text-base font-semibold tabular-nums"
        }
      >
        {value}
      </div>
    </div>
  )
}

function InsightMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/10 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-medium">{value}</div>
    </div>
  )
}

function TeamContextRow({
  abbrev,
  score,
  offensiveRating,
  possessions,
  stats,
}: {
  abbrev: string
  score: number
  offensiveRating: number
  possessions: number
  stats?: TeamGameStats
}) {
  return (
    <div className="grid gap-1.5 rounded-md border bg-muted/10 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{abbrev}</span>
        <span className="font-medium tabular-nums">{score}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>Poss {possessions}</span>
        <span className="text-right">ORtg {offensiveRating.toFixed(1)}</span>
        {stats ? (
          <>
            <span>
              FG {stats.fgm}-{stats.fga}
            </span>
            <span className="text-right">
              3PT {stats.tpm}-{stats.tpa}
            </span>
            <span>
              FT {stats.ftm}-{stats.fta}
            </span>
            <span className="text-right">TOV {stats.tov}</span>
          </>
        ) : null}
      </div>
    </div>
  )
}

function topPlayer(
  stats: PlayerGameStats[],
  key: "pts" | "reb" | "ast",
  teams: TeamWithRoster[]
): string {
  const leader = [...stats].sort((a, b) => b[key] - a[key])[0]
  const roster = teams.find((team) => team.id === leader.teamId)
  const name = roster
    ? playerName(roster.players, leader.playerId)
    : leader.playerId
  return `${name} · ${leader[key]}`
}

function teamSubtitle(team: TeamWithRoster, stats: PlayerGameStats[]): string {
  const starters = stats.filter((line) => line.starter).length
  return `${team.abbrev} · ${starters} starters · ${stats.length} played`
}
