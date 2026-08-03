import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import * as React from "react"

import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type {
  LeagueDocument,
  LeagueGameKind,
  PlayerEntity,
  PlayerGameLogEntry,
  PlayerInformationView,
  PlayerRatingSnapshot,
  PlayerSeasonLog,
  PlayerSeasonProduction,
  UniversalPlayerValue,
} from "@workspace/domain-v2"
import {
  getPlayerInformationView,
} from "@workspace/sim-v2"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLeagueShell } from "@/components/league-shell"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/league/players/$playerId")({
  validateSearch: (
    search: Record<string, unknown>
  ): { saveId?: string; tab?: PlayerDetailTab } => {
    const saveId = typeof search.saveId === "string" ? search.saveId : undefined
    const tab = PLAYER_DETAIL_TABS.includes(search.tab as PlayerDetailTab)
      ? (search.tab as PlayerDetailTab)
      : undefined

    return { saveId, tab }
  },
  component: PlayerDetailPage,
})

const PLAYER_DETAIL_TABS = [
  "overview",
  "game-log",
  "season-log",
  "contract",
  "availability",
] as const

const GAME_KINDS: Array<LeagueGameKind> = [
  "preseason",
  "regular-season",
  "play-in",
  "playoffs",
  "finals",
]

type PlayerDetailTab = (typeof PLAYER_DETAIL_TABS)[number]

const TAB_LABELS: Record<PlayerDetailTab, string> = {
  overview: "Overview",
  "game-log": "Game Log",
  "season-log": "Season Log",
  contract: "Contract & Value",
  availability: "Availability & Injuries",
}

const SKILL_LABELS: Array<readonly [keyof PlayerRatingSnapshot["skills"], string]> = [
  ["shooting", "Shooting"],
  ["finishing", "Finishing"],
  ["passing", "Passing"],
  ["handling", "Handling"],
  ["rebounding", "Rebounding"],
  ["defense", "Defense"],
  ["basketballIQ", "Basketball IQ"],
  ["stamina", "Stamina"],
]

function fullName(player: PlayerEntity): string {
  return [player.identity.firstName, player.identity.lastName]
    .filter(Boolean)
    .join(" ") || "Unnamed player"
}

function initials(player: PlayerEntity): string {
  const name = fullName(player).split(" ").filter(Boolean)
  return name
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
}

function titleCase(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatDate(value: string | undefined): string {
  if (!value) return "—"
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date)
}

function formatMoney(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `${(value * 100).toFixed(1)}%`
    : "—"
}

function formatDecimal(value: number | null | undefined, digits = 1): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "—"
}

function gameKindLabel(kind: LeagueGameKind): string {
  return kind === "regular-season" ? "Regular season" : titleCase(kind)
}

function playerStatusLabel(player: PlayerEntity): string {
  if (player.leagueStatus.kind === "rostered") return "Rostered"
  if (player.leagueStatus.kind === "re-signing") return "Re-signing"
  return titleCase(player.leagueStatus.kind)
}

function availabilityLabel(view: PlayerInformationView): string {
  if (!view.availability.available) return "Out"
  if (view.availability.restriction === "minutes-limited") {
    return "Minutes limited"
  }
  return "Available"
}

function availabilityVariant(
  view: PlayerInformationView
): "default" | "outline" | "destructive" {
  if (!view.availability.available) return "destructive"
  if (view.availability.restriction === "minutes-limited") return "outline"
  return "default"
}

function getRosterPlayers(
  league: LeagueDocument,
  teamId: string
): Array<PlayerEntity> {
  return (league.entities.teams[teamId].rosterPlayerIds ?? [])
    .map((playerId) => league.entities.players[playerId])
    .filter((player): player is PlayerEntity => Boolean(player))
}

function getTeamName(league: LeagueDocument, teamId: string | null): string {
  return teamId ? league.entities.teams[teamId].name : "Free agent"
}

