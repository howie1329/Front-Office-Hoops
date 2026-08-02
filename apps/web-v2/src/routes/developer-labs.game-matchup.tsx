import { createFileRoute, Link } from "@tanstack/react-router"
import { serializeMatchupBatchReport } from "@workspace/calibration"
import type { MatchupBatchReport } from "@workspace/calibration"
import type {
  GameMatchupFixture,
  GameResult,
  GameSimulationConfig,
  GameTeamBoxScore,
} from "@workspace/domain-v2"
import { gameMatchupFixtureSchema } from "@workspace/league-schema"
import {
  createStandardGameSimulationConfig,
  GAME_SETTING_DESCRIPTORS,
  getGameNumericSetting,
  updateGameNumericSetting,
} from "@workspace/sim-v2"
import type { GameNumericSettingPath } from "@workspace/sim-v2"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import * as React from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  createDefaultGameMatchupLabFixture,
  getGameMatchupLabPlayerName,
  migrateGameMatchupLabReport,
  runGameMatchupLab,
  serializeGameMatchupLabReport,
} from "@/lib/gameMatchupLab"
import { runMatchupBatchInWorker } from "@/lib/gameMatchupWorker"

export const Route = createFileRoute("/developer-labs/game-matchup")({
  component: GameMatchupLabPage,
})

type NumberSection =
  "environment" | "offense" | "defense" | "rotation" | "coaching"

function formatNumber(value: number, decimals = 1): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(decimals)
}

function SettingField({
  config,
  descriptor,
  onChange,
}: {
  config: GameSimulationConfig
  descriptor: (typeof GAME_SETTING_DESCRIPTORS)[number]
  onChange: (path: GameNumericSettingPath, value: number) => void
}) {
  const value = getGameNumericSetting(config, descriptor.path)
  return (
    <div className="grid gap-2 border-b border-border/70 pb-3 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label htmlFor={`setting-${descriptor.path}`}>
            {descriptor.label}
          </Label>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {descriptor.description}
          </p>
        </div>
        <Input
          id={`setting-${descriptor.path}`}
          className="h-7 w-16 text-right text-xs"
          type="number"
          min={descriptor.min}
          max={descriptor.max}
          step={descriptor.step}
          value={value}
          aria-label={`${descriptor.label} exact value`}
          onChange={(event) => {
            const nextValue = Number(event.target.value)
            if (!Number.isFinite(nextValue)) return
            onChange(
              descriptor.path,
              Math.min(descriptor.max, Math.max(descriptor.min, nextValue))
            )
          }}
        />
      </div>
      <Slider
        id={`slider-${descriptor.path}`}
        min={descriptor.min}
        max={descriptor.max}
        step={descriptor.step}
        value={[value]}
        aria-label={descriptor.label}
        className="w-full"
        onValueChange={(values) => {
          const nextValue = values[0]
          if (typeof nextValue === "number" && Number.isFinite(nextValue)) {
            onChange(descriptor.path, nextValue)
          }
        }}
      />
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{descriptor.min}</span>
        <span>{descriptor.max}</span>
      </div>
    </div>
  )
}

function SectionSettings({
  section,
  config,
  onChange,
}: {
  section: NumberSection
  config: GameSimulationConfig
  onChange: (path: GameNumericSettingPath, value: number) => void
}) {
  const descriptors = GAME_SETTING_DESCRIPTORS.filter((descriptor) =>
    descriptor.path.startsWith(`${section}.`)
  )
  return (
    <div className="grid gap-4">
      {descriptors.map((descriptor) => (
        <SettingField
          key={descriptor.path}
          config={config}
          descriptor={descriptor}
          onChange={onChange}
        />
      ))}
    </div>
  )
}

