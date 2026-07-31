import { createFileRoute, Link } from "@tanstack/react-router"
import type {
  PlayerSeasonProduction,
  SeasonRunPresetId,
  SeasonRunResult,
  SeasonFixture,
  UniversalPlayerValue,
} from "@workspace/domain-v2"
import type { SeasonBatchReport } from "@workspace/calibration"
import {
  createStandardGameSimulationConfig,
  createStandardSeasonProductionConfig,
  GAME_SETTING_DESCRIPTORS,
  getGameNumericSetting,
  getPlayerCurrentAbility,
  getValueSetting,
  SEASON_RUN_PRESETS,
  updateGameNumericSetting,
  updateValueSetting,
  VALUE_SETTING_DESCRIPTORS,
} from "@workspace/sim-v2"
import type {
  GameNumericSettingPath,
  ValueSettingPath,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
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
  createDefaultProductionValueLabFixture,
  getPopulationLabel,
  getSeasonTeamName,
  serializeProductionValueLabReport,
} from "@/lib/productionValueLab"
import {
  runSeasonBatchInWorker,
  runSeasonInWorker,
} from "@/lib/productionValueWorker"

export const Route = createFileRoute("/developer-labs/production-value")({
  component: ProductionValueLabPage,
})

type PopulationTab = "rostered" | "free-agent" | "draft-prospect"
type NumberSection =
  "environment" | "offense" | "defense" | "rotation" | "coaching" | "injuries"
type PlayerSortKey =
  | "player"
  | "team"
  | "overall"
  | "value"
  | "delta"
  | "production"
  | "confidence"
type PlayerSortState = {
  key: PlayerSortKey
  direction: "asc" | "desc"
}

const POPULATION_TABS: Array<{ id: PopulationTab; label: string }> = [
  { id: "rostered", label: "Current players" },
  { id: "free-agent", label: "Free agents" },
  { id: "draft-prospect", label: "Draft class" },
]

function formatNumber(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "—"
  return Number.isInteger(value) ? String(value) : value.toFixed(decimals)
}

function formatValue(value: number): string {
  return formatNumber(value, 1)
}

function formatPercentage(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—"
  return `${formatNumber((numerator / denominator) * 100)}%`
}

function getPlayerName(fixture: SeasonFixture, playerId: string): string {
  const player = fixture.players[playerId]
  const name = [player.identity.firstName, player.identity.lastName]
    .filter(Boolean)
    .join(" ")
  return name || playerId.split(":").at(-1) || playerId
}

function getPopulationIds(
  fixture: SeasonFixture,
  population: PopulationTab
): Array<string> {
  if (population === "free-agent") return fixture.populations.freeAgents
  if (population === "draft-prospect") return fixture.populations.draftProspects
  return fixture.populations.rostered
}

function getProductionState(
  result: SeasonRunResult | null,
  checkpoint: number,
  playerId: string
): PlayerSeasonProduction | null {
  return (
    result?.checkpoints.find((item) => item.gamesPerTeam === checkpoint)
      ?.playerProduction[playerId] ?? null
  )
}

function getValueState(
  result: SeasonRunResult | null,
  checkpoint: number,
  playerId: string
): UniversalPlayerValue | null {
  return (
    result?.checkpoints.find((item) => item.gamesPerTeam === checkpoint)
      ?.values[playerId] ?? null
  )
}

function SortableHeader({
  label,
  column,
  sort,
  onSort,
  align = "left",
}: {
  label: string
  column: PlayerSortKey
  sort: PlayerSortState
  onSort: (column: PlayerSortKey) => void
  align?: "left" | "right"
}) {
  const active = sort.key === column
  const direction = active ? sort.direction : null
  return (
    <TableHead
      className={align === "right" ? "text-right" : undefined}
      aria-sort={
        active ? (direction === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        className={`inline-flex items-center gap-1 font-semibold hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${align === "right" ? "ml-auto" : ""}`}
        onClick={() => onSort(column)}
      >
        {label}
        <span
          className={`text-[10px] ${active ? "text-foreground" : "text-muted-foreground/60"}`}
          aria-hidden="true"
        >
          {direction === "asc" ? "↑" : direction === "desc" ? "↓" : "↕"}
        </span>
      </button>
    </TableHead>
  )
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}

function DownloadButton({
  fixture,
  result,
}: {
  fixture: SeasonFixture | null
  result: SeasonRunResult | null
}) {
  if (!fixture || !result) return null
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        const blob = new Blob(
          [serializeProductionValueLabReport(fixture, result)],
          {
            type: "application/json",
          }
        )
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement("a")
        anchor.href = url
        anchor.download = `foh-production-value-${fixture.seed}.json`
        anchor.click()
        URL.revokeObjectURL(url)
      }}
    >
      Export report
    </Button>
  )
}