function DetailSection({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("border-b border-border py-4 sm:py-5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold tracking-[-0.01em]">{title}</h2>
        {description ? (
          <p className="text-[11px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function SummaryMetric({
  label,
  value,
  detail,
}: {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
}) {
  return (
    <div className="min-w-0 py-3">
      <dt className="text-[10px] font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold tabular-nums">{value}</dd>
      {detail ? <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{detail}</p> : null}
    </div>
  )
}

function MetricRow({
  label,
  value,
  detail,
}: {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/70 py-2 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
      {detail ? <span className="sr-only">{detail}</span> : null}
    </div>
  )
}

function RatingBars({ view }: { view: PlayerInformationView }) {
  return (
    <div className="space-y-3">
      {SKILL_LABELS.map(([key, label]) => {
        const value = Math.round(view.currentRating.skills[key])
        return (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span>{label}</span>
              <span className="font-semibold tabular-nums">{value}</span>
            </div>
            <Progress
              value={value}
              aria-label={`${label}, ${value} out of 100`}
              className="h-1.5 bg-muted"
            />
          </div>
        )
      })}
    </div>
  )
}

function RatingHistoryChart({ history }: { history: Array<PlayerRatingSnapshot> }) {
  const archivedHistory = history.filter(
    (_, index) => index < history.length - 1 || history.length === 1
  )
  const hasArchive = history.length > 1
  const trend = getRatingTrend(history)

  if (!hasArchive) {
    return (
      <div className="flex min-h-48 items-center justify-center border border-dashed border-border px-6 text-center">
        <div>
          <p className="text-sm font-medium">Overall history is not available yet.</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            The chart will appear after the first archived season. The current
            snapshot is shown in the player header.
          </p>
        </div>
      </div>
    )
  }

  const width = 640
  const height = 230
  const left = 38
  const right = 18
  const top = 16
  const bottom = 38
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const pointX = (index: number) =>
    left + (archivedHistory.length === 1 ? plotWidth / 2 : (index / (archivedHistory.length - 1)) * plotWidth)
  const pointY = (value: number) => top + (1 - value / 100) * plotHeight
  const points = archivedHistory
    .map((snapshot, index) => `${pointX(index)},${pointY(snapshot.overall)}`)
    .join(" ")

  return (
    <div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-labelledby="rating-history-title rating-history-description"
          className="min-w-[34rem] w-full"
        >
          <title id="rating-history-title">Overall rating by season</title>
          <desc id="rating-history-description">{trend}</desc>
          {[0, 50, 100].map((value) => (
            <g key={value}>
              <line
                x1={left}
                x2={width - right}
                y1={pointY(value)}
                y2={pointY(value)}
                stroke="currentColor"
                strokeOpacity="0.14"
                strokeDasharray="2 4"
              />
              <text
                x={left - 9}
                y={pointY(value) + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[10px]"
              >
                {value}
              </text>
            </g>
          ))}
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-primary"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {archivedHistory.map((snapshot, index) => (
            <g key={`${snapshot.season}-${index}`}>
              <circle
                cx={pointX(index)}
                cy={pointY(snapshot.overall)}
                r="4"
                className="fill-background stroke-primary"
                strokeWidth="2"
              >
                <title>
                  Season {snapshot.season}, age {snapshot.age}, overall {Math.round(snapshot.overall)}, {titleCase(snapshot.phase)}
                </title>
              </circle>
              <text
                x={pointX(index)}
                y={height - 12}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                S{snapshot.season}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{trend}</p>
    </div>
  )
}

function getRatingTrend(history: Array<PlayerRatingSnapshot>): string {
  if (history.length < 2) return "One current rating snapshot is available."
  const first = history[0]
  const last = history.at(-1)!
  const delta = Math.round(last.overall - first.overall)
  if (delta === 0) {
    return `Overall rating held at ${Math.round(last.overall)} across the recorded snapshots.`
  }
  return `Overall rating ${delta > 0 ? "rose" : "fell"} ${Math.abs(delta)} points from Season ${first.season} to Season ${last.season}.`
}

function ProductionMetrics({
  production,
}: {
  production: PlayerSeasonProduction | null
}) {
  if (!production) {
    return (
      <div className="border border-dashed border-border px-5 py-6 text-center">
        <p className="text-sm font-medium">No current-season games recorded.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Production will populate after the league records completed games.
        </p>
      </div>
    )
  }

  const metrics: Array<[string, React.ReactNode]> = [
    ["Games", `${production.gamesPlayed} / ${production.gamesScheduled}`],
    ["Starts", production.starts],
    ["Minutes", formatDecimal(production.minutes)],
    ["Minutes / game", formatDecimal(production.minutesPerGame)],
    ["PTS / REB / AST", `${formatDecimal(production.pointsPerGame)} / ${formatDecimal(production.reboundsPerGame)} / ${formatDecimal(production.assistsPerGame)}`],
    ["STL / BLK / TOV", `${formatDecimal(production.steals / Math.max(1, production.gamesPlayed))} / ${formatDecimal(production.blocks / Math.max(1, production.gamesPlayed))} / ${formatDecimal(production.turnoversPerGame)}`],
    ["FG / 3P / FT", `${formatPercent(production.fieldGoalPercentage)} / ${formatPercent(production.threePointPercentage)} / ${formatPercent(production.freeThrowPercentage)}`],
    ["True shooting", formatPercent(production.trueShootingPercentage)],
    ["Usage", formatPercent(production.usageRate)],
    ["Role", titleCase(production.role)],
  ]

  return (
    <dl className="grid grid-cols-2 divide-x divide-y divide-border border-y border-border sm:grid-cols-3 lg:grid-cols-5">
      {metrics.map(([label, value], index) => (
        <div key={label} className={cn("min-w-0 px-3 py-2.5", index % 2 === 1 && "sm:pl-3")}>
          <dt className="text-[10px] text-muted-foreground">{label}</dt>
          <dd className="mt-1 truncate text-xs font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function AvailabilitySummary({ view }: { view: PlayerInformationView }) {
  const currentInjury = view.availability.injury
  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-border border-y border-border sm:grid-cols-3">
      <div className="col-span-2 flex items-center justify-between gap-3 px-3 py-3 sm:col-span-1 sm:block">
        <p className="text-[10px] text-muted-foreground">Current status</p>
        <Badge variant={availabilityVariant(view)} className="mt-1">
          {availabilityLabel(view)}
        </Badge>
      </div>
      <SummaryMetric label="Games missed" value={view.availability.gamesMissed} detail="Current season" />
      <SummaryMetric label="Games remaining" value={view.availability.gamesRemaining} detail={currentInjury?.expectedReturnDate ? `Return ${formatDate(currentInjury.expectedReturnDate)}` : undefined} />
      <SummaryMetric label="Restriction" value={view.availability.minutesLimit ? `${view.availability.minutesLimit} min` : "None"} />
      <SummaryMetric label="Latest injury" value={currentInjury?.description ?? "None recorded"} detail={currentInjury?.startedDate ? formatDate(currentInjury.startedDate) : undefined} />
      <SummaryMetric label="History" value={`${view.injuries.length} record${view.injuries.length === 1 ? "" : "s"}`} detail="Complete ledger in tab" />
    </div>
  )
}

function OverviewTab({
  view,
  onOpenTab,
}: {
  view: PlayerInformationView
  onOpenTab: (tab: PlayerDetailTab) => void
}) {
  const { player, currentRating, currentProduction, currentValue } = view
  const teamId = player.leagueStatus.kind === "rostered" ? player.leagueStatus.teamId : null
  const physical = player.profile.physical

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="grid gap-x-8 px-1 pb-10 lg:grid-cols-[minmax(17rem,0.78fr)_minmax(0,1.22fr)]">
        <div className="min-w-0">
          <DetailSection title="Current snapshot" description="Current saved league state">
            <dl className="grid grid-cols-2 divide-x divide-border border-y border-border sm:grid-cols-3 lg:grid-cols-2">
              <SummaryMetric label="Overall" value={Math.round(currentRating.overall)} detail="Current ability" />
              <SummaryMetric label="Age" value={player.age} detail={`${titleCase(currentRating.phase)} phase`} />
              <SummaryMetric label="Position" value={player.profile.role.primaryPosition} detail={player.profile.role.secondaryPosition ?? "No secondary"} />
              <SummaryMetric label="Role" value={currentProduction?.role ? titleCase(currentProduction.role) : "—"} detail={teamId ? "Current production" : playerStatusLabel(player)} />
              <SummaryMetric label="Games" value={currentProduction?.gamesPlayed ?? "—"} detail={currentProduction ? `of ${currentProduction.gamesScheduled}` : "No sample"} />
              <SummaryMetric label="Value" value={currentValue ? formatDecimal(currentValue.rawValue) : "—"} detail={currentValue ? `${titleCase(currentValue.confidence)} confidence` : "No projection"} />
            </dl>
          </DetailSection>

          <DetailSection title="Ratings & skills" description="Scale: 0–100">
            <RatingBars view={view} />
            <div className="mt-5 grid grid-cols-2 gap-x-5 border-t border-border pt-4 text-xs">
              <div>
                <p className="mb-2 font-medium">Physical profile</p>
                <dl className="space-y-2 text-muted-foreground">
                  <MetricRow label="Height" value={`${Math.floor(physical.heightInches / 12)}'${physical.heightInches % 12}"`} />
                  <MetricRow label="Weight" value={`${physical.weightPounds} lb`} />
                  <MetricRow label="Wingspan" value={`${physical.wingspanInches} in`} />
                </dl>
              </div>
              <div>
                <p className="mb-2 font-medium">Role profile</p>
                <dl className="space-y-2 text-muted-foreground">
                  <MetricRow label="Archetype" value={titleCase(player.profile.role.primaryArchetype)} />
                  <MetricRow label="Secondary" value={player.profile.role.secondaryArchetype ? titleCase(player.profile.role.secondaryArchetype) : "—"} />
                  <MetricRow label="Durability" value={player.profile.injuryResistance} />
                </dl>
              </div>
            </div>
            {player.profile.traits.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-4">
                {player.profile.traits.map((trait) => <Badge key={trait} variant="outline">{titleCase(trait)}</Badge>)}
              </div>
            ) : null}
          </DetailSection>
        </div>

        <div className="min-w-0">
          <DetailSection title="Development" description="Recorded overall rating snapshots">
            <RatingHistoryChart history={view.ratingHistory} />
            <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2 text-xs sm:grid-cols-4">
              <MetricRow label="Phase" value={titleCase(player.profile.development.growthCurve)} />
              <MetricRow label="Potential" value={player.profile.development.potential} />
              <MetricRow label="Peak age" value={player.profile.development.peakAge} />
              <MetricRow label="Decline starts" value={player.profile.development.declineStartAge} />
            </dl>
          </DetailSection>

          <DetailSection title="Availability" description="Current status and recent health context">
            <AvailabilitySummary view={view} />
            <Button variant="link" size="sm" className="mt-2 h-auto px-0 text-xs" onClick={() => onOpenTab("availability")}>
              Open complete injury history
              <HugeiconsIcon icon={ArrowRight01Icon} size={13} strokeWidth={2} aria-hidden="true" />
            </Button>
          </DetailSection>

          <DetailSection title="Current production" description={currentProduction?.throughDate ? `Through ${formatDate(currentProduction.throughDate)}` : "Current season"}>
            <ProductionMetrics production={currentProduction} />
            <div className="mt-2 flex flex-wrap gap-3">
              <Button variant="link" size="sm" className="h-auto px-0 text-xs" onClick={() => onOpenTab("game-log")}>View game log</Button>
              <Button variant="link" size="sm" className="h-auto px-0 text-xs" onClick={() => onOpenTab("season-log")}>View season log</Button>
            </div>
          </DetailSection>

          <DetailSection title="Recent events" description="Player-specific history">
            {view.recentEvents.length > 0 ? (
              <ol className="divide-y divide-border border-y border-border">
                {view.recentEvents.slice(0, 5).map((event) => (
                  <li key={event.id} className="flex items-start justify-between gap-4 py-2.5 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium">{event.summary}</p>
                      <p className="mt-0.5 text-muted-foreground">{titleCase(event.type)} · Season {event.season}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0">{titleCase(event.importance)}</Badge>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="border border-dashed border-border px-4 py-5 text-center text-xs text-muted-foreground">No player-specific events recorded.</p>
            )}
          </DetailSection>
        </div>
      </div>
    </div>
  )
}

function GameLogTab({ view, league }: { view: PlayerInformationView; league: LeagueDocument }) {
  const [season, setSeason] = React.useState("all")
  const [kind, setKind] = React.useState<LeagueGameKind | "all">("all")
  const seasons = Array.from(new Set(view.gameLog.map((game) => game.season))).sort((a, b) => b - a)
  const rows = view.gameLog
    .filter((game) => season === "all" || String(game.season) === season)
    .filter((game) => kind === "all" || game.kind === kind)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.season - a.season)

  return (
    <LogTableFrame
      title="Game log"
      description={`${rows.length} of ${view.gameLog.length} games with recorded minutes`}
      controls={
        <>
          <select aria-label="Filter game log by season" value={season} onChange={(event) => setSeason(event.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
            <option value="all">All seasons</option>
            {seasons.map((value) => <option key={value} value={value}>Season {value}</option>)}
          </select>
          <select aria-label="Filter game log by competition" value={kind} onChange={(event) => setKind(event.target.value as LeagueGameKind | "all")} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
            <option value="all">All competitions</option>
            {GAME_KINDS.map((value) => <option key={value} value={value}>{gameKindLabel(value)}</option>)}
          </select>
        </>
      }
    >
      {rows.length > 0 ? (
        <Table className="min-w-[1160px] text-xs">
          <TableCaption className="sr-only">Complete game log for {fullName(view.player)}</TableCaption>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="sticky left-0 z-20 bg-background">Date</TableHead>
              <TableHead>Season</TableHead><TableHead>Opp</TableHead><TableHead>Type</TableHead><TableHead>Result</TableHead><TableHead className="text-right">MIN</TableHead><TableHead className="text-right">PTS</TableHead><TableHead className="text-right">REB</TableHead><TableHead className="text-right">AST</TableHead><TableHead className="text-right">STL</TableHead><TableHead className="text-right">BLK</TableHead><TableHead className="text-right">TOV</TableHead><TableHead className="text-right">FG</TableHead><TableHead className="text-right">3P</TableHead><TableHead className="text-right">FT</TableHead><TableHead className="text-right">USG</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{rows.map((game) => <GameLogRow key={`${game.season}-${game.scheduleId}`} game={game} league={league} />)}</TableBody>
        </Table>
      ) : (
        <LogEmpty message={view.gameLog.length > 0 ? "No games match these filters." : "No current-season games recorded."} />
      )}
    </LogTableFrame>
  )
}

function GameLogRow({ game, league }: { game: PlayerGameLogEntry; league: LeagueDocument }) {
  const box = game.boxScore
  const opponentName = league.entities.teams[game.opponentTeamId].name
  return (
    <TableRow>
      <TableCell className="sticky left-0 z-[1] whitespace-nowrap bg-background font-medium">{formatDate(game.date)}</TableCell>
      <TableCell className="tabular-nums">S{game.season}</TableCell>
      <TableCell>{opponentName}</TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">{gameKindLabel(game.kind)}</TableCell>
      <TableCell><span className={cn("font-semibold", game.won ? "text-emerald-600" : "text-destructive")}>{game.won ? "W" : "L"}</span> {box.starter ? "· Starter" : "· Bench"}</TableCell>
      <TableCell className="text-right tabular-nums">{formatDecimal(box.minutes)}</TableCell><TableCell className="text-right tabular-nums">{box.points}</TableCell><TableCell className="text-right tabular-nums">{box.rebounds}</TableCell><TableCell className="text-right tabular-nums">{box.assists}</TableCell><TableCell className="text-right tabular-nums">{box.steals}</TableCell><TableCell className="text-right tabular-nums">{box.blocks}</TableCell><TableCell className="text-right tabular-nums">{box.turnovers}</TableCell><TableCell className="text-right tabular-nums">{box.fieldGoalsMade}/{box.fieldGoalsAttempted}</TableCell><TableCell className="text-right tabular-nums">{box.threePointersMade}/{box.threePointersAttempted}</TableCell><TableCell className="text-right tabular-nums">{box.freeThrowsMade}/{box.freeThrowsAttempted}</TableCell><TableCell className="text-right tabular-nums">{formatPercent(box.usageRate)}</TableCell>
    </TableRow>
  )
}

function SeasonLogTab({ view, league }: { view: PlayerInformationView; league: LeagueDocument }) {
  const rows = view.seasonLogs.slice().sort((a, b) => b.season - a.season)
  return (
    <LogTableFrame title="Season log" description={`${rows.length} recorded season${rows.length === 1 ? "" : "s"}`}>
      {rows.length > 0 ? (
        <Table className="min-w-[1040px] text-xs">
          <TableCaption className="sr-only">Season log for {fullName(view.player)}</TableCaption>
          <TableHeader className="sticky top-0 z-10 bg-background"><TableRow><TableHead className="sticky left-0 z-20 bg-background">Season</TableHead><TableHead>Team</TableHead><TableHead className="text-right">GP</TableHead><TableHead className="text-right">MIN</TableHead><TableHead className="text-right">MPG</TableHead><TableHead className="text-right">PTS</TableHead><TableHead className="text-right">REB</TableHead><TableHead className="text-right">AST</TableHead><TableHead className="text-right">STL</TableHead><TableHead className="text-right">BLK</TableHead><TableHead className="text-right">TOV</TableHead><TableHead className="text-right">FG%</TableHead><TableHead className="text-right">3P%</TableHead><TableHead className="text-right">TS%</TableHead><TableHead>Role</TableHead><TableHead className="text-right">OVR</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map((row) => <SeasonLogRow key={row.season} row={row} view={view} league={league} />)}</TableBody>
        </Table>
      ) : <LogEmpty message="No season archives are available for this player." />}
    </LogTableFrame>
  )
}

function SeasonLogRow({ row, view, league }: { row: PlayerSeasonLog; view: PlayerInformationView; league: LeagueDocument }) {
  const production = row.total
  const teamNames = Object.keys(row.teamSplits).map((teamId) => getTeamName(league, teamId))
  const teamLabel = Object.keys(row.teamSplits).length > 1 ? `${Object.keys(row.teamSplits).length} teams` : teamNames[0] ?? (production.teamId ? production.teamId : "—")
  const isCurrent = row.season === view.currentRating.season
  return (
    <TableRow className={isCurrent ? "bg-muted/40" : undefined}>
      <TableCell className="sticky left-0 z-[1] bg-background font-medium">S{row.season}{isCurrent ? <Badge variant="outline" className="ml-2">Current</Badge> : null}</TableCell>
      <TableCell>{teamLabel}</TableCell><TableCell className="text-right tabular-nums">{production.gamesPlayed}</TableCell><TableCell className="text-right tabular-nums">{formatDecimal(production.minutes)}</TableCell><TableCell className="text-right tabular-nums">{formatDecimal(production.minutesPerGame)}</TableCell><TableCell className="text-right tabular-nums">{formatDecimal(production.pointsPerGame)}</TableCell><TableCell className="text-right tabular-nums">{formatDecimal(production.reboundsPerGame)}</TableCell><TableCell className="text-right tabular-nums">{formatDecimal(production.assistsPerGame)}</TableCell><TableCell className="text-right tabular-nums">{formatDecimal(production.steals / Math.max(1, production.gamesPlayed))}</TableCell><TableCell className="text-right tabular-nums">{formatDecimal(production.blocks / Math.max(1, production.gamesPlayed))}</TableCell><TableCell className="text-right tabular-nums">{formatDecimal(production.turnoversPerGame)}</TableCell><TableCell className="text-right tabular-nums">{formatPercent(production.fieldGoalPercentage)}</TableCell><TableCell className="text-right tabular-nums">{formatPercent(production.threePointPercentage)}</TableCell><TableCell className="text-right tabular-nums">{formatPercent(production.trueShootingPercentage)}</TableCell><TableCell>{titleCase(production.role)}</TableCell><TableCell className="text-right tabular-nums">{row.rating ? Math.round(row.rating.overall) : "—"}</TableCell><TableCell className="text-right tabular-nums">{row.value ? formatDecimal(row.value.rawValue) : "—"}</TableCell>
    </TableRow>
  )
}

function ContractValueTab({ view, league }: { view: PlayerInformationView; league: LeagueDocument }) {
  const contract = view.contract
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="grid gap-x-8 px-1 pb-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(20rem,1.08fr)]">
        <div className="min-w-0">
          <DetailSection title="Contract" description="Normalized contract context">
            {contract ? <>
              <dl className="divide-y divide-border border-y border-border text-xs">
                <MetricRow label="Team" value={getTeamName(league, contract.teamId)} /><MetricRow label="Status" value={titleCase(contract.status)} /><MetricRow label="Source" value={contract.source ? titleCase(contract.source) : "—"} /><MetricRow label="Start season" value={contract.startSeason ?? "—"} /><MetricRow label="End season" value={contract.endSeason ?? "—"} /><MetricRow label="Total value" value={formatMoney(contract.totalValue)} /><MetricRow label="Remaining value" value={formatMoney(contract.remainingValue)} /><MetricRow label="Years remaining" value={contract.yearsRemaining} />
              </dl>
              <div className="mt-4 overflow-x-auto">
                <Table className="min-w-[28rem] text-xs"><TableCaption className="sr-only">Annual salary schedule</TableCaption><TableHeader><TableRow><TableHead>Season</TableHead><TableHead className="text-right">Salary</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader><TableBody>{contract.annualSalary.map((salary, index) => { const year = (contract.startSeason ?? league.state.season) + index; const active = year >= league.state.season && year <= (contract.endSeason ?? year); return <TableRow key={year} className={active ? "bg-muted/40" : undefined}><TableCell>S{year}{year === league.state.season ? <Badge variant="outline" className="ml-2">Current</Badge> : null}</TableCell><TableCell className="text-right tabular-nums">{formatMoney(salary)}</TableCell><TableCell className="text-right text-muted-foreground">{active ? "Active" : "Past"}</TableCell></TableRow> })}</TableBody></Table>
              </div>
            </> : <EmptyBlock title="No active contract" description="No active contract is recorded for this player." />}
          </DetailSection>
        </div>
        <div className="min-w-0">
          <DetailSection title="Universal Player Value" description="Evaluation context, not an objective truth">
            {view.currentValue ? <ValueBreakdown value={view.currentValue} /> : <EmptyBlock title="No value sample yet" description="A Universal Player Value projection will appear once the current season has enough production data." />}
          </DetailSection>
        </div>
      </div>
    </div>
  )
}

function ValueBreakdown({ value }: { value: UniversalPlayerValue }) {
  const breakdown = Object.entries(value.breakdown) as Array<[keyof UniversalPlayerValue["breakdown"], number]>
  return <>
    <div className="grid grid-cols-2 divide-x divide-y divide-border border-y border-border sm:grid-cols-4"><SummaryMetric label="Value" value={formatDecimal(value.rawValue)} detail={`${titleCase(value.confidence)} confidence`} /><SummaryMetric label="Rank" value={`#${value.diagnostics.rank}`} detail={`${formatDecimal(value.diagnostics.percentile, 0)}th percentile`} /><SummaryMetric label="Sample" value={`${value.sample.games} games`} detail={`${formatDecimal(value.sample.minutes)} minutes`} /><SummaryMetric label="Seasons" value={value.sample.seasons} detail={titleCase(value.evaluationPoint)} /></div>
    <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">{breakdown.map(([key, score]) => <div key={key} className="flex items-center justify-between gap-3 border-b border-border/70 py-1.5 text-xs"><span className="text-muted-foreground">{titleCase(key)}</span><span className="font-medium tabular-nums">{formatDecimal(score)}</span></div>)}</div>
    {value.diagnostics.outlierFlags.length > 0 ? <div className="mt-4 border border-border bg-muted/30 px-3 py-2 text-xs"><p className="font-medium">Model notes</p><p className="mt-1 text-muted-foreground">{value.diagnostics.outlierFlags.map(titleCase).join(" · ")}</p></div> : null}
  </>
}

function AvailabilityTab({ view }: { view: PlayerInformationView }) {
  return <div className="min-h-0 flex-1 overflow-y-auto"><div className="px-1 pb-10"><DetailSection title="Current availability" description="Current saved league state"><AvailabilitySummary view={view} /></DetailSection><DetailSection title="Injury history" description={`${view.injuries.length} recorded incident${view.injuries.length === 1 ? "" : "s"}`}><div className="overflow-x-auto">{view.injuries.length > 0 ? <Table className="min-w-[800px] text-xs"><TableCaption className="sr-only">Injury history for {fullName(view.player)}</TableCaption><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Season</TableHead><TableHead>Description</TableHead><TableHead>Expected return</TableHead><TableHead>Actual return</TableHead><TableHead className="text-right">Games missed</TableHead><TableHead>Source</TableHead></TableRow></TableHeader><TableBody>{view.injuries.map((injury) => <TableRow key={injury.id}><TableCell className="whitespace-nowrap">{formatDate(injury.startDate)}</TableCell><TableCell>S{injury.season}</TableCell><TableCell>{injury.description}</TableCell><TableCell>{formatDate(injury.expectedReturnDate)}</TableCell><TableCell>{formatDate(injury.returnDate)}</TableCell><TableCell className="text-right tabular-nums">{injury.gamesMissed}</TableCell><TableCell>{injury.sourceScheduleId ?? "—"}</TableCell></TableRow>)}</TableBody></Table> : <EmptyBlock title="No recorded injuries" description="No injury records exist for this player." />}</div></DetailSection></div></div>
}

function LogTableFrame({ title, description, controls, children }: { title: string; description: string; controls?: React.ReactNode; children: React.ReactNode }) {
  return <section className="flex min-h-0 flex-1 flex-col overflow-hidden border-y border-border"><div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2.5 sm:px-4"><div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p></div>{controls ? <div className="flex flex-wrap items-center gap-2">{controls}</div> : null}</div><div className="min-h-0 flex-1 overflow-auto">{children}</div><div className="shrink-0 border-t border-border px-3 py-2 text-[11px] text-muted-foreground sm:px-4">Scroll within the table to inspect the complete log.</div></section>
}

function LogEmpty({ message }: { message: string }) {
  return <div className="flex min-h-48 items-center justify-center px-4 text-center"><div><p className="text-sm font-medium">{message}</p><p className="mt-1 text-xs text-muted-foreground">The saved league snapshot does not contain another row for this view.</p></div></div>
}

function EmptyBlock({ title, description }: { title: string; description: string }) {
  return <div className="border border-dashed border-border px-5 py-7 text-center"><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>
}

function PlayerHeader({
  league,
  view,
  rosterPlayers,
  onNavigatePlayer,
  onOpenTab,
  onEditRotation,
  onRelease,
}: {
  league: LeagueDocument
  view: PlayerInformationView
  rosterPlayers: Array<PlayerEntity>
  onNavigatePlayer: (playerId: string) => void
  onOpenTab: (tab: PlayerDetailTab) => void
  onEditRotation: () => void
  onRelease: () => void
}) {
  const { player, currentRating } = view
  const rosterIndex = rosterPlayers.findIndex((candidate) => candidate.id === player.id)
  const previousPlayer = rosterIndex > 0 ? rosterPlayers[rosterIndex - 1] : undefined
  const nextPlayer = rosterIndex >= 0 ? rosterPlayers[rosterIndex + 1] : undefined
  const teamId = player.leagueStatus.kind === "rostered" ? player.leagueStatus.teamId : null

  return <header className="shrink-0 border-y border-border bg-background"><div className="flex flex-wrap items-start justify-between gap-4 px-3 py-3 sm:px-4"><div className="flex min-w-0 items-start gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">{initials(player)}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><h1 className="truncate text-lg font-semibold tracking-[-0.025em]">{fullName(player)}</h1><Badge variant="outline">{playerStatusLabel(player)}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{player.profile.role.primaryPosition}{player.profile.role.secondaryPosition ? ` / ${player.profile.role.secondaryPosition}` : ""} · {titleCase(player.profile.role.primaryArchetype)} · Age {player.age}</p><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"><span className="font-medium">{getTeamName(league, teamId)}</span>{teamId ? <Link to="/league/roster" search={{ saveId: league.metadata.id }} className="text-primary hover:underline">View roster</Link> : null}<Badge variant={availabilityVariant(view)}>{availabilityLabel(view)}</Badge></div></div></div><div className="flex items-center gap-1.5"><Button asChild variant="ghost" size="sm"><Link to="/league/roster" search={{ saveId: league.metadata.id }}><HugeiconsIcon icon={ArrowLeft01Icon} size={14} strokeWidth={2} aria-hidden="true" />Back to roster</Link></Button><Button type="button" variant="outline" size="icon-sm" disabled={!previousPlayer} aria-label={previousPlayer ? `Previous player: ${fullName(previousPlayer)}` : "No previous player"} title={previousPlayer ? `Previous: ${fullName(previousPlayer)}` : "No previous player"} onClick={() => previousPlayer && onNavigatePlayer(previousPlayer.id)}><HugeiconsIcon icon={ArrowLeft01Icon} size={14} strokeWidth={2} aria-hidden="true" /></Button><Button type="button" variant="outline" size="icon-sm" disabled={!nextPlayer} aria-label={nextPlayer ? `Next player: ${fullName(nextPlayer)}` : "No next player"} title={nextPlayer ? `Next: ${fullName(nextPlayer)}` : "No next player"} onClick={() => nextPlayer && onNavigatePlayer(nextPlayer.id)}><HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={2} aria-hidden="true" /></Button><DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" size="sm" className="gap-1.5">Actions<HugeiconsIcon icon={ArrowDown01Icon} size={13} strokeWidth={2} aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52"><DropdownMenuLabel>Player actions</DropdownMenuLabel><DropdownMenuItem onSelect={onEditRotation}>Edit Rotation</DropdownMenuItem><DropdownMenuItem onSelect={() => onOpenTab("contract")}>Review Contract</DropdownMenuItem><DropdownMenuItem disabled>Add to Trade<span className="ml-auto text-[10px] text-muted-foreground">Soon</span></DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" disabled={player.leagueStatus.kind !== "rostered"} onSelect={onRelease}>Release Player</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></div><div className="grid w-full grid-cols-2 divide-x divide-border border-t border-border sm:grid-cols-5"><SummaryMetric label="Overall" value={Math.round(currentRating.overall)} detail="Current ability" /><SummaryMetric label="Development" value={titleCase(currentRating.phase)} detail={`Potential ${player.profile.development.potential}`} /><SummaryMetric label="Role" value={player.profile.role.primaryPosition} detail={titleCase(player.profile.role.primaryArchetype)} /><SummaryMetric label="Games" value={view.currentProduction?.gamesPlayed ?? "—"} detail={view.currentProduction ? `of ${view.currentProduction.gamesScheduled}` : "No sample"} /><SummaryMetric label="Value" value={view.currentValue ? formatDecimal(view.currentValue.rawValue) : "—"} detail={view.currentValue ? titleCase(view.currentValue.confidence) : "No projection"} /></div></header>
}

function ReleaseDialog({ view, open, isReleasing, onOpenChange, onConfirm }: { view: PlayerInformationView; open: boolean; isReleasing: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void }) {
  const teamId = view.player.leagueStatus.kind === "rostered" ? view.player.leagueStatus.teamId : null
  return <AlertDialog open={open} onOpenChange={onOpenChange}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Release {fullName(view.player)}?</AlertDialogTitle><AlertDialogDescription>This removes the player from {teamId ? "the roster" : "the current team"} and creates a free-agent transaction. Remaining salary becomes dead money under the current league rules.</AlertDialogDescription></AlertDialogHeader>{view.contract ? <div className="flex items-center justify-between gap-4 rounded-md bg-muted px-3 py-2 text-xs"><span className="text-muted-foreground">Remaining contract value</span><span className="font-semibold tabular-nums">{formatMoney(view.contract.remainingValue)}</span></div> : null}<AlertDialogFooter><AlertDialogCancel disabled={isReleasing}>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={isReleasing} onClick={onConfirm}>{isReleasing ? "Releasing…" : "Release player"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
}

function PlayerNotFound() {
  const { league } = useLeagueShell()
  return <div className="flex h-0 min-h-0 flex-1 items-center justify-center px-5"><div className="max-w-md text-center"><p className="text-sm font-semibold">Player unavailable</p><p className="mt-1 text-xs text-muted-foreground">This player is not available in the selected league snapshot.</p><Button asChild variant="outline" size="sm" className="mt-4"><Link to="/league/roster" search={{ saveId: league.metadata.id }}><HugeiconsIcon icon={ArrowLeft01Icon} size={14} strokeWidth={2} aria-hidden="true" />Back to roster</Link></Button></div></div>
}

function PlayerDetailPage() {
  const { playerId } = Route.useParams()
  const { tab = "overview" } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { league, teamId, handleReleasePlayer, isSimulating } = useLeagueShell()
  const view = getPlayerInformationView(league, playerId)
  const rosterPlayers = getRosterPlayers(league, teamId)
  const [releaseOpen, setReleaseOpen] = React.useState(false)

  if (!view) return <PlayerNotFound />

  function openTab(nextTab: PlayerDetailTab) {
    void navigate({ search: (previous) => ({ ...previous, tab: nextTab }) })
  }

  function navigatePlayer(nextPlayerId: string) {
    void navigate({ to: "/league/players/$playerId", params: { playerId: nextPlayerId }, search: (previous) => previous })
  }

  async function confirmRelease() {
    if (isSimulating) return
    const completed = await handleReleasePlayer(playerId)
    if (completed) setReleaseOpen(false)
  }

  function editRotation() {
    void navigate({
      to: "/league/roster",
      search: { saveId: league.metadata.id, tab: "rotation" },
    })
  }

  return <div className="mx-auto flex h-0 min-h-0 w-full max-w-[96rem] flex-1 flex-col gap-3 overflow-hidden px-4 py-3 sm:px-6 lg:px-8"><PlayerHeader league={league} view={view} rosterPlayers={rosterPlayers} onNavigatePlayer={navigatePlayer} onOpenTab={openTab} onEditRotation={editRotation} onRelease={() => setReleaseOpen(true)} /><Tabs value={tab} onValueChange={(value) => openTab(value as PlayerDetailTab)} className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"><div className="shrink-0 overflow-x-auto border-b border-border" aria-label="Player detail sections"><TabsList variant="line" className="h-10 min-w-max px-1 sm:px-2">{PLAYER_DETAIL_TABS.map((item) => <TabsTrigger key={item} value={item} className="h-full px-3">{TAB_LABELS[item]}</TabsTrigger>)}</TabsList></div><TabsContent value="overview" className="mt-0 flex min-h-0 flex-1 overflow-hidden"><OverviewTab view={view} onOpenTab={openTab} /></TabsContent><TabsContent value="game-log" className="mt-0 flex min-h-0 flex-1 overflow-hidden"><GameLogTab view={view} league={league} /></TabsContent><TabsContent value="season-log" className="mt-0 flex min-h-0 flex-1 overflow-hidden"><SeasonLogTab view={view} league={league} /></TabsContent><TabsContent value="contract" className="mt-0 flex min-h-0 flex-1 overflow-hidden"><ContractValueTab view={view} league={league} /></TabsContent><TabsContent value="availability" className="mt-0 flex min-h-0 flex-1 overflow-hidden"><AvailabilityTab view={view} /></TabsContent></Tabs><ReleaseDialog view={view} open={releaseOpen} isReleasing={isSimulating} onOpenChange={setReleaseOpen} onConfirm={() => void confirmRelease()} /></div>
}