function SettingsSection({
  title,
  description,
  children,
  open = false,
}: {
  title: string
  description: string
  children: React.ReactNode
  open?: boolean
}) {
  return (
    <details open={open} className="group border-t border-border">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset motion-reduce:transition-none [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm font-semibold">{title}</span>
          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
            {description}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="text-sm text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
        >
          ↓
        </span>
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  )
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" })
  )
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function ResultStatus({ result }: { result: GameResult | null }) {
  if (!result) return <Badge variant="outline">No run</Badge>
  if (result.status === "completed") {
    return <Badge variant="default">Reconciled</Badge>
  }
  if (result.status === "rejected") {
    return <Badge variant="destructive">Rejected</Badge>
  }
  return <Badge variant="destructive">Failed</Badge>
}

function Scoreboard({
  fixture,
  result,
}: {
  fixture: GameMatchupFixture
  result: GameResult | null
}) {
  const home = result?.teams[fixture.homeTeamId]
  const away = result?.teams[fixture.awayTeamId]
  const homePeriodPoints = result?.periods.map(
    (period) => period.teamPoints[fixture.homeTeamId] ?? 0
  )
  const awayPeriodPoints = result?.periods.map(
    (period) => period.teamPoints[fixture.awayTeamId] ?? 0
  )
  const scoreboardTeams: Array<{
    teamId: string
    team: GameTeamBoxScore | undefined
    periods: Array<number>
  }> = [
    { teamId: fixture.homeTeamId, team: home, periods: homePeriodPoints ?? [] },
    { teamId: fixture.awayTeamId, team: away, periods: awayPeriodPoints ?? [] },
  ]
  return (
    <div className="grid gap-5" role="group" aria-label="Game result">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{fixture.source.kind.replaceAll("-", " ")}</span>
            <span aria-hidden="true">·</span>
            <span>Seed {fixture.seed}</span>
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight">
            {fixture.teams[fixture.homeTeamId].name} vs.{" "}
            {fixture.teams[fixture.awayTeamId].name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Possession model · {result?.periods.length ?? 0} periods ·{" "}
            {result?.events.length ?? 0} events
          </p>
        </div>
        <div className="flex items-center gap-2">
          {result?.winnerTeamId ? (
            <span className="text-xs text-muted-foreground">
              Winner: {fixture.teams[result.winnerTeamId].name}
            </span>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-end">
        {scoreboardTeams.map(({ teamId, team, periods }, index) => (
          <div
            key={teamId}
            className={
              index === 1 ? "min-w-0 md:order-3" : "min-w-0 md:order-1"
            }
          >
            <div className="flex items-end justify-between gap-3">
              <span className="truncate text-sm font-medium">
                {fixture.teams[teamId].name}
              </span>
              <span className="font-mono text-5xl font-semibold tracking-tight tabular-nums">
                {team?.points ?? "—"}
              </span>
            </div>
            <div className="mt-2 flex gap-3 border-t border-border pt-2 font-mono text-xs text-muted-foreground tabular-nums">
              {periods.map((points, periodIndex) => (
                <span key={teamId + "-" + periodIndex}>
                  P{periodIndex + 1} {points}
                </span>
              ))}
            </div>
          </div>
        ))}
        <span className="hidden text-center text-xs font-medium text-muted-foreground md:order-2 md:block">
          FINAL
        </span>
      </div>
    </div>
  )
}

function TeamSummary({
  fixture,
  result,
}: {
  fixture: GameMatchupFixture
  result: GameResult
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {[fixture.homeTeamId, fixture.awayTeamId].map((teamId) => {
        const team = result.teams[teamId]
        return (
          <div
            key={teamId}
            className="rounded-lg border border-border bg-muted/20 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">
                {fixture.teams[teamId].name}
              </span>
              <span className="font-mono text-sm tabular-nums">
                {team.offensiveEfficiency} ORtg
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Possessions</span>
                <div className="mt-1 font-mono tabular-nums">
                  {team.possessions}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">3PA rate</span>
                <div className="mt-1 font-mono tabular-nums">
                  {team.fieldGoalsAttempted
                    ? `${Math.round((team.threePointersAttempted / team.fieldGoalsAttempted) * 100)}%`
                    : "—"}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Turnovers</span>
                <div className="mt-1 font-mono tabular-nums">
                  {team.turnovers}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BoxScoreTable({
  fixture,
  result,
}: {
  fixture: GameMatchupFixture
  result: GameResult
}) {
  const players = Object.values(result.players).sort(
    (left, right) =>
      left.teamId.localeCompare(right.teamId) ||
      Number(right.starter) - Number(left.starter) ||
      right.points - left.points
  )
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table className="min-w-[980px] text-xs" aria-label="Player box scores">
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 w-[210px] border-r border-border bg-background">
              Player
            </TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="text-right">MIN</TableHead>
            <TableHead className="text-right">OPP</TableHead>
            <TableHead className="text-right">PTS</TableHead>
            <TableHead className="text-right">FG</TableHead>
            <TableHead className="text-right">3P</TableHead>
            <TableHead className="text-right">REB</TableHead>
            <TableHead className="text-right">AST</TableHead>
            <TableHead className="text-right">TOV</TableHead>
            <TableHead className="text-right">STL</TableHead>
            <TableHead className="text-right">BLK</TableHead>
            <TableHead>Availability</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player) => (
            <TableRow key={player.playerId}>
              <TableCell className="sticky left-0 z-[1] border-r border-border bg-background font-medium">
                <div>
                  {getGameMatchupLabPlayerName(fixture, player.playerId)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {fixture.teams[player.teamId].name} ·{" "}
                  {player.starter ? "Starter" : "Bench"}
                </div>
              </TableCell>
              <TableCell>
                <div>{player.role.label}</div>
                <div className="text-[11px] text-muted-foreground">
                  {Math.round(player.role.creationShare)} creation /{" "}
                  {Math.round(player.role.scoringShare)} scoring
                </div>
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatNumber(player.minutes)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {player.opportunities}
              </TableCell>
              <TableCell className="text-right font-mono font-medium tabular-nums">
                {player.points}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {player.fieldGoalsMade}-{player.fieldGoalsAttempted}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {player.threePointersMade}-{player.threePointersAttempted}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {player.rebounds}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {player.assists}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {player.turnovers}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {player.steals}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {player.blocks}
              </TableCell>
              <TableCell>
                {player.availability.available
                  ? "Available"
                  : `${player.availability.gamesRemaining} games out`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ReconciliationPanel({ result }: { result: GameResult }) {
  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3">
        <div>
          <h3 className="text-sm font-medium">Reconciliation</h3>
          <p className="text-xs text-muted-foreground">
            Every check is retained with the run.
          </p>
        </div>
        <Badge
          variant={result.reconciliation.passed ? "default" : "destructive"}
        >
          {result.reconciliation.passed ? "All checks pass" : "Action required"}
        </Badge>
      </div>
      <div className="divide-y divide-border/70">
        {result.reconciliation.checks.map((check) => (
          <div
            key={check.code}
            className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
          >
            <span
              className={
                check.passed
                  ? "text-muted-foreground"
                  : "font-medium text-destructive"
              }
            >
              {check.label}
            </span>
            <span className="font-mono tabular-nums">
              {check.passed ? "PASS" : `${check.actual} vs ${check.expected}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BatchPanel({ report }: { report: MatchupBatchReport | null }) {
  if (!report) {
    return (
      <div className="border border-dashed border-border p-5 text-sm text-muted-foreground">
        Run a repeated batch to compare score, pace, star opportunity, injury,
        and reconciliation distributions.
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3">
        <div>
          <h3 className="text-sm font-medium">Repeated matchup report</h3>
          <p className="text-xs text-muted-foreground">
            {report.completed} completed · {report.failed} retained failures ·
            base seed {report.baseSeed}
          </p>
        </div>
        <Badge variant={report.failed ? "destructive" : "default"}>
          {report.failed ? "Outliers retained" : "Batch clean"}
        </Badge>
      </div>
      <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(report.metrics)
          .slice(0, 8)
          .map(([key, metric]) => (
            <div key={key} className="bg-background p-3">
              <div className="text-xs text-muted-foreground">{key}</div>
              <div className="mt-1 font-mono text-lg tabular-nums">
                {formatNumber(metric.mean, 2)}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                p10 {formatNumber(metric.p10, 1)} · p90{" "}
                {formatNumber(metric.p90, 1)}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

function GameMatchupLabPage() {
  const [seed, setSeed] = React.useState("game-matchup-lab")
  const [config, setConfig] = React.useState(createStandardGameSimulationConfig)
  const [fixture, setFixture] = React.useState<GameMatchupFixture | null>(null)
  const [result, setResult] = React.useState<GameResult | null>(null)
  const [batchReport, setBatchReport] =
    React.useState<MatchupBatchReport | null>(null)
  const [batchCount, setBatchCount] = React.useState(25)
  const [progress, setProgress] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [isDirty, setIsDirty] = React.useState(false)
  const abortRef = React.useRef<AbortController | null>(null)
  const importInputRef = React.useRef<HTMLInputElement | null>(null)

  function createFixture() {
    try {
      const nextFixture = createDefaultGameMatchupLabFixture(seed)
      nextFixture.config = structuredClone(config)
      setFixture(nextFixture)
      setResult(null)
      setBatchReport(null)
      setError(null)
      setIsDirty(true)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Fixture creation failed."
      )
    }
  }

  function updateConfig(nextConfig: GameSimulationConfig) {
    setConfig(nextConfig)
    setFixture((current) =>
      current ? { ...current, config: nextConfig } : current
    )
    setIsDirty(true)
  }

  function handleNumericSetting(path: GameNumericSettingPath, value: number) {
    updateConfig(updateGameNumericSetting(config, path, value))
  }

  function updateFixture(
    updater: (current: GameMatchupFixture) => GameMatchupFixture
  ) {
    setFixture((current) => {
      if (!current) return current
      const next = updater(current)
      setIsDirty(true)
      return next
    })
  }

  function handleRun() {
    if (!fixture) {
      createFixture()
      return
    }
    try {
      const nextFixture = { ...fixture, seed, config }
      const nextResult = runGameMatchupLab(nextFixture)
      setFixture(nextFixture)
      setResult(nextResult)
      setError(null)
      setIsDirty(false)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Game simulation failed."
      )
    }
  }

  async function handleBatch() {
    if (!fixture) {
      createFixture()
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setProgress(`Starting ${batchCount}-game batch…`)
    setError(null)
    try {
      const report = await runMatchupBatchInWorker(
        { ...fixture, seed, config },
        Math.max(1, Math.min(1000, Math.round(batchCount))),
        {
          signal: controller.signal,
          onProgress: (nextProgress) =>
            setProgress(
              `${nextProgress.label} · ${nextProgress.completed}/${nextProgress.total}`
            ),
        }
      )
      setBatchReport(report)
      setProgress(null)
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        setProgress(null)
        return
      }
      setProgress(null)
      setError(
        caught instanceof Error ? caught.message : "Batch simulation failed."
      )
    }
  }

  function cancelBatch() {
    abortRef.current?.abort()
    setProgress(null)
  }

  function handleExport() {
    if (!fixture || !result) return
    downloadText(
      `foh-game-matchup-${fixture.seed}.json`,
      serializeGameMatchupLabReport(fixture, result)
    )
  }

  function handleBatchExport() {
    if (!batchReport) return
    downloadText(
      `foh-game-matchup-batch-${batchReport.baseSeed}.json`,
      serializeMatchupBatchReport(batchReport)
    )
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    try {
      const payload = JSON.parse(await file.text()) as {
        fixture?: unknown
        result?: unknown
        schema?: unknown
      }
      const importedReport =
        payload.schema === "foh-game-matchup-lab" && payload.result
          ? migrateGameMatchupLabReport(payload)
          : null
      const parsed = gameMatchupFixtureSchema.safeParse(
        importedReport?.fixture ?? payload.fixture ?? payload
      )
      if (!parsed.success) {
        throw new Error(
          `Fixture import failed: ${parsed.error.issues[0]?.message ?? "invalid fixture"}`
        )
      }
      setFixture(parsed.data)
      setConfig(parsed.data.config)
      setSeed(parsed.data.seed)
      setResult(importedReport?.result ?? null)
      setBatchReport(null)
      setError(null)
      setIsDirty(!importedReport)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Fixture import failed."
      )
    }
  }

  function handleReset() {
    const standard = createStandardGameSimulationConfig()
    setConfig(standard)
    setFixture((current) =>
      current ? { ...current, config: standard } : current
    )
    setIsDirty(true)
  }

  return (
    <main className="min-h-svh bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-8">
        <header className="border-b border-border pb-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Link
                  to="/developer-labs"
                  className="transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  Developer Labs
                </Link>
                <span aria-hidden="true">/</span>
                <span>Game &amp; matchup</span>
                <Badge variant="outline" className="font-medium">
                  Developer only
                </Badge>
              </div>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-balance">
                Game &amp; matchup lab
              </h1>
              <p className="mt-2 max-w-2xl text-base leading-7 text-pretty text-muted-foreground">
                Run one deterministic possession-based game, inspect why it
                happened, then compare the same matchup across a retained batch.
              </p>
            </div>
            <nav className="flex flex-wrap gap-2" aria-label="Lab actions">
              <Button variant="outline" asChild className="h-10 px-3 text-sm">
                <Link to="/developer-labs/player-generation">
                  Player generation lab
                </Link>
              </Button>
              <Button
                variant="outline"
                className="h-10 px-3 text-sm"
                onClick={handleExport}
                disabled={!result || !fixture}
              >
                Export run
              </Button>
              <Button
                variant="outline"
                className="h-10 px-3 text-sm"
                onClick={handleBatchExport}
                disabled={!batchReport}
              >
                Export batch
              </Button>
              <Button variant="outline" asChild className="h-10 px-3 text-sm">
                <Link to="/developer-labs">All labs</Link>
              </Button>
            </nav>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
            <span className="font-semibold tracking-[0.12em] text-foreground uppercase">
              Workflow
            </span>
            <span className="rounded-md border border-border bg-muted px-2 py-1">
              1. Set fixture
            </span>
            <span aria-hidden="true">→</span>
            <span className="rounded-md border border-border bg-muted px-2 py-1">
              2. Run game
            </span>
            <span aria-hidden="true">→</span>
            <span className="rounded-md border border-border bg-muted px-2 py-1">
              3. Reconcile evidence
            </span>
          </div>
        </header>

        <div className="grid items-start gap-6 xl:grid-cols-[336px_minmax(0,1fr)]">
          <aside className="grid gap-4 xl:sticky xl:top-4">
            <Card className="gap-0 overflow-hidden py-0 ring-border">
              <CardHeader className="border-b border-border bg-muted/20 px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      Fixture &amp; run
                    </CardTitle>
                    <CardDescription className="mt-1 text-sm">
                      Every result is tied to the visible seed and settings.
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      fixture && isDirty
                        ? "bg-foreground text-background"
                        : "text-muted-foreground"
                    }
                  >
                    {fixture
                      ? isDirty
                        ? "Settings changed"
                        : "Run current"
                      : "Ready to run"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 px-5 py-5">
                <div className="grid gap-1.5">
                  <Label htmlFor="game-seed">Seed</Label>
                  <Input
                    id="game-seed"
                    className="h-9 px-3 text-sm md:text-sm"
                    value={seed}
                    onChange={(event) => {
                      setSeed(event.target.value)
                      setIsDirty(true)
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button className="h-10 text-sm" onClick={createFixture}>
                    Create fixture
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 text-sm"
                    onClick={handleReset}
                  >
                    Standard
                  </Button>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Button
                    variant="outline"
                    className="h-10 text-sm"
                    onClick={() => importInputRef.current?.click()}
                  >
                    Import fixture
                  </Button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="sr-only"
                    onChange={handleImport}
                    aria-label="Import fixture JSON"
                  />
                  <span className="self-center text-[11px] text-muted-foreground">
                    JSON
                  </span>
                </div>
                <div className="grid gap-3 border-t border-border pt-4">
                  <Button
                    className="h-11 text-sm"
                    onClick={handleRun}
                    disabled={Boolean(progress)}
                  >
                    {fixture ? "Run one game" : "Create & run game"}
                  </Button>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <div className="grid gap-1">
                      <Label htmlFor="batch-count" className="sr-only">
                        Batch count
                      </Label>
                      <Input
                        id="batch-count"
                        aria-label="Batch count"
                        className="h-10 px-3 text-sm md:text-sm"
                        type="number"
                        min={1}
                        max={1000}
                        value={batchCount}
                        onChange={(event) => {
                          const nextValue = Number(event.target.value)
                          if (Number.isFinite(nextValue)) {
                            setBatchCount(
                              Math.min(1000, Math.max(1, nextValue))
                            )
                          }
                        }}
                      />
                    </div>
                    {progress ? (
                      <Button
                        variant="outline"
                        className="h-10 text-sm"
                        onClick={cancelBatch}
                      >
                        Cancel
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="h-10 text-sm"
                        onClick={handleBatch}
                        disabled={!fixture}
                      >
                        Run batch
                      </Button>
                    )}
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {progress
                      ? progress
                      : "Run one game for an inspectable result, or retain a batch for distribution checks."}
                  </p>
                </div>
                {error ? (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}
                <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
                  <span className="text-muted-foreground">State</span>
                  <span
                    className={
                      isDirty ? "font-medium" : "text-muted-foreground"
                    }
                  >
                    {isDirty ? "Changed · rerun needed" : "Current"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <SettingsSection
              title="Environment"
              description="Pace, periods, and scoring context."
            >
              <SectionSettings
                section="environment"
                config={config}
                onChange={handleNumericSetting}
              />
            </SettingsSection>

            <SettingsSection
              title="Offense"
              description="Shot profile, creation, and scoring rates."
            >
              <SectionSettings
                section="offense"
                config={config}
                onChange={handleNumericSetting}
              />
            </SettingsSection>

            <SettingsSection
              title="Defense & rotation"
              description="Stops, minutes, and rotation behavior."
            >
              <div className="grid gap-5">
                <SectionSettings
                  section="defense"
                  config={config}
                  onChange={handleNumericSetting}
                />
                <div className="border-t border-border pt-5">
                  <SectionSettings
                    section="rotation"
                    config={config}
                    onChange={handleNumericSetting}
                  />
                </div>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Rules & coaching"
              description="Injuries, overtime, and coaching response."
            >
              <div className="grid gap-3">
                <SelectField
                  id="injury-frequency"
                  label="Injury frequency"
                  value={config.injuries.frequency}
                  options={["off", "rare", "normal", "frequent"].map(
                    (value) => ({
                      value,
                      label: value.charAt(0).toUpperCase() + value.slice(1),
                    })
                  )}
                  onChange={(value) =>
                    updateConfig({
                      ...config,
                      presetId: "custom",
                      injuries: {
                        ...config.injuries,
                        frequency:
                          value as GameSimulationConfig["injuries"]["frequency"],
                      },
                    })
                  }
                />
                <SelectField
                  id="injury-severity"
                  label="Injury severity"
                  value={config.injuries.severity}
                  options={["minor", "mixed"].map((value) => ({
                    value,
                    label: value.charAt(0).toUpperCase() + value.slice(1),
                  }))}
                  onChange={(value) =>
                    updateConfig({
                      ...config,
                      presetId: "custom",
                      injuries: {
                        ...config.injuries,
                        severity:
                          value as GameSimulationConfig["injuries"]["severity"],
                      },
                    })
                  }
                />
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="max-games-out">Max games out</Label>
                    <Input
                      id="max-games-out"
                      type="number"
                      min={0}
                      max={20}
                      value={config.injuries.maxGamesOut}
                      onChange={(event) =>
                        updateConfig(
                          updateGameNumericSetting(
                            config,
                            "injuries.maxGamesOut",
                            Number(event.target.value)
                          )
                        )
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="ot-minutes">OT minutes</Label>
                    <Input
                      id="ot-minutes"
                      type="number"
                      min={1}
                      max={20}
                      value={config.overtime.segmentMinutes}
                      onChange={(event) =>
                        updateConfig({
                          ...config,
                          presetId: "custom",
                          overtime: {
                            ...config.overtime,
                            segmentMinutes: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ot-max-segments">Max overtime segments</Label>
                  <Input
                    id="ot-max-segments"
                    type="number"
                    min={1}
                    max={20}
                    value={config.overtime.maxSegments}
                    onChange={(event) =>
                      updateConfig({
                        ...config,
                        presetId: "custom",
                        overtime: {
                          ...config.overtime,
                          maxSegments: Number(event.target.value),
                        },
                      })
                    }
                  />
                </div>
                <Label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={config.injuries.inGameInjuries}
                    onCheckedChange={(checked) =>
                      updateConfig({
                        ...config,
                        presetId: "custom",
                        injuries: {
                          ...config.injuries,
                          inGameInjuries: checked === true,
                        },
                      })
                    }
                  />
                  Enable in-game injuries
                </Label>
                <Label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={config.overtime.enabled}
                    onCheckedChange={(checked) =>
                      updateConfig({
                        ...config,
                        presetId: "custom",
                        overtime: {
                          ...config.overtime,
                          enabled: checked === true,
                        },
                      })
                    }
                  />
                  Enable overtime
                </Label>
                <div className="border-t border-border pt-4">
                  <SectionSettings
                    section="coaching"
                    config={config}
                    onChange={handleNumericSetting}
                  />
                </div>
              </div>
            </SettingsSection>

            {fixture ? (
              <SettingsSection
                title="Rotation inputs"
                description="Target minutes may adjust for restrictions and overtime."
                open
              >
                <div className="grid gap-4">
                  {[fixture.homeTeamId, fixture.awayTeamId].map((teamId) => (
                    <div key={teamId} className="grid gap-2">
                      <div className="text-xs font-medium">
                        {fixture.teams[teamId].name}
                      </div>
                      {fixture.rotations[teamId].depthOrder.map((playerId) => (
                        <div
                          key={playerId}
                          className="grid grid-cols-[1fr_56px] items-center gap-2 text-xs"
                        >
                          <span className="truncate">
                            {getGameMatchupLabPlayerName(fixture, playerId)}
                          </span>
                          <Input
                            className="h-7 text-right text-xs"
                            type="number"
                            min={0}
                            max={48}
                            value={
                              fixture.rotations[teamId].targetMinutes[playerId]
                            }
                            aria-label={`${getGameMatchupLabPlayerName(fixture, playerId)} target minutes`}
                            onChange={(event) =>
                              updateFixture((current) => ({
                                ...current,
                                rotations: {
                                  ...current.rotations,
                                  [teamId]: {
                                    ...current.rotations[teamId],
                                    targetMinutes: {
                                      ...current.rotations[teamId]
                                        .targetMinutes,
                                      [playerId]: Number(event.target.value),
                                    },
                                  },
                                },
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </SettingsSection>
            ) : null}
          </aside>

          <section className="grid min-w-0 gap-5">
            {!fixture ? (
              <Card className="gap-0 py-0 ring-border">
                <CardHeader className="border-b border-border px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">Game evidence</CardTitle>
                      <CardDescription className="mt-1 text-sm">
                        Create a fixture before tuning or running the matchup.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="font-medium">
                      Fixture required
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-5 py-5 sm:px-6 sm:py-6">
                  <div className="grid min-h-[360px] place-content-center gap-4 rounded-lg border border-dashed border-border bg-muted/30 px-6 text-center">
                    <div className="mx-auto max-w-xl">
                      <h2 className="text-lg font-semibold">
                        Start with a two-team matchup
                      </h2>
                      <p className="mt-2 text-base leading-7 text-pretty text-muted-foreground">
                        Create a deterministic fixture, tune the possession
                        environment, then inspect the final score, box score,
                        and reconciliation checks.
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-medium text-muted-foreground">
                      <span>1 fixture</span>
                      <span>2 teams</span>
                      <span>1,000-game batch max</span>
                    </div>
                    <Button
                      className="mx-auto h-10 px-4 text-sm"
                      onClick={createFixture}
                    >
                      Create standard fixture
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="gap-0 py-0 ring-border">
                  <CardHeader className="border-b border-border bg-muted/20 px-5 py-4 sm:px-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg">Game evidence</CardTitle>
                        <CardDescription className="mt-1 text-sm">
                          Final score, period splits, and outcome status for the
                          visible fixture.
                        </CardDescription>
                      </div>
                      <ResultStatus result={result} />
                    </div>
                  </CardHeader>
                  <CardContent className="px-5 py-5 sm:px-6 sm:py-6">
                    <Scoreboard fixture={fixture} result={result} />
                  </CardContent>
                </Card>
                {result?.status === "completed" ? (
                  <Card className="gap-0 py-0 ring-border">
                    <CardHeader className="border-b border-border bg-muted/20 px-5 py-4 sm:px-6">
                      <CardTitle className="text-lg">Team profiles</CardTitle>
                      <CardDescription className="mt-1 text-sm">
                        Pace, shooting profile, and possession outcomes by team.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-5 py-5 sm:px-6">
                      <TeamSummary fixture={fixture} result={result} />
                    </CardContent>
                  </Card>
                ) : null}
                {result?.status === "completed" ? (
                  <Card className="gap-0 py-0 ring-border">
                    <CardHeader className="border-b border-border bg-muted/20 px-5 py-4 sm:px-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-lg">
                            Player box scores
                          </CardTitle>
                          <CardDescription className="mt-1 text-sm">
                            Opportunities and role diagnostics stay attached to
                            the final line.
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="font-medium">
                          {Object.keys(result.players).length} players
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="px-5 py-5 sm:px-6">
                      <BoxScoreTable fixture={fixture} result={result} />
                    </CardContent>
                  </Card>
                ) : null}
                {result ? (
                  <ReconciliationPanel result={result} />
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
                    Run the fixture to inspect final box scores and
                    reconciliation diagnostics.
                  </div>
                )}
                {result?.events.length ? (
                  <div className="border border-border">
                    <div className="border-b border-border px-3 py-3">
                      <h3 className="text-sm font-medium">Game events</h3>
                    </div>
                    <div className="divide-y divide-border/70">
                      {result.events.map((event) => (
                        <div
                          key={event.id}
                          className="flex flex-wrap justify-between gap-3 px-3 py-2 text-xs"
                        >
                          <span>{event.description}</span>
                          <span className="font-mono text-muted-foreground">
                            {event.gamesRemaining} games out
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {result?.diagnostics.length ? (
                  <div className="border border-border">
                    <div className="border-b border-border px-3 py-3">
                      <h3 className="text-sm font-medium">Diagnostics</h3>
                    </div>
                    <div className="divide-y divide-border/70">
                      {result.diagnostics.map((diagnostic, index) => (
                        <div
                          key={`${diagnostic.code}-${index}`}
                          className="px-3 py-2 text-xs"
                        >
                          <span className="font-medium">{diagnostic.code}</span>
                          <span className="ml-2 text-muted-foreground">
                            {diagnostic.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <BatchPanel report={batchReport} />
                {batchReport?.failures.length ? (
                  <div className="border border-border p-3 text-xs">
                    <div className="font-medium">Retained failed seeds</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {batchReport.failures.map((failure) => (
                        <code
                          key={failure.seed}
                          className="rounded border border-border bg-muted px-1.5 py-1"
                        >
                          {failure.seed}
                        </code>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