function SettingField({
  config,
  descriptor,
  onChange,
}: {
  config: ReturnType<typeof createStandardSeasonProductionConfig>
  descriptor: (typeof VALUE_SETTING_DESCRIPTORS)[number]
  onChange: (path: ValueSettingPath, value: number) => void
}) {
  const value = getValueSetting(config, descriptor.path)
  return (
    <div className="grid gap-2 border-b border-border/70 pb-3 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label htmlFor={`value-setting-${descriptor.path}`}>
            {descriptor.label}
          </Label>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {descriptor.description}
          </p>
        </div>
        <Input
          id={`value-setting-${descriptor.path}`}
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
        id={`value-slider-${descriptor.path}`}
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

function GameSettingField({
  config,
  descriptor,
  onChange,
}: {
  config: ReturnType<typeof createStandardGameSimulationConfig>
  descriptor: (typeof GAME_SETTING_DESCRIPTORS)[number]
  onChange: (path: GameNumericSettingPath, value: number) => void
}) {
  const value = getGameNumericSetting(config, descriptor.path)
  return (
    <div className="grid gap-2 border-b border-border/70 pb-3 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label htmlFor={`game-setting-${descriptor.path}`}>
            {descriptor.label}
          </Label>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {descriptor.description}
          </p>
        </div>
        <Input
          id={`game-setting-${descriptor.path}`}
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
        id={`game-slider-${descriptor.path}`}
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

function GameSettingsSection({
  section,
  config,
  onChange,
}: {
  section: NumberSection
  config: ReturnType<typeof createStandardGameSimulationConfig>
  onChange: (path: GameNumericSettingPath, value: number) => void
}) {
  const descriptors = GAME_SETTING_DESCRIPTORS.filter((descriptor) =>
    descriptor.path.startsWith(`${section}.`)
  )
  return (
    <div className="grid gap-4">
      {descriptors.map((descriptor) => (
        <GameSettingField
          key={descriptor.path}
          config={config}
          descriptor={descriptor}
          onChange={onChange}
        />
      ))}
    </div>
  )
}

function GameSettingsDisclosure({
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
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-1 py-3 outline-none hover:bg-muted [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm font-semibold">{title}</span>
          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
            {description}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="text-sm text-muted-foreground transition-transform group-open:rotate-180"
        >
          ↓
        </span>
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  )
}

function OptionField({
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l border-border pl-3">
      <dt className="text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold tracking-tight">{value}</dd>
    </div>
  )
}

function ConfidenceBadge({
  value,
}: {
  value: UniversalPlayerValue["confidence"]
}) {
  const label = value.charAt(0).toUpperCase() + value.slice(1)
  return (
    <Badge variant={value === "full" ? "default" : "outline"}>{label}</Badge>
  )
}

function ProductionValueLabPage() {
  const [seed, setSeed] = React.useState("production-value-lab")
  const [runPreset, setRunPreset] = React.useState<SeasonRunPresetId>("smoke")
  const [batchCount, setBatchCount] = React.useState(3)
  const [config, setConfig] = React.useState(() =>
    createStandardSeasonProductionConfig("smoke")
  )
  const [gameConfig, setGameConfig] = React.useState(() =>
    createStandardGameSimulationConfig()
  )
  const [fixture, setFixture] = React.useState<SeasonFixture | null>(() =>
    createDefaultProductionValueLabFixture({
      seed: "production-value-lab",
      runPreset: "smoke",
    })
  )
  const [result, setResult] = React.useState<SeasonRunResult | null>(null)
  const [batchReport, setBatchReport] =
    React.useState<SeasonBatchReport | null>(null)
  const [population, setPopulation] = React.useState<PopulationTab>("rostered")
  const [teamFilter, setTeamFilter] = React.useState("all")
  const [playerSort, setPlayerSort] = React.useState<PlayerSortState>({
    key: "value",
    direction: "desc",
  })
  const [selectedCheckpoint, setSelectedCheckpoint] = React.useState(0)
  const [selectedPlayerId, setSelectedPlayerId] = React.useState<string | null>(
    null
  )
  const [isRunning, setIsRunning] = React.useState(false)
  const [isDirty, setIsDirty] = React.useState(false)
  const [progress, setProgress] = React.useState("Ready for a season run.")
  const [error, setError] = React.useState<string | null>(null)
  const abortController = React.useRef<AbortController | null>(null)

  const checkpoints = result?.checkpoints ?? []
  const activeCheckpoint =
    checkpoints.find(
      (checkpoint) => checkpoint.gamesPerTeam === selectedCheckpoint
    ) ?? checkpoints.at(-1)
  const activeCheckpointGames = activeCheckpoint?.gamesPerTeam ?? 0
  const preseasonCheckpoint = result?.checkpoints.find(
    (checkpoint) => checkpoint.gamesPerTeam === 0
  )

  const visiblePlayerIds = React.useMemo(() => {
    if (!fixture) return []
    return getPopulationIds(fixture, population)
      .filter((playerId) => {
        if (teamFilter === "all" || population !== "rostered") return true
        const player = fixture.players[playerId]
        return (
          player.leagueStatus.kind === "rostered" &&
          player.leagueStatus.teamId === teamFilter
        )
      })
      .sort((left, right) => {
        const leftPlayer = fixture.players[left]
        const rightPlayer = fixture.players[right]
        const leftValue = activeCheckpoint?.values[left]
        const rightValue = activeCheckpoint?.values[right]
        const leftProduction = activeCheckpoint?.playerProduction[left]
        const rightProduction = activeCheckpoint?.playerProduction[right]
        const leftPreseason = preseasonCheckpoint?.values[left]
        const rightPreseason = preseasonCheckpoint?.values[right]
        const leftTeam =
          leftProduction?.teamId ??
          (leftPlayer.leagueStatus.kind === "rostered"
            ? leftPlayer.leagueStatus.teamId
            : null)
        const rightTeam =
          rightProduction?.teamId ??
          (rightPlayer.leagueStatus.kind === "rostered"
            ? rightPlayer.leagueStatus.teamId
            : null)
        const confidenceRank: Record<
          UniversalPlayerValue["confidence"],
          number
        > = {
          provisional: 0,
          early: 1,
          established: 2,
          full: 3,
        }
        const leftSortValue: string | number =
          playerSort.key === "player"
            ? getPlayerName(fixture, left)
            : playerSort.key === "team"
              ? getSeasonTeamName(fixture, leftTeam)
              : playerSort.key === "overall"
                ? getPlayerCurrentAbility(leftPlayer)
                : playerSort.key === "value"
                  ? (leftValue?.rawValue ?? 0)
                  : playerSort.key === "delta"
                    ? (leftValue?.rawValue ?? 0) -
                      (leftPreseason?.rawValue ?? 0)
                    : playerSort.key === "production"
                      ? (leftProduction?.pointsPerGame ?? 0)
                      : confidenceRank[leftValue?.confidence ?? "provisional"]
        const rightSortValue: string | number =
          playerSort.key === "player"
            ? getPlayerName(fixture, right)
            : playerSort.key === "team"
              ? getSeasonTeamName(fixture, rightTeam)
              : playerSort.key === "overall"
                ? getPlayerCurrentAbility(rightPlayer)
                : playerSort.key === "value"
                  ? (rightValue?.rawValue ?? 0)
                  : playerSort.key === "delta"
                    ? (rightValue?.rawValue ?? 0) -
                      (rightPreseason?.rawValue ?? 0)
                    : playerSort.key === "production"
                      ? (rightProduction?.pointsPerGame ?? 0)
                      : confidenceRank[rightValue?.confidence ?? "provisional"]
        const comparison =
          typeof leftSortValue === "string" &&
          typeof rightSortValue === "string"
            ? leftSortValue.localeCompare(rightSortValue)
            : Number(leftSortValue) - Number(rightSortValue)
        return playerSort.direction === "asc" ? comparison : -comparison
      })
  }, [
    activeCheckpoint,
    fixture,
    playerSort,
    population,
    preseasonCheckpoint,
    teamFilter,
  ])

  function handlePlayerSort(column: PlayerSortKey) {
    setPlayerSort((current) =>
      current.key === column
        ? {
            key: column,
            direction: current.direction === "asc" ? "desc" : "asc",
          }
        : { key: column, direction: column === "player" ? "asc" : "desc" }
    )
  }

  React.useEffect(() => {
    if (!selectedPlayerId || !visiblePlayerIds.includes(selectedPlayerId)) {
      setSelectedPlayerId(visiblePlayerIds[0] ?? null)
    }
  }, [selectedPlayerId, visiblePlayerIds])

  const selectedValue =
    fixture && selectedPlayerId && result
      ? getValueState(result, activeCheckpointGames, selectedPlayerId)
      : null
  const selectedProduction =
    fixture && selectedPlayerId && result
      ? getProductionState(result, activeCheckpointGames, selectedPlayerId)
      : null
  const selectedPopulationLabel =
    selectedPlayerId && fixture
      ? getPopulationLabel(fixture, selectedPlayerId) === "Current player"
        ? "current players"
        : getPopulationLabel(fixture, selectedPlayerId) === "Free agent"
          ? "free agents"
          : "draft prospects"
      : "population"

  function updateConfig(next: typeof config) {
    setConfig(next)
    setIsDirty(true)
    setBatchReport(null)
  }

  function updateGameConfig(next: typeof gameConfig) {
    setGameConfig(next)
    setIsDirty(true)
    setBatchReport(null)
  }

  function updatePreset(value: SeasonRunPresetId) {
    const preset = SEASON_RUN_PRESETS.find((item) => item.id === value)
    setRunPreset(value)
    setConfig((current) => ({
      ...current,
      presetId: "custom",
      runPreset: value,
      gamesPerTeam: preset?.gamesPerTeam ?? 82,
    }))
    setIsDirty(true)
    setResult(null)
    setBatchReport(null)
  }

  function generateFixture() {
    const nextFixture = createDefaultProductionValueLabFixture({
      seed: seed.trim() || "production-value-lab",
      runPreset,
      config,
      gameConfig,
    })
    setFixture(nextFixture)
    setResult(null)
    setBatchReport(null)
    setSelectedCheckpoint(0)
    setSelectedPlayerId(null)
    setIsDirty(false)
    setError(null)
    setProgress("Fixture generated. Ready to run.")
  }

  async function runLab() {
    if (isRunning) return
    const nextFixture = createDefaultProductionValueLabFixture({
      seed: seed.trim() || "production-value-lab",
      runPreset,
      config,
      gameConfig,
    })
    const controller = new AbortController()
    abortController.current = controller
    setFixture(nextFixture)
    setResult(null)
    setBatchReport(null)
    setSelectedCheckpoint(0)
    setIsRunning(true)
    setIsDirty(false)
    setError(null)
    setProgress("Starting season worker…")
    try {
      if (runPreset === "batch") {
        const report = await runSeasonBatchInWorker(nextFixture, batchCount, {
          signal: controller.signal,
          onProgress: (nextProgress) =>
            setProgress(
              `Season ${nextProgress.season ?? 1}/${nextProgress.totalSeasons ?? batchCount} · ${nextProgress.gamesCompleted} games`
            ),
        })
        setBatchReport(report)
        const lastReport = report.reports.at(-1)
        if (lastReport) {
          setFixture(lastReport.fixture)
          setResult(lastReport)
          setSelectedCheckpoint(
            lastReport.checkpoints.at(-1)?.gamesPerTeam ?? 0
          )
        }
        setProgress(`${report.completed} season runs completed.`)
      } else {
        const nextResult = await runSeasonInWorker(nextFixture, {
          signal: controller.signal,
          onProgress: (nextProgress) =>
            setProgress(
              `${nextProgress.gamesCompleted} games · ${nextProgress.gamesPerTeam} per team`
            ),
          onCheckpoint: (checkpoint) => {
            setSelectedCheckpoint(checkpoint.gamesPerTeam)
            setProgress(
              `Checkpoint reached · ${checkpoint.gamesPerTeam} games per team`
            )
          },
        })
        setResult(nextResult)
        setSelectedCheckpoint(nextResult.checkpoints.at(-1)?.gamesPerTeam ?? 0)
        setProgress(
          nextResult.status === "completed"
            ? "Season complete. Production and value are current."
            : "Season completed with retained failures."
        )
      }
    } catch (runError) {
      if (runError instanceof DOMException && runError.name === "AbortError") {
        setProgress(
          "Run cancelled. The last completed checkpoint is preserved."
        )
      } else {
        setError(
          runError instanceof Error ? runError.message : "Season run failed."
        )
        setProgress(
          "Run failed. Export the fixture and inspect the retained error."
        )
      }
    } finally {
      abortController.current = null
      setIsRunning(false)
    }
  }

  function resetLab() {
    abortController.current?.abort()
    const nextConfig = createStandardSeasonProductionConfig("smoke")
    const nextGameConfig = createStandardGameSimulationConfig()
    setSeed("production-value-lab")
    setRunPreset("smoke")
    setBatchCount(3)
    setConfig(nextConfig)
    setGameConfig(nextGameConfig)
    setFixture(
      createDefaultProductionValueLabFixture({
        seed: "production-value-lab",
        runPreset: "smoke",
        config: nextConfig,
        gameConfig: nextGameConfig,
      })
    )
    setResult(null)
    setBatchReport(null)
    setPopulation("rostered")
    setTeamFilter("all")
    setSelectedCheckpoint(0)
    setSelectedPlayerId(null)
    setError(null)
    setIsDirty(false)
    setProgress("Standard smoke fixture restored.")
  }

  function cancelRun() {
    abortController.current?.abort()
  }

  const teamOptions = fixture
    ? Object.values(fixture.teams).sort((left, right) =>
        left.name.localeCompare(right.name)
      )
    : []

  return (
    <main className="min-h-svh bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
        <header className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Link to="/developer-labs" className="hover:text-foreground">
                Developer Labs
              </Link>
              <span aria-hidden="true">/</span>
              <span>Production &amp; Value</span>
              <Badge variant="outline">Developer only</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-balance">
              Production &amp; value lab
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Run a complete developer season through the calibrated game
              engine, then inspect how production moves the three-season
              Universal Player Value.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/developer-labs">All labs</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetLab}
              disabled={isRunning}
            >
              Reset defaults
            </Button>
            <DownloadButton fixture={fixture} result={result} />
          </div>
        </header>

        <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/25 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={isRunning ? "default" : "secondary"}>
              {isRunning ? "Running" : "Ready"}
            </Badge>
            <span className="text-muted-foreground">{progress}</span>
          </div>
          <span className="text-muted-foreground">
            {fixture?.teams
              ? `${Object.keys(fixture.teams).length} teams`
              : "No fixture"}{" "}
            · seed {fixture?.seed ?? "—"}
          </span>
        </div>

        {error ? (
          <div
            className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <div className="grid items-start gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="xl:sticky xl:top-4">
            <CardHeader>
              <CardTitle>Run configuration</CardTitle>
              <CardDescription>
                Semantic controls travel with every season fixture and report.
                The default source is a generated Initial Player Universe;
                universe import is not wired into this first slice.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-1.5">
                <Label htmlFor="production-seed">Base seed</Label>
                <Input
                  id="production-seed"
                  value={seed}
                  onChange={(event) => {
                    setSeed(event.target.value)
                    setIsDirty(true)
                  }}
                  disabled={isRunning}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="production-preset">Run preset</Label>
                <Select
                  value={runPreset}
                  onValueChange={(value) =>
                    updatePreset(value as SeasonRunPresetId)
                  }
                >
                  <SelectTrigger id="production-preset">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEASON_RUN_PRESETS.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {preset.label} · {preset.gamesPerTeam}/team
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {runPreset === "batch" ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="batch-count">Batch seasons</Label>
                  <Input
                    id="batch-count"
                    type="number"
                    min={1}
                    max={25}
                    value={batchCount}
                    onChange={(event) =>
                      setBatchCount(
                        Math.min(25, Math.max(1, Number(event.target.value)))
                      )
                    }
                  />
                </div>
              ) : null}
              <label className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={config.injuries.mode === "off"}
                  onChange={(event) => {
                    const mode = event.target.checked ? "off" : "standard"
                    updateConfig({
                      ...config,
                      presetId: "custom",
                      injuries: { mode },
                    })
                    updateGameConfig({
                      ...structuredClone(gameConfig),
                      injuries: {
                        ...gameConfig.injuries,
                        frequency: event.target.checked ? "off" : "rare",
                        inGameInjuries: !event.target.checked,
                      },
                    })
                  }}
                  className="mt-0.5 size-4 accent-foreground"
                />
                <span>
                  <span className="block font-medium">
                    No-injury comparison
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                    Keep game availability stable so production effects can be
                    isolated.
                  </span>
                </span>
              </label>
              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Value settings</p>
                    <p className="text-xs text-muted-foreground">
                      Standard preset · {config.value.horizonSeasons}-season
                      horizon
                    </p>
                  </div>
                  <Badge
                    variant={
                      config.presetId === "custom" ? "default" : "outline"
                    }
                  >
                    {config.presetId === "custom" ? "Custom" : "Standard"}
                  </Badge>
                </div>
                {VALUE_SETTING_DESCRIPTORS.map((descriptor) => (
                  <SettingField
                    key={descriptor.path}
                    config={config}
                    descriptor={descriptor}
                    onChange={(path, value) =>
                      updateConfig(updateValueSetting(config, path, value))
                    }
                  />
                ))}
              </div>
              <GameSettingsDisclosure
                title="Game environment"
                description="The season reuses the game lab's calibrated simulation settings."
              >
                <div className="grid gap-5">
                  <GameSettingsSection
                    section="environment"
                    config={gameConfig}
                    onChange={(path, value) =>
                      updateGameConfig(
                        updateGameNumericSetting(gameConfig, path, value)
                      )
                    }
                  />
                  <GameSettingsDisclosure
                    title="Offense"
                    description="Shot profile, usage, movement, and transition behavior."
                  >
                    <GameSettingsSection
                      section="offense"
                      config={gameConfig}
                      onChange={(path, value) =>
                        updateGameConfig(
                          updateGameNumericSetting(gameConfig, path, value)
                        )
                      }
                    />
                  </GameSettingsDisclosure>
                  <GameSettingsDisclosure
                    title="Defense"
                    description="Pressure, help, switching, turnovers, and fouls."
                  >
                    <GameSettingsSection
                      section="defense"
                      config={gameConfig}
                      onChange={(path, value) =>
                        updateGameConfig(
                          updateGameNumericSetting(gameConfig, path, value)
                        )
                      }
                    />
                  </GameSettingsDisclosure>
                  <GameSettingsDisclosure
                    title="Rotation"
                    description="Starter workload, bench usage, and fatigue response."
                  >
                    <GameSettingsSection
                      section="rotation"
                      config={gameConfig}
                      onChange={(path, value) =>
                        updateGameConfig(
                          updateGameNumericSetting(gameConfig, path, value)
                        )
                      }
                    />
                  </GameSettingsDisclosure>
                  <GameSettingsDisclosure
                    title="Injuries and overtime"
                    description="Availability, injury severity, and overtime behavior."
                  >
                    <div className="grid gap-4">
                      <OptionField
                        id="season-injury-frequency"
                        label="Injury frequency"
                        value={gameConfig.injuries.frequency}
                        options={["off", "rare", "normal", "frequent"].map(
                          (value) => ({
                            value,
                            label:
                              value.charAt(0).toUpperCase() + value.slice(1),
                          })
                        )}
                        onChange={(value) => {
                          const frequency =
                            value as typeof gameConfig.injuries.frequency
                          updateGameConfig({
                            ...structuredClone(gameConfig),
                            injuries: {
                              ...gameConfig.injuries,
                              frequency,
                              inGameInjuries: frequency !== "off",
                            },
                          })
                          updateConfig({
                            ...config,
                            presetId: "custom",
                            injuries: {
                              mode: frequency === "off" ? "off" : "standard",
                            },
                          })
                        }}
                      />
                      <OptionField
                        id="season-injury-severity"
                        label="Injury severity"
                        value={gameConfig.injuries.severity}
                        options={["minor", "mixed"].map((value) => ({
                          value,
                          label: value.charAt(0).toUpperCase() + value.slice(1),
                        }))}
                        onChange={(value) =>
                          updateGameConfig({
                            ...structuredClone(gameConfig),
                            injuries: {
                              ...gameConfig.injuries,
                              severity:
                                value as typeof gameConfig.injuries.severity,
                            },
                          })
                        }
                      />
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={gameConfig.overtime.enabled}
                          onChange={(event) =>
                            updateGameConfig({
                              ...structuredClone(gameConfig),
                              overtime: {
                                ...gameConfig.overtime,
                                enabled: event.target.checked,
                              },
                            })
                          }
                        />
                        Enable overtime
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                          <Label htmlFor="season-ot-minutes">OT minutes</Label>
                          <Input
                            id="season-ot-minutes"
                            type="number"
                            min={1}
                            max={20}
                            value={gameConfig.overtime.segmentMinutes}
                            onChange={(event) =>
                              updateGameConfig({
                                ...structuredClone(gameConfig),
                                overtime: {
                                  ...gameConfig.overtime,
                                  segmentMinutes: Number(event.target.value),
                                },
                              })
                            }
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor="season-ot-segments">
                            Max OT segments
                          </Label>
                          <Input
                            id="season-ot-segments"
                            type="number"
                            min={1}
                            max={20}
                            value={gameConfig.overtime.maxSegments}
                            onChange={(event) =>
                              updateGameConfig({
                                ...structuredClone(gameConfig),
                                overtime: {
                                  ...gameConfig.overtime,
                                  maxSegments: Number(event.target.value),
                                },
                              })
                            }
                          />
                        </div>
                      </div>
                      <GameSettingsSection
                        section="injuries"
                        config={gameConfig}
                        onChange={(path, value) =>
                          updateGameConfig(
                            updateGameNumericSetting(gameConfig, path, value)
                          )
                        }
                      />
                    </div>
                  </GameSettingsDisclosure>
                  <GameSettingsDisclosure
                    title="Coaching"
                    description="How coaching profiles influence pace, shots, and defense."
                  >
                    <GameSettingsSection
                      section="coaching"
                      config={gameConfig}
                      onChange={(path, value) =>
                        updateGameConfig(
                          updateGameNumericSetting(gameConfig, path, value)
                        )
                      }
                    />
                  </GameSettingsDisclosure>
                </div>
              </GameSettingsDisclosure>
              <div className="grid gap-2 border-t border-border pt-4">
                <Button onClick={generateFixture} disabled={isRunning}>
                  Generate fixture
                </Button>
                <Button onClick={runLab} disabled={isRunning}>
                  {isRunning
                    ? "Running season…"
                    : runPreset === "batch"
                      ? "Run season batch"
                      : `Simulate ${config.gamesPerTeam} games/team`}
                </Button>
                {isRunning ? (
                  <Button variant="outline" onClick={cancelRun}>
                    Cancel safely
                  </Button>
                ) : null}
                <p className="text-xs leading-5 text-muted-foreground">
                  {isDirty
                    ? "Settings changed; regenerate or run to refresh evidence."
                    : "Effective settings are embedded in the fixture."}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid min-w-0 gap-5">
            <section
              className="grid gap-3 sm:grid-cols-4"
              aria-label="Season run summary"
            >
              <Card>
                <CardContent className="pt-5">
                  <dl>
                    <Metric
                      label="Checkpoint"
                      value={`${activeCheckpointGames} / ${config.gamesPerTeam}`}
                    />
                  </dl>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <dl>
                    <Metric
                      label="Games played"
                      value={formatNumber(
                        activeCheckpoint?.leagueSummary.gamesCompleted ?? 0,
                        0
                      )}
                    />
                  </dl>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <dl>
                    <Metric
                      label="League points"
                      value={formatNumber(
                        activeCheckpoint?.leagueSummary.pointsPerGame ?? 0
                      )}
                    />
                  </dl>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <dl>
                    <Metric
                      label="Reconciliation"
                      value={`${formatNumber(activeCheckpoint?.leagueSummary.reconciliationPassRate ?? 0)}%`}
                    />
                  </dl>
                </CardContent>
              </Card>
            </section>

            <Card>
              <CardContent className="flex flex-wrap items-center gap-2 pt-5">
                <span className="mr-2 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  Checkpoints
                </span>
                {(checkpoints.length ? checkpoints : [{ gamesPerTeam: 0 }]).map(
                  (checkpoint) => (
                    <Button
                      key={checkpoint.gamesPerTeam}
                      size="sm"
                      variant={
                        activeCheckpointGames === checkpoint.gamesPerTeam
                          ? "default"
                          : "outline"
                      }
                      onClick={() =>
                        setSelectedCheckpoint(checkpoint.gamesPerTeam)
                      }
                      disabled={!checkpoints.length}
                    >
                      {checkpoint.gamesPerTeam === 0
                        ? "Preseason"
                        : `${checkpoint.gamesPerTeam} games/team`}
                    </Button>
                  )
                )}
                {batchReport ? (
                  <Badge variant="outline">
                    {batchReport.completed} batch runs
                  </Badge>
                ) : null}
              </CardContent>
            </Card>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Card className="min-w-0">
                <CardHeader className="gap-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>Player values</CardTitle>
                      <CardDescription>
                        Production updates for current players; free agents and
                        prospects stay projection-based.
                      </CardDescription>
                    </div>
                    <Select
                      value={teamFilter}
                      onValueChange={setTeamFilter}
                      disabled={population !== "rostered"}
                    >
                      <SelectTrigger
                        className="w-full sm:w-44"
                        aria-label="Filter current players by team"
                      >
                        <SelectValue placeholder="All teams" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All teams</SelectItem>
                        {teamOptions.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-1 overflow-x-auto border-b border-border">
                    {POPULATION_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className={`border-b-2 px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${population === tab.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                        onClick={() => {
                          setPopulation(tab.id)
                          setTeamFilter("all")
                        }}
                        aria-pressed={population === tab.id}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <SortableHeader
                            label="Player"
                            column="player"
                            sort={playerSort}
                            onSort={handlePlayerSort}
                          />
                          <SortableHeader
                            label="Team / status"
                            column="team"
                            sort={playerSort}
                            onSort={handlePlayerSort}
                          />
                          <SortableHeader
                            label="Overall"
                            column="overall"
                            sort={playerSort}
                            onSort={handlePlayerSort}
                            align="right"
                          />
                          <SortableHeader
                            label="Value"
                            column="value"
                            sort={playerSort}
                            onSort={handlePlayerSort}
                            align="right"
                          />
                          <SortableHeader
                            label="Delta"
                            column="delta"
                            sort={playerSort}
                            onSort={handlePlayerSort}
                            align="right"
                          />
                          <SortableHeader
                            label="Production"
                            column="production"
                            sort={playerSort}
                            onSort={handlePlayerSort}
                            align="right"
                          />
                          <SortableHeader
                            label="Confidence"
                            column="confidence"
                            sort={playerSort}
                            onSort={handlePlayerSort}
                          />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visiblePlayerIds.slice(0, 120).map((playerId) => {
                          const player = fixture?.players[playerId]
                          const value = activeCheckpoint?.values[playerId]
                          const production =
                            activeCheckpoint?.playerProduction[playerId]
                          const preseason =
                            preseasonCheckpoint?.values[playerId]
                          return (
                            <TableRow
                              key={playerId}
                              data-state={
                                selectedPlayerId === playerId
                                  ? "selected"
                                  : undefined
                              }
                              className="cursor-pointer"
                              onClick={() => setSelectedPlayerId(playerId)}
                            >
                              <TableCell>
                                <button
                                  type="button"
                                  className="text-left font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                  onClick={() => setSelectedPlayerId(playerId)}
                                >
                                  {getPlayerName(fixture!, playerId)}
                                </button>
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  {player?.age ?? "—"} ·{" "}
                                  {player?.profile.role.primaryPosition ?? "—"}
                                </span>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {getPopulationLabel(fixture!, playerId) ===
                                "Current player"
                                  ? getSeasonTeamName(
                                      fixture!,
                                      production?.teamId ??
                                        (player?.leagueStatus.kind ===
                                        "rostered"
                                          ? player.leagueStatus.teamId
                                          : null)
                                    )
                                  : getPopulationLabel(fixture!, playerId)}
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums">
                                {player ? getPlayerCurrentAbility(player) : "—"}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {value ? formatValue(value.rawValue) : "—"}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {value && preseason
                                  ? `${value.rawValue - preseason.rawValue >= 0 ? "+" : ""}${formatValue(value.rawValue - preseason.rawValue)}`
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {production?.gamesPlayed
                                  ? `${formatNumber(production.pointsPerGame)} PPG`
                                  : "Projection"}
                              </TableCell>
                              <TableCell>
                                {value ? (
                                  <ConfidenceBadge value={value.confidence} />
                                ) : (
                                  <Badge variant="outline">No run</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                        {!visiblePlayerIds.length ? (
                          <TableRow>
                            <TableCell
                              colSpan={7}
                              className="py-10 text-center text-sm text-muted-foreground"
                            >
                              No players match this population and filter.
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                  {visiblePlayerIds.length > 120 ? (
                    <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
                      Showing the first 120 by the selected sort. Narrow the
                      team filter to inspect a complete roster.
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              <div className="grid content-start gap-5">
                <Card>
                  <CardHeader>
                    <CardTitle>Selected player</CardTitle>
                    <CardDescription>
                      {selectedPlayerId && fixture
                        ? getPlayerName(fixture, selectedPlayerId)
                        : "Choose a player from the table."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    {selectedValue && selectedProduction ? (
                      <>
                        <div className="flex items-end justify-between border-b border-border pb-4">
                          <div>
                            <p className="text-3xl font-semibold tracking-[-0.04em]">
                              {formatValue(selectedValue.rawValue)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Universal Player Value · rank{" "}
                              {selectedValue.diagnostics.rank} in{" "}
                              {selectedPopulationLabel}
                            </p>
                          </div>
                          <ConfidenceBadge value={selectedValue.confidence} />
                        </div>
                        <dl className="grid grid-cols-2 gap-3 text-sm">
                          <Metric
                            label="Overall"
                            value={formatNumber(
                              getPlayerCurrentAbility(
                                fixture!.players[selectedPlayerId!]
                              ),
                              0
                            )}
                          />
                          <Metric
                            label="Current form"
                            value={formatValue(selectedValue.currentFormSignal)}
                          />
                          <Metric
                            label="Projection"
                            value={formatValue(selectedValue.projectionSignal)}
                          />
                          <Metric
                            label="Games"
                            value={`${selectedProduction.gamesPlayed}/${selectedProduction.gamesScheduled || "—"}`}
                          />
                          <Metric
                            label="Minutes"
                            value={formatNumber(selectedProduction.minutes)}
                          />
                          <Metric
                            label="Usage"
                            value={`${formatNumber(selectedProduction.usageRate)}%`}
                          />
                          <Metric
                            label="Availability"
                            value={`${formatNumber(selectedProduction.availabilityRate)}%`}
                          />
                        </dl>
                        <div className="grid gap-3 border-t border-border pt-4">
                          <div>
                            <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                              Production stats
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Checkpoint totals and rates from the simulated
                              game logs.
                            </p>
                          </div>
                          <dl className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
                            <StatLine
                              label="Points"
                              value={`${formatNumber(selectedProduction.points)} · ${formatNumber(selectedProduction.pointsPerGame)} PPG`}
                            />
                            <StatLine
                              label="Starts"
                              value={formatNumber(selectedProduction.starts, 0)}
                            />
                            <StatLine
                              label="Minutes"
                              value={`${formatNumber(selectedProduction.minutes)} · ${formatNumber(selectedProduction.minutes / Math.max(1, selectedProduction.gamesPlayed))} MPG`}
                            />
                            <StatLine
                              label="Role"
                              value={selectedProduction.role}
                            />
                            <StatLine
                              label="Field goals"
                              value={`${selectedProduction.fieldGoalsMade}/${selectedProduction.fieldGoalsAttempted} · ${formatPercentage(selectedProduction.fieldGoalsMade, selectedProduction.fieldGoalsAttempted)}`}
                            />
                            <StatLine
                              label="Three-pointers"
                              value={`${selectedProduction.threePointersMade}/${selectedProduction.threePointersAttempted} · ${formatPercentage(selectedProduction.threePointersMade, selectedProduction.threePointersAttempted)}`}
                            />
                            <StatLine
                              label="Free throws"
                              value={`${selectedProduction.freeThrowsMade}/${selectedProduction.freeThrowsAttempted} · ${formatPercentage(selectedProduction.freeThrowsMade, selectedProduction.freeThrowsAttempted)}`}
                            />
                            <StatLine
                              label="True shooting"
                              value={`${formatNumber(selectedProduction.trueShootingPercentage)}%`}
                            />
                            <StatLine
                              label="Assists"
                              value={`${formatNumber(selectedProduction.assists)} · ${formatNumber(selectedProduction.assistsPerGame)} APG`}
                            />
                            <StatLine
                              label="Turnovers"
                              value={`${formatNumber(selectedProduction.turnovers)} · ${formatNumber(selectedProduction.turnoversPerGame)} TOV`}
                            />
                            <StatLine
                              label="Rebounds"
                              value={`${formatNumber(selectedProduction.rebounds)} · ${formatNumber(selectedProduction.reboundsPerGame)} RPG`}
                            />
                            <StatLine
                              label="ORB / DRB"
                              value={`${formatNumber(selectedProduction.offensiveRebounds)} / ${formatNumber(selectedProduction.defensiveRebounds)}`}
                            />
                            <StatLine
                              label="Steals"
                              value={formatNumber(selectedProduction.steals, 0)}
                            />
                            <StatLine
                              label="Blocks"
                              value={formatNumber(selectedProduction.blocks, 0)}
                            />
                            <StatLine
                              label="Fouls"
                              value={formatNumber(selectedProduction.fouls, 0)}
                            />
                            <StatLine
                              label="Opportunities"
                              value={formatNumber(
                                selectedProduction.opportunities,
                                0
                              )}
                            />
                          </dl>
                        </div>
                        <div className="grid gap-2 border-t border-border pt-4">
                          <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                            Value breakdown
                          </p>
                          {Object.entries(selectedValue.breakdown).map(
                            ([label, value]) => (
                              <div
                                key={label}
                                className="flex items-center justify-between gap-3 text-xs"
                              >
                                <span className="text-muted-foreground capitalize">
                                  {label.replace(
                                    /[A-Z]/g,
                                    (letter) => ` ${letter.toLowerCase()}`
                                  )}
                                </span>
                                <span className="font-medium">
                                  {formatValue(value)}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm leading-6 text-muted-foreground">
                        Run a season to inspect production, confidence, and the
                        reasons a value changed.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>League environment</CardTitle>
                    <CardDescription>
                      Evidence used to interpret production at this checkpoint.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid grid-cols-2 gap-4 text-sm">
                      <Metric
                        label="Points / team"
                        value={formatNumber(
                          activeCheckpoint?.leagueSummary.pointsPerGame ?? 0
                        )}
                      />
                      <Metric
                        label="Possessions"
                        value={formatNumber(
                          activeCheckpoint?.leagueSummary.possessionsPerTeam ??
                            0
                        )}
                      />
                      <Metric
                        label="Off. efficiency"
                        value={formatNumber(
                          activeCheckpoint?.leagueSummary.offensiveEfficiency ??
                            0
                        )}
                      />
                      <Metric
                        label="3PA rate"
                        value={`${formatNumber(activeCheckpoint?.leagueSummary.threePointAttemptRate ?? 0)}%`}
                      />
                      <Metric
                        label="Rebounds"
                        value={formatNumber(
                          activeCheckpoint?.leagueSummary.reboundsPerTeam ?? 0
                        )}
                      />
                      <Metric
                        label="Injuries"
                        value={formatNumber(
                          activeCheckpoint?.leagueSummary.injuries ?? 0,
                          0
                        )}
                      />
                    </dl>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
