import { createFileRoute, Link } from "@tanstack/react-router"
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
} from "@workspace/sim-v2"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import * as React from "react"

import {
  createDefaultGameMatchupLabFixture,
  getGameMatchupLabPlayerName,
  runGameMatchupLab,
  serializeGameMatchupLabReport,
} from "@/lib/gameMatchupLab"
import { runMatchupBatchInWorker } from "@/lib/gameMatchupWorker"

export const Route = createFileRoute("/developer-labs/game-matchup")({
  component: GameMatchupLabPage,
})

type NumberSection =
  | "environment"
  | "offense"
  | "defense"
  | "rotation"
  | "coaching"

function formatNumber(value: number, decimals = 1): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(decimals)
}

function getNumericSetting(config: GameSimulationConfig, path: string): number {
  const [section, key] = path.split(".")
  const target = (config as unknown as Record<string, Record<string, unknown>>)[section]
  return Number(target[key] ?? 0)
}

function updateNumericSetting(
  config: GameSimulationConfig,
  path: string,
  value: number
): GameSimulationConfig {
  const [section, key] = path.split(".")
  const next = structuredClone(config)
  const target = (next as unknown as Record<string, Record<string, unknown>>)[section]
  target[key] = value
  next.presetId = "custom"
  return next
}

function SettingField({
  config,
  descriptor,
  onChange,
}: {
  config: GameSimulationConfig
  descriptor: (typeof GAME_SETTING_DESCRIPTORS)[number]
  onChange: (path: string, value: number) => void
}) {
  const value = getNumericSetting(config, descriptor.path)
  return (
    <div className="grid gap-2 border-b border-border/70 pb-3 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label htmlFor={`setting-${descriptor.path}`}>{descriptor.label}</Label>
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
          onChange={(event) =>
            onChange(
              descriptor.path,
              Math.min(
                descriptor.max,
                Math.max(descriptor.min, Number(event.target.value))
              )
            )
          }
        />
      </div>
      <input
        id={`slider-${descriptor.path}`}
        type="range"
        min={descriptor.min}
        max={descriptor.max}
        step={descriptor.step}
        value={value}
        aria-label={descriptor.label}
        className="h-1.5 w-full accent-foreground"
        onChange={(event) =>
          onChange(descriptor.path, Number(event.target.value))
        }
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
  onChange: (path: string, value: number) => void
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
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }))
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
    <section className="border-b border-border pb-5" aria-label="Game result">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{fixture.source.kind.replaceAll("-", " ")}</span>
            <span aria-hidden="true">·</span>
            <span>Seed {fixture.seed}</span>
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight">
            {fixture.teams[fixture.homeTeamId].name} vs. {fixture.teams[fixture.awayTeamId].name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Possession model · {result?.periods.length ?? 0} periods · {result?.events.length ?? 0} events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ResultStatus result={result} />
          {result?.winnerTeamId ? (
            <span className="text-xs text-muted-foreground">
              Winner: {fixture.teams[result.winnerTeamId].name}
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-end">
        {scoreboardTeams.map(({ teamId, team, periods }) => (
          <div key={teamId} className="min-w-0">
            <div className="flex items-end justify-between gap-3">
              <span className="truncate text-sm font-medium">
                {fixture.teams[teamId].name}
              </span>
              <span className="font-mono text-4xl font-semibold tabular-nums">
                {team?.points ?? "—"}
              </span>
            </div>
            <div className="mt-2 flex gap-3 border-t border-border pt-2 font-mono text-xs tabular-nums text-muted-foreground">
              {periods.map((points, index) => (
                <span key={`${teamId}-${index}`}>
                  {index + 1}: {points}
                </span>
              ))}
            </div>
          </div>
        ))}
        <span className="hidden text-center text-xs text-muted-foreground md:block">FINAL</span>
      </div>
    </section>
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
          <div key={teamId} className="border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{fixture.teams[teamId].name}</span>
              <span className="font-mono text-sm tabular-nums">
                {team.offensiveEfficiency} ORtg
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Possessions</span>
                <div className="mt-1 font-mono tabular-nums">{team.possessions}</div>
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
                <div className="mt-1 font-mono tabular-nums">{team.turnovers}</div>
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
    <div className="overflow-x-auto border border-border">
      <Table className="min-w-[980px] text-xs">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[210px]">Player</TableHead>
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
              <TableCell className="font-medium">
                <div>{getGameMatchupLabPlayerName(fixture, player.playerId)}</div>
                <div className="text-[11px] text-muted-foreground">
                  {fixture.teams[player.teamId].name} · {player.starter ? "Starter" : "Bench"}
                </div>
              </TableCell>
              <TableCell>
                <div>{player.role.label}</div>
                <div className="text-[11px] text-muted-foreground">
                  {Math.round(player.role.creationShare)} creation / {Math.round(player.role.scoringShare)} scoring
                </div>
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">{formatNumber(player.minutes)}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{player.opportunities}</TableCell>
              <TableCell className="text-right font-mono font-medium tabular-nums">{player.points}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {player.fieldGoalsMade}-{player.fieldGoalsAttempted}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {player.threePointersMade}-{player.threePointersAttempted}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">{player.rebounds}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{player.assists}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{player.turnovers}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{player.steals}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{player.blocks}</TableCell>
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
    <div className="border border-border">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
        <div>
          <h3 className="text-sm font-medium">Reconciliation</h3>
          <p className="text-xs text-muted-foreground">Every check is retained with the run.</p>
        </div>
        <Badge variant={result.reconciliation.passed ? "default" : "destructive"}>
          {result.reconciliation.passed ? "All checks pass" : "Action required"}
        </Badge>
      </div>
      <div className="divide-y divide-border/70">
        {result.reconciliation.checks.map((check) => (
          <div key={check.code} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
            <span className={check.passed ? "text-muted-foreground" : "font-medium text-destructive"}>
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
        Run a repeated batch to compare score, pace, star opportunity, injury, and reconciliation distributions.
      </div>
    )
  }
  return (
    <div className="border border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-3">
        <div>
          <h3 className="text-sm font-medium">Repeated matchup report</h3>
          <p className="text-xs text-muted-foreground">
            {report.completed} completed · {report.failed} retained failures · base seed {report.baseSeed}
          </p>
        </div>
        <Badge variant={report.failed ? "destructive" : "default"}>
          {report.failed ? "Outliers retained" : "Batch clean"}
        </Badge>
      </div>
      <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(report.metrics).slice(0, 8).map(([key, metric]) => (
          <div key={key} className="bg-background p-3">
            <div className="text-xs text-muted-foreground">{key}</div>
            <div className="mt-1 font-mono text-lg tabular-nums">{formatNumber(metric.mean, 2)}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              p10 {formatNumber(metric.p10, 1)} · p90 {formatNumber(metric.p90, 1)}
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
  const [batchReport, setBatchReport] = React.useState<MatchupBatchReport | null>(null)
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
      setError(caught instanceof Error ? caught.message : "Fixture creation failed.")
    }
  }

  function updateConfig(nextConfig: GameSimulationConfig) {
    setConfig(nextConfig)
    setFixture((current) => (current ? { ...current, config: nextConfig } : current))
    setIsDirty(true)
  }

  function handleNumericSetting(path: string, value: number) {
    updateConfig(updateNumericSetting(config, path, value))
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
      setError(caught instanceof Error ? caught.message : "Game simulation failed.")
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
            setProgress(`${nextProgress.label} · ${nextProgress.completed}/${nextProgress.total}`),
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
      setError(caught instanceof Error ? caught.message : "Batch simulation failed.")
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

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    try {
      const payload = JSON.parse(await file.text()) as { fixture?: unknown }
      const parsed = gameMatchupFixtureSchema.safeParse(payload.fixture ?? payload)
      if (!parsed.success) {
        throw new Error(
          `Fixture import failed: ${parsed.error.issues[0]?.message ?? "invalid fixture"}`
        )
      }
      setFixture(parsed.data)
      setConfig(parsed.data.config)
      setSeed(parsed.data.seed)
      setResult(null)
      setBatchReport(null)
      setError(null)
      setIsDirty(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Fixture import failed.")
    }
  }

  function handleReset() {
    const standard = createStandardGameSimulationConfig()
    setConfig(standard)
    setFixture((current) => (current ? { ...current, config: standard } : current))
    setIsDirty(true)
  }

  return (
    <main className="min-h-svh bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1540px] flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Link to="/developer-labs" className="hover:text-foreground">Developer Labs</Link>
              <span aria-hidden="true">/</span>
              <span>Game &amp; Matchup</span>
              <Badge variant="default">Active</Badge>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-balance">Game &amp; Matchup Lab</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Run one deterministic possession-based game, inspect why it happened, then compare the same matchup across a retained batch.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/developer-labs">All labs</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!result || !fixture}>
              Export run
            </Button>
          </div>
        </header>

        <div className="grid items-start gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="grid gap-4 xl:sticky xl:top-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Fixture &amp; run</CardTitle>
                <CardDescription>Every result is tied to the visible seed and effective settings.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="game-seed">Seed</Label>
                  <Input id="game-seed" value={seed} onChange={(event) => { setSeed(event.target.value); setIsDirty(true) }} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={createFixture}>Create fixture</Button>
                  <Button variant="outline" onClick={handleReset}>Standard</Button>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Button variant="outline" onClick={() => importInputRef.current?.click()}>Import fixture</Button>
                  <input ref={importInputRef} type="file" accept="application/json,.json" className="sr-only" onChange={handleImport} aria-label="Import fixture JSON" />
                  <span className="self-center text-[11px] text-muted-foreground">JSON</span>
                </div>
                <div className="grid gap-2 border-t border-border pt-3">
                  <Button onClick={handleRun} disabled={Boolean(progress)}>
                    {fixture ? "Run one game" : "Create & run game"}
                  </Button>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Input
                      aria-label="Batch count"
                      type="number"
                      min={1}
                      max={1000}
                      value={batchCount}
                      onChange={(event) => setBatchCount(Number(event.target.value))}
                    />
                    {progress ? (
                      <Button variant="outline" onClick={cancelBatch}>Cancel</Button>
                    ) : (
                      <Button variant="outline" onClick={handleBatch} disabled={!fixture}>Run batch</Button>
                    )}
                  </div>
                  {progress ? <p className="text-xs text-muted-foreground" role="status">{progress}</p> : null}
                </div>
                {error ? <p className="text-xs leading-5 text-destructive" role="alert">{error}</p> : null}
                <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
                  <span className="text-muted-foreground">State</span>
                  <span className={isDirty ? "font-medium" : "text-muted-foreground"}>{isDirty ? "Changed · rerun needed" : "Current"}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Environment</CardTitle>
                <CardDescription>Standard is calibrated toward NBA-like outcomes.</CardDescription>
              </CardHeader>
              <CardContent><SectionSettings section="environment" config={config} onChange={handleNumericSetting} /></CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Offense</CardTitle></CardHeader>
              <CardContent><SectionSettings section="offense" config={config} onChange={handleNumericSetting} /></CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Defense &amp; rotation</CardTitle></CardHeader>
              <CardContent className="grid gap-5">
                <SectionSettings section="defense" config={config} onChange={handleNumericSetting} />
                <div className="border-t border-border pt-5"><SectionSettings section="rotation" config={config} onChange={handleNumericSetting} /></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Rules &amp; coaching</CardTitle></CardHeader>
              <CardContent className="grid gap-3">
                <SelectField
                  id="injury-frequency"
                  label="Injury frequency"
                  value={config.injuries.frequency}
                  options={["off", "rare", "normal", "frequent"].map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }))}
                  onChange={(value) => updateConfig({ ...config, presetId: "custom", injuries: { ...config.injuries, frequency: value as GameSimulationConfig["injuries"]["frequency"] } })}
                />
                <SelectField
                  id="injury-severity"
                  label="Injury severity"
                  value={config.injuries.severity}
                  options={["minor", "mixed"].map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }))}
                  onChange={(value) => updateConfig({ ...config, presetId: "custom", injuries: { ...config.injuries, severity: value as GameSimulationConfig["injuries"]["severity"] } })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1.5"><Label htmlFor="max-games-out">Max games out</Label><Input id="max-games-out" type="number" min={0} max={20} value={config.injuries.maxGamesOut} onChange={(event) => updateConfig({ ...config, presetId: "custom", injuries: { ...config.injuries, maxGamesOut: Number(event.target.value) } })} /></div>
                  <div className="grid gap-1.5"><Label htmlFor="ot-minutes">OT minutes</Label><Input id="ot-minutes" type="number" min={1} max={20} value={config.overtime.segmentMinutes} onChange={(event) => updateConfig({ ...config, presetId: "custom", overtime: { ...config.overtime, segmentMinutes: Number(event.target.value) } })} /></div>
                </div>
                <div className="grid gap-1.5"><Label htmlFor="ot-max-segments">Max overtime segments</Label><Input id="ot-max-segments" type="number" min={1} max={20} value={config.overtime.maxSegments} onChange={(event) => updateConfig({ ...config, presetId: "custom", overtime: { ...config.overtime, maxSegments: Number(event.target.value) } })} /></div>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={config.injuries.inGameInjuries} onChange={(event) => updateConfig({ ...config, presetId: "custom", injuries: { ...config.injuries, inGameInjuries: event.target.checked } })} /> Enable in-game injuries</label>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={config.overtime.enabled} onChange={(event) => updateConfig({ ...config, presetId: "custom", overtime: { ...config.overtime, enabled: event.target.checked } })} /> Enable overtime</label>
                <div className="border-t border-border pt-4"><SectionSettings section="coaching" config={config} onChange={handleNumericSetting} /></div>
              </CardContent>
            </Card>

            {fixture ? (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Rotation inputs</CardTitle><CardDescription>Target minutes are goals; the engine may adjust for restrictions and overtime.</CardDescription></CardHeader>
                <CardContent className="grid gap-4">
                  {[fixture.homeTeamId, fixture.awayTeamId].map((teamId) => (
                    <div key={teamId} className="grid gap-2">
                      <div className="text-xs font-medium">{fixture.teams[teamId].name}</div>
                      {fixture.rotations[teamId].depthOrder.map((playerId) => (
                        <div key={playerId} className="grid grid-cols-[1fr_56px] items-center gap-2 text-xs">
                          <span className="truncate">{getGameMatchupLabPlayerName(fixture, playerId)}</span>
                          <Input
                            className="h-7 text-right text-xs"
                            type="number"
                            min={0}
                            max={48}
                            value={fixture.rotations[teamId].targetMinutes[playerId]}
                            aria-label={`${getGameMatchupLabPlayerName(fixture, playerId)} target minutes`}
                            onChange={(event) => updateFixture((current) => ({ ...current, rotations: { ...current.rotations, [teamId]: { ...current.rotations[teamId], targetMinutes: { ...current.rotations[teamId].targetMinutes, [playerId]: Number(event.target.value) } } } }))}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </aside>

          <section className="grid min-w-0 gap-5">
            {!fixture ? (
              <Card>
                <CardContent className="grid min-h-[420px] place-items-center p-8 text-center">
                  <div className="max-w-md">
                    <Badge variant="outline">Fixture required</Badge>
                    <h2 className="mt-4 text-xl font-semibold tracking-tight">Start with a two-team matchup</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Create a deterministic 30-team universe fixture, then tune rotations and the basketball environment before running the first game.</p>
                    <Button className="mt-5" onClick={createFixture}>Create standard fixture</Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <Scoreboard fixture={fixture} result={result} />
                {result?.status === "completed" ? <TeamSummary fixture={fixture} result={result} /> : null}
                {result?.status === "completed" ? (
                  <div className="grid gap-3">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div><h2 className="text-base font-semibold">Player box scores</h2><p className="mt-1 text-xs text-muted-foreground">Opportunities and role diagnostics stay attached to the final line.</p></div>
                      <span className="text-xs text-muted-foreground">No play-by-play stored</span>
                    </div>
                    <BoxScoreTable fixture={fixture} result={result} />
                  </div>
                ) : null}
                {result ? <ReconciliationPanel result={result} /> : <div className="border border-dashed border-border p-5 text-sm text-muted-foreground">Run the fixture to inspect final box scores and reconciliation diagnostics.</div>}
                {result?.events.length ? (
                  <div className="border border-border">
                    <div className="border-b border-border px-3 py-3"><h3 className="text-sm font-medium">Game events</h3></div>
                    <div className="divide-y divide-border/70">{result.events.map((event) => <div key={event.id} className="flex flex-wrap justify-between gap-3 px-3 py-2 text-xs"><span>{event.description}</span><span className="font-mono text-muted-foreground">{event.gamesRemaining} games out</span></div>)}</div>
                  </div>
                ) : null}
                {result?.diagnostics.length ? (
                  <div className="border border-border">
                    <div className="border-b border-border px-3 py-3"><h3 className="text-sm font-medium">Diagnostics</h3></div>
                    <div className="divide-y divide-border/70">{result.diagnostics.map((diagnostic, index) => <div key={`${diagnostic.code}-${index}`} className="px-3 py-2 text-xs"><span className="font-medium">{diagnostic.code}</span><span className="ml-2 text-muted-foreground">{diagnostic.message}</span></div>)}</div>
                  </div>
                ) : null}
                <BatchPanel report={batchReport} />
                {batchReport?.failures.length ? (
                  <div className="border border-border p-3 text-xs"><div className="font-medium">Retained failed seeds</div><div className="mt-2 flex flex-wrap gap-2">{batchReport.failures.map((failure) => <code key={failure.seed} className="rounded border border-border bg-muted px-1.5 py-1">{failure.seed}</code>)}</div></div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
