import { createFileRoute, Link } from "@tanstack/react-router"
import * as React from "react"

import type {
  CareerCohortReport,
  CareerIndividualReport,
  CareerSkillTrajectory,
  CareerTimeline,
} from "@workspace/domain-v2"
import type {
  CareerCohortRunOptions,
  CareerIndividualRunOptions,
  CareerProgress,
} from "@workspace/calibration"
import {
  serializeCareerCohortReport,
} from "@workspace/calibration"

import { runCareerCohortInWorker, runIndividualCareerInWorker } from "@/lib/careerCohortWorker"
import {
  DEFAULT_DEVELOPMENT_COHORT_OPTIONS,
  DEVELOPMENT_COHORT_PRESETS,
  validateDevelopmentCohortOptions,
} from "@/lib/developmentCohortLab"
import type {
  DevelopmentCohortOptions,
  DevelopmentCohortPresetId,
} from "@/lib/developmentCohortLab"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
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

export const Route = createFileRoute("/developer-labs/development-cohorts")({
  component: DevelopmentCohortsPage,
})

type RunState = "idle" | "running" | "success" | "error"

type RunBundle = {
  primary: CareerCohortReport
  comparison: CareerCohortReport
}

const PRESET_CONTEXT: Record<
  DevelopmentCohortPresetId,
  {
    age: number
    developmentContext: CareerCohortRunOptions["developmentContext"]
    injuryContext: CareerCohortRunOptions["injuryContext"]
  }
> = {
  "balanced-rookies": {
    age: 20,
    developmentContext: "standard",
    injuryContext: "normal",
  },
  "high-volatility": {
    age: 20,
    developmentContext: "high-volatility",
    injuryContext: "injured",
  },
  "durable-veterans": {
    age: 28,
    developmentContext: "standard",
    injuryContext: "healthy",
  },
}

function createCohortRunOptions(
  options: DevelopmentCohortOptions,
  presetId: DevelopmentCohortPresetId
): CareerCohortRunOptions {
  const preset = PRESET_CONTEXT[presetId]
  return {
    seed: `${options.seed}:${presetId}`,
    startingAge: preset.age,
    sampleSize: options.sampleSize,
    runYears: options.careerYears,
    minutesContext: options.minutesContext,
    coachingContext: options.coachingContext,
    injuryContext: preset.injuryContext,
    developmentContext: preset.developmentContext,
    retainTimelines: true,
  }
}

function createIndividualRunOptions(
  options: DevelopmentCohortOptions,
  presetId: DevelopmentCohortPresetId
): CareerIndividualRunOptions {
  const preset = PRESET_CONTEXT[presetId]
  return {
    seed: `${options.seed}:${presetId}:player:1`,
    startingAge: preset.age,
    runYears: options.careerYears,
    minutesContext: options.minutesContext,
    coachingContext: options.coachingContext,
    injuryContext: preset.injuryContext,
    developmentContext: preset.developmentContext,
  }
}

function DevelopmentCohortsPage() {
  const [options, setOptions] = React.useState<DevelopmentCohortOptions>(
    DEFAULT_DEVELOPMENT_COHORT_OPTIONS
  )
  const [bundle, setBundle] = React.useState<RunBundle | null>(null)
  const [trace, setTrace] = React.useState<CareerIndividualReport | null>(null)
  const [runState, setRunState] = React.useState<RunState>("idle")
  const [runError, setRunError] = React.useState<string | null>(null)
  const [lastRunAt, setLastRunAt] = React.useState<Date | null>(null)
  const [selectedSeason, setSelectedSeason] = React.useState<number | null>(
    null
  )
  const [progress, setProgress] = React.useState<CareerProgress>({
    completed: 0,
    total: DEFAULT_DEVELOPMENT_COHORT_OPTIONS.sampleSize * 2,
    label: "Preparing career cohort",
    seed: DEFAULT_DEVELOPMENT_COHORT_OPTIONS.seed,
  })
  const abortRef = React.useRef<AbortController | null>(null)
  const errors = validateDevelopmentCohortOptions(options)

  const runHarness = React.useCallback(
    async (nextOptions: DevelopmentCohortOptions) => {
      const nextErrors = validateDevelopmentCohortOptions(nextOptions)
      if (nextErrors.length > 0) {
        setRunState("error")
        setRunError(nextErrors[0] ?? "Run configuration is invalid.")
        return
      }

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const total = nextOptions.sampleSize * 2
      const progressByCohort = { primary: 0, comparison: 0 }

      setRunState("running")
      setRunError(null)
      setProgress({
        completed: 0,
        total,
        label: "Starting workers",
        seed: nextOptions.seed,
      })

      const updateProgress = (
        cohort: keyof typeof progressByCohort,
        nextProgress: CareerProgress
      ) => {
        progressByCohort[cohort] = nextProgress.completed
        if (
          nextProgress.completed % 10 !== 0 &&
          nextProgress.completed !== nextProgress.total
        ) {
          return
        }
        setProgress({
          completed: progressByCohort.primary + progressByCohort.comparison,
          total,
          label:
            cohort === "primary" ? "Running cohort A" : "Running cohort B",
          seed: nextProgress.seed,
        })
      }

      const primaryOptions = createCohortRunOptions(
        nextOptions,
        nextOptions.presetId
      )
      const comparisonOptions = createCohortRunOptions(
        nextOptions,
        nextOptions.comparisonPresetId
      )

      try {
        const [primary, comparison, individual] = await Promise.all([
          runCareerCohortInWorker({
            ...primaryOptions,
            signal: controller.signal,
            onProgress: (nextProgress) =>
              updateProgress("primary", nextProgress),
          }),
          runCareerCohortInWorker({
            ...comparisonOptions,
            signal: controller.signal,
            onProgress: (nextProgress) =>
              updateProgress("comparison", nextProgress),
          }),
          runIndividualCareerInWorker({
            ...createIndividualRunOptions(nextOptions, nextOptions.presetId),
            signal: controller.signal,
          }),
        ])

        if (controller.signal.aborted) return
        setBundle({ primary, comparison })
        setTrace(individual)
        setSelectedSeason(individual.timeline.snapshots[0]?.season ?? null)
        setProgress({
          completed: total,
          total,
          label: "Run complete",
          seed: nextOptions.seed,
        })
        setLastRunAt(new Date())
        setRunState("success")
      } catch (error) {
        if (controller.signal.aborted) return
        setRunState("error")
        setRunError(
          error instanceof Error ? error.message : "The career run failed."
        )
      }
    },
    []
  )

  React.useEffect(() => {
    void runHarness(DEFAULT_DEVELOPMENT_COHORT_OPTIONS)
    return () => abortRef.current?.abort()
  }, [runHarness])

  function updateOptions(next: Partial<DevelopmentCohortOptions>) {
    setOptions((current) => ({ ...current, ...next }))
  }

  function handleRun() {
    void runHarness(options)
  }

  function handleReset() {
    setOptions(DEFAULT_DEVELOPMENT_COHORT_OPTIONS)
    void runHarness(DEFAULT_DEVELOPMENT_COHORT_OPTIONS)
  }

  function handleDownload() {
    if (!bundle) return
    const payload = {
      schema: "foh-career-cohort-harness-bundle",
      version: 1,
      runId: createRunId(options.seed),
      primary: JSON.parse(serializeCareerCohortReport(bundle.primary)),
      comparison: JSON.parse(serializeCareerCohortReport(bundle.comparison)),
      individual: trace,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `foh-career-cohort-harness-${safeFileName(options.seed)}.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const runId = createRunId(options.seed)
  const progressPercent = Math.round(
    (progress.completed / Math.max(1, progress.total)) * 100
  )

  return (
    <main className="min-h-svh bg-background px-3 py-4 text-foreground sm:px-5 lg:px-7 lg:py-6">
      <div className="mx-auto flex w-full max-w-[1640px] flex-col gap-4">
        <header className="flex flex-col gap-4 border-b border-border pb-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Link
                to="/developer-labs"
                className="transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                Developer Labs
              </Link>
              <span aria-hidden="true">/</span>
              <span className="text-foreground">Career cohort harness</span>
              <Badge variant="outline">Developer only</Badge>
              <Badge variant="secondary">V2 calibration</Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
                  Career cohort harness
                </h1>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Inspect one player’s career trace against controlled cohort
                  behavior before longitudinal systems become league behavior.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/developer-labs">All labs</Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={runState === "running"}
                >
                  Reset defaults
                </Button>
              </div>
            </div>
          </div>
        </header>

        <section
          className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center"
          aria-label="Run metadata"
        >
          <div className="flex items-center gap-2">
            <RunStateBadge state={runState} />
            <span className="text-xs text-muted-foreground">
              {runState === "running"
                ? `${progressPercent}% · ${progress.label}`
                : runState === "error"
                  ? "Run needs attention"
                  : "Deterministic worker-backed report"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-xs sm:grid-cols-4">
            <MetaItem label="Run ID" value={runId} />
            <MetaItem label="Seed" value={options.seed || "—"} />
            <MetaItem
              label="Preset"
              value={getPresetLabel(options.presetId)}
            />
            <MetaItem
              label="Generated"
              value={lastRunAt ? formatTime(lastRunAt) : "—"}
            />
          </div>
          <div className="flex gap-2 sm:justify-self-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!bundle || runState === "running"}
            >
              Export JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRun}
              disabled={runState === "running" || errors.length > 0}
            >
              Rerun
            </Button>
          </div>
          {runState === "running" ? (
            <div className="col-span-full h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-[width] duration-200"
                style={{ width: `${Math.max(3, progressPercent)}%` }}
              />
            </div>
          ) : null}
        </section>

        {runError ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive"
          >
            <span className="font-medium">Run failed.</span> {runError}
          </div>
        ) : null}

        <div className="grid items-start gap-4 xl:grid-cols-[15rem_minmax(0,1fr)_18rem]">
          <ConfigurationRail
            options={options}
            errors={errors}
            runState={runState}
            onUpdate={updateOptions}
            onRun={handleRun}
            onReset={handleReset}
          />

          <section
            className="order-1 grid min-w-0 gap-4 xl:order-2"
            aria-label="Career trace evidence"
          >
            <TracePanel
              trace={trace}
              selectedSeason={selectedSeason}
            />
            {bundle ? (
              <>
                <CohortBenchmarkPanel
                  primary={bundle.primary}
                  comparison={bundle.comparison}
                />
                <ComparisonPanel
                  primary={bundle.primary}
                  comparison={bundle.comparison}
                />
                <EventLogPanel timeline={trace?.timeline ?? null} />
              </>
            ) : (
              <EmptyEvidenceState running={runState === "running"} />
            )}
          </section>

          <InspectorPanel
            timeline={trace?.timeline ?? null}
            selectedSeason={selectedSeason}
            onSelectSeason={setSelectedSeason}
          />
        </div>
      </div>
    </main>
  )
}

function ConfigurationRail({
  options,
  errors,
  runState,
  onUpdate,
  onRun,
  onReset,
}: {
  options: DevelopmentCohortOptions
  errors: Array<string>
  runState: RunState
  onUpdate: (next: Partial<DevelopmentCohortOptions>) => void
  onRun: () => void
  onReset: () => void
}) {
  return (
    <aside className="order-2 rounded-lg border border-border bg-card xl:order-1 xl:sticky xl:top-4">
      <div className="border-b border-border px-3 py-3">
        <p className="text-xs font-semibold tracking-[0.04em] text-foreground uppercase">
          Controls
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Inputs are serialized with every run.
        </p>
      </div>
      <div className="grid gap-4 p-3">
        <fieldset className="grid gap-3">
          <legend className="text-xs font-semibold text-foreground">
            Cohort pair
          </legend>
          <div className="grid gap-1.5">
            <Label htmlFor="cohort-primary">Cohort A</Label>
            <Select
              value={options.presetId}
              onValueChange={(value) =>
                onUpdate({ presetId: value as DevelopmentCohortPresetId })
              }
            >
              <SelectTrigger id="cohort-primary" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEVELOPMENT_COHORT_PRESETS.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cohort-comparison">Cohort B</Label>
            <Select
              value={options.comparisonPresetId}
              onValueChange={(value) =>
                onUpdate({
                  comparisonPresetId: value as DevelopmentCohortPresetId,
                })
              }
            >
              <SelectTrigger id="cohort-comparison" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEVELOPMENT_COHORT_PRESETS.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </fieldset>

        <div className="grid gap-3 border-y border-border py-4">
          <div className="grid gap-1.5">
            <Label htmlFor="cohort-seed">Deterministic seed</Label>
            <Input
              id="cohort-seed"
              value={options.seed}
              onChange={(event) => onUpdate({ seed: event.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="cohort-sample-size">Players</Label>
              <Input
                id="cohort-sample-size"
                type="number"
                min={100}
                max={10000}
                step={100}
                value={options.sampleSize}
                onChange={(event) =>
                  onUpdate({ sampleSize: Number(event.target.value) })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cohort-years">Years</Label>
              <Select
                value={String(options.careerYears)}
                onValueChange={(value) =>
                  onUpdate({ careerYears: Number(value) as 3 | 5 | 10 })
                }
              >
                <SelectTrigger id="cohort-years" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <fieldset className="grid gap-3">
          <legend className="text-xs font-semibold text-foreground">
            Context
          </legend>
          <ContextSelect
            id="cohort-minutes"
            label="Minutes opportunity"
            value={options.minutesContext}
            options={[
              ["low", "Low"],
              ["typical", "Typical"],
              ["high", "High"],
            ]}
            onChange={(value) =>
              onUpdate({
                minutesContext:
                  value as DevelopmentCohortOptions["minutesContext"],
              })
            }
          />
          <ContextSelect
            id="cohort-coaching"
            label="Coaching context"
            value={options.coachingContext}
            options={[
              ["weak", "Weak support"],
              ["standard", "Standard support"],
              ["strong", "Strong support"],
            ]}
            onChange={(value) =>
              onUpdate({
                coachingContext:
                  value as DevelopmentCohortOptions["coachingContext"],
              })
            }
          />
        </fieldset>

        <details className="group rounded-md border border-border bg-muted/20 px-2.5 py-2">
          <summary className="cursor-pointer list-none text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
            <span className="mr-1 text-muted-foreground transition-transform group-open:inline-block group-open:rotate-90">
              ›
            </span>
            Advanced context
          </summary>
          <div className="mt-2 grid gap-1.5 border-t border-border pt-2 text-[0.6875rem] leading-5 text-muted-foreground">
            <span>Injury mode follows the selected cohort preset.</span>
            <span>Development profile remains a deterministic fixture.</span>
          </div>
        </details>

        {errors.length > 0 ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-[0.6875rem] leading-5 text-destructive"
          >
            <p className="font-semibold">Configuration error</p>
            <ul className="mt-1 grid gap-1">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-2">
          <Button
            type="button"
            className="w-full"
            onClick={onRun}
            disabled={runState === "running" || errors.length > 0}
          >
            {runState === "running" ? "Running harness…" : "Run harness"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onReset}
            disabled={runState === "running"}
          >
            Reset
          </Button>
        </div>
        <p className="text-[0.6875rem] leading-5 text-muted-foreground">
          Cohort A and B run in dedicated workers. The selected trace uses the
          first deterministic player from Cohort A.
        </p>
      </div>
    </aside>
  )
}

function ContextSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: string
  options: Array<[string, string]>
  onChange: (value: string) => void
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function TracePanel({
  trace,
  selectedSeason,
}: {
  trace: CareerIndividualReport | null
  selectedSeason: number | null
}) {
  const timeline = trace?.timeline ?? null
  const firstSnapshot = timeline?.snapshots[0]
  const player = firstSnapshot?.player
  const name = player
    ? formatPlayerName(player, timeline?.seed)
    : "Selected player"

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card" aria-labelledby="trace-heading">
      <div className="flex flex-col gap-3 border-b border-border px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
            Selected player trace
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2 id="trace-heading" className="text-base font-semibold tracking-tight">
              {name}
            </h2>
            {player ? (
              <span className="text-xs text-muted-foreground">
                {formatTracePlayerId(timeline)} · {player.profile.role.primaryPosition} ·{" "}
                {formatArchetype(player.profile.role.primaryArchetype)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant={timeline?.retired ? "secondary" : "outline"}>
            {timeline?.retired ? "Retired in trace" : "Active at endpoint"}
          </Badge>
          <span className="text-muted-foreground">
            {timeline ? `${timeline.snapshots.length} observed seasons` : "Waiting for run"}
          </span>
        </div>
      </div>
      <div className="p-3 sm:p-4">
        {timeline ? (
          <>
            <CareerTraceChart
              timeline={timeline}
              selectedSeason={selectedSeason}
            />
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 sm:grid-cols-4">
              <TraceMetric
                label="Peak OVR"
                value={formatNumber(timeline.peakAbility)}
                detail={`Age ${timeline.realizedPeakAge}`}
              />
              <TraceMetric
                label="Potential forecast"
                value={formatNumber(timeline.snapshots[0]?.potentialForecast ?? 0)}
                detail="At draft"
              />
              <TraceMetric
                label="Plateau"
                value={`${timeline.plateauLength} yrs`}
                detail="Observed phase"
              />
              <TraceMetric
                label="Endpoint"
                value={formatNumber(timeline.snapshots.at(-1)?.currentAbility ?? 0)}
                detail={`Age ${timeline.snapshots.at(-1)?.age ?? "—"}`}
              />
            </div>
          </>
        ) : (
          <EmptyPanelState label="The trace will appear after the worker completes." />
        )}
      </div>
    </section>
  )
}

function CohortBenchmarkPanel({
  primary,
  comparison,
}: {
  primary: CareerCohortReport
  comparison: CareerCohortReport
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card" aria-labelledby="benchmark-heading">
      <div className="flex flex-col gap-2 border-b border-border px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[0.6875rem] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
            Cohort benchmark
          </p>
          <h2 id="benchmark-heading" className="mt-1 text-sm font-semibold">
            Average overall ability
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            The selected trace is easier to interpret against both cohort means.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-[0.6875rem] text-muted-foreground">
          <LegendDot label={getPresetLabelFromReport(primary)} tone="primary" />
          <LegendDot label={getPresetLabelFromReport(comparison)} tone="muted" />
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <CohortBenchmarkChart
          primary={primary.summary.skillTrajectories}
          comparison={comparison.summary.skillTrajectories}
        />
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 sm:grid-cols-4">
          <TraceMetric
            label="A peak age"
            value={formatNumber(primary.summary.averagePeakAge)}
            detail={`${formatPercent(primary.summary.breakoutRate)} breakout`}
          />
          <TraceMetric
            label="B peak age"
            value={formatNumber(comparison.summary.averagePeakAge)}
            detail={`${formatPercent(comparison.summary.breakoutRate)} breakout`}
          />
          <TraceMetric
            label="A availability"
            value={formatPercent(primary.summary.availabilityRate)}
            detail={`${formatPercent(primary.summary.retirementRate)} retired`}
          />
          <TraceMetric
            label="B availability"
            value={formatPercent(comparison.summary.availabilityRate)}
            detail={`${formatPercent(comparison.summary.retirementRate)} retired`}
          />
        </div>
      </div>
    </section>
  )
}

function ComparisonPanel({
  primary,
  comparison,
}: {
  primary: CareerCohortReport
  comparison: CareerCohortReport
}) {
  const rows = [
    {
      label: "Average peak age",
      primary: primary.summary.averagePeakAge,
      comparison: comparison.summary.averagePeakAge,
      format: formatNumber,
    },
    {
      label: "Growth to peak",
      primary: primary.summary.growthToPeak,
      comparison: comparison.summary.growthToPeak,
      format: formatSigned,
    },
    {
      label: "Decline rate / season",
      primary: primary.summary.declineRate,
      comparison: comparison.summary.declineRate,
      format: formatNumber,
    },
    {
      label: "Breakout rate",
      primary: primary.summary.breakoutRate,
      comparison: comparison.summary.breakoutRate,
      format: formatPercent,
    },
    {
      label: "Bust rate",
      primary: primary.summary.bustRate,
      comparison: comparison.summary.bustRate,
      format: formatPercent,
    },
    {
      label: "Late bloomer rate",
      primary: primary.summary.lateBloomerRate,
      comparison: comparison.summary.lateBloomerRate,
      format: formatPercent,
    },
    {
      label: "Availability",
      primary: primary.summary.availabilityRate,
      comparison: comparison.summary.availabilityRate,
      format: formatPercent,
    },
    {
      label: "Injury-affected seasons",
      primary: primary.summary.injuryAffectedSeasons,
      comparison: comparison.summary.injuryAffectedSeasons,
      format: formatNumber,
    },
    {
      label: "Retirement rate",
      primary: primary.summary.retirementRate,
      comparison: comparison.summary.retirementRate,
      format: formatPercent,
    },
  ]

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card" aria-labelledby="comparison-heading">
      <div className="border-b border-border px-3 py-3">
        <p className="text-[0.6875rem] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
          Cohort comparison
        </p>
        <h2 id="comparison-heading" className="mt-1 text-sm font-semibold">
          Outcome deltas
        </h2>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-[36%]">Metric</TableHead>
            <TableHead>{getPresetLabelFromReport(primary)}</TableHead>
            <TableHead>{getPresetLabelFromReport(comparison)}</TableHead>
            <TableHead>Delta B − A</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label}>
              <TableCell className="font-medium text-muted-foreground">
                {row.label}
              </TableCell>
              <TableCell className="tabular-nums">{row.format(row.primary)}</TableCell>
              <TableCell className="tabular-nums">{row.format(row.comparison)}</TableCell>
              <TableCell className="tabular-nums">
                {row.format(row.comparison - row.primary)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}

function EventLogPanel({ timeline }: { timeline: CareerTimeline | null }) {
  const events = timeline
    ? timeline.snapshots.flatMap((snapshot) =>
        snapshot.events.map((event) => ({ ...event, age: snapshot.age }))
      )
    : []

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card" aria-labelledby="event-log-heading">
      <div className="flex items-baseline justify-between gap-2 border-b border-border px-3 py-3">
        <div>
          <p className="text-[0.6875rem] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
            Event log
          </p>
          <h2 id="event-log-heading" className="mt-1 text-sm font-semibold">
            Development transitions
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">{events.length} events</span>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead>Season</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Impact</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length ? (
              events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="tabular-nums">{event.season}</TableCell>
                  <TableCell className="tabular-nums">{event.age}</TableCell>
                  <TableCell>
                    <div className="grid gap-0.5">
                      <span className="font-medium">{event.summary}</span>
                      <span className="text-[0.6875rem] text-muted-foreground">
                        {event.type} · {event.phase}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {event.delta > 0 ? "+" : ""}{formatNumber(event.delta)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                  No development events recorded for this trace.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function InspectorPanel({
  timeline,
  selectedSeason,
  onSelectSeason,
}: {
  timeline: CareerTimeline | null
  selectedSeason: number | null
  onSelectSeason: (season: number) => void
}) {
  const focusedSnapshot = timeline?.snapshots.find(
    (snapshot) => snapshot.season === selectedSeason
  )
  const player = timeline?.snapshots[0]?.player
  const phases = timeline
    ? timeline.snapshots.reduce<Record<string, number>>((counts, snapshot) => {
        counts[snapshot.phase] = (counts[snapshot.phase] ?? 0) + 1
        return counts
      }, {})
    : {}

  return (
    <aside className="order-3 grid content-start gap-4 xl:sticky xl:top-4">
      <section className="overflow-hidden rounded-lg border border-border bg-card" aria-labelledby="inspector-heading">
        <div className="border-b border-border px-3 py-3">
          <p className="text-[0.6875rem] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
            Player inspector
          </p>
          <h2 id="inspector-heading" className="mt-1 text-sm font-semibold">
            Season-by-season state
          </h2>
        </div>
        {timeline ? (
          <>
            <div className="grid gap-2 border-b border-border px-3 py-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Player ID</span>
                <span className="font-medium tabular-nums">{formatTracePlayerId(timeline)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Position</span>
                <span className="font-medium">{player?.profile.role.primaryPosition ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Focused season</span>
                <span className="font-medium tabular-nums">{focusedSnapshot?.season ?? "—"}</span>
              </div>
            </div>
            <div className="max-h-[22rem] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="px-2 text-[0.625rem]">S</TableHead>
                    <TableHead className="px-2 text-[0.625rem]">Age</TableHead>
                    <TableHead className="px-2 text-[0.625rem]">OVR</TableHead>
                    <TableHead className="px-2 text-[0.625rem]">Phase</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeline.snapshots.map((snapshot) => (
                    <TableRow
                      key={snapshot.season}
                      data-state={snapshot.season === selectedSeason ? "selected" : undefined}
                    >
                      <TableCell className="p-0">
                        <button
                          type="button"
                          className="flex w-full items-center px-2 py-2 text-left text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                          onClick={() => onSelectSeason(snapshot.season)}
                          aria-pressed={snapshot.season === selectedSeason}
                        >
                          {snapshot.season}
                        </button>
                      </TableCell>
                      <TableCell className="px-2 py-2 text-xs tabular-nums">{snapshot.age}</TableCell>
                      <TableCell className="px-2 py-2 text-xs font-medium tabular-nums">{formatNumber(snapshot.currentAbility)}</TableCell>
                      <TableCell className="px-2 py-2 text-[0.625rem] capitalize">{snapshot.phase}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <div className="p-3">
            <EmptyPanelState label="Run the harness to inspect a player." />
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card" aria-labelledby="phase-heading">
        <div className="border-b border-border px-3 py-3">
          <p className="text-[0.6875rem] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
            Development phases
          </p>
          <h2 id="phase-heading" className="mt-1 text-sm font-semibold">
            Observed duration
          </h2>
        </div>
        <div className="grid gap-2 p-3">
          {(["growth", "plateau", "decline"] as const).map((phase) => (
            <div key={phase} className="flex items-center justify-between gap-3 text-xs">
              <span className="capitalize text-muted-foreground">{phase}</span>
              <span className="font-medium tabular-nums">{phases[phase] ?? 0} seasons</span>
            </div>
          ))}
          {focusedSnapshot ? (
            <div className="mt-1 grid gap-2 border-t border-border pt-3 text-xs">
              <DiagnosticRow label="Games played" value={`${focusedSnapshot.availability.gamesPlayed}/${focusedSnapshot.availability.gamesScheduled}`} />
              <DiagnosticRow label="Availability" value={formatPercent(focusedSnapshot.availability.availabilityRate)} />
              <DiagnosticRow label="Potential forecast" value={formatNumber(focusedSnapshot.potentialForecast)} />
              <DiagnosticRow label="Retirement probability" value={formatPercent(focusedSnapshot.retirement.probability)} />
            </div>
          ) : null}
        </div>
      </section>
    </aside>
  )
}

function CareerTraceChart({
  timeline,
  selectedSeason,
}: {
  timeline: CareerTimeline
  selectedSeason: number | null
}) {
  const width = 920
  const height = 320
  const padding = { top: 22, right: 22, bottom: 42, left: 42 }
  const values = timeline.snapshots.flatMap((snapshot) => [
    snapshot.currentAbility,
    snapshot.potentialForecast,
  ])
  const rawMinimum = Math.min(...values)
  const rawMaximum = Math.max(...values)
  const range = Math.max(rawMaximum - rawMinimum, 12)
  const minimum = Math.floor(rawMinimum - Math.max(3, range * 0.12))
  const maximum = Math.ceil(rawMaximum + Math.max(3, range * 0.12))
  const maxIndex = Math.max(timeline.snapshots.length - 1, 1)
  const x = (index: number) =>
    padding.left +
    (index / maxIndex) * (width - padding.left - padding.right)
  const y = (value: number) =>
    padding.top +
    ((maximum - value) / (maximum - minimum)) *
      (height - padding.top - padding.bottom)
  const abilityPoints = timeline.snapshots
    .map((snapshot, index) => `${x(index)},${y(snapshot.currentAbility)}`)
    .join(" ")
  const forecastPoints = timeline.snapshots
    .map((snapshot, index) => `${x(index)},${y(snapshot.potentialForecast)}`)
    .join(" ")

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[0.6875rem] text-muted-foreground">
        <span>Overall ability and potential forecast</span>
        <div className="flex flex-wrap gap-3">
          <ChartLegendLine label="Realized ability" tone="primary" />
          <ChartLegendLine label="Potential forecast" tone="muted" dashed />
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto min-w-[620px] text-[10px]"
          role="img"
          aria-label="Selected player career trace"
        >
          {timeline.snapshots.map((snapshot, index) => (
            <rect
              key={`${snapshot.season}-phase`}
              x={x(index) - (width - padding.left - padding.right) / maxIndex / 2}
              y={padding.top}
              width={(width - padding.left - padding.right) / maxIndex}
              height={height - padding.top - padding.bottom}
              fill="var(--muted)"
              opacity={snapshot.phase === "plateau" ? 0.18 : snapshot.phase === "decline" ? 0.08 : 0.04}
            />
          ))}
          {[0, 1, 2, 3, 4].map((step) => {
            const value = minimum + ((maximum - minimum) / 4) * step
            return (
              <g key={step}>
                <line
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={y(value)}
                  y2={y(value)}
                  stroke="var(--border)"
                  strokeDasharray="2 5"
                />
                <text x={padding.left - 9} y={y(value) + 3} textAnchor="end" fill="var(--muted-foreground)">
                  {Math.round(value)}
                </text>
              </g>
            )
          })}
          <polyline
            points={forecastPoints}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth="1.5"
            strokeDasharray="5 5"
            strokeLinecap="round"
          />
          <polyline
            points={abilityPoints}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {timeline.snapshots.map((snapshot, index) => (
            <g key={snapshot.season}>
              {snapshot.season === selectedSeason ? (
                <line
                  x1={x(index)}
                  x2={x(index)}
                  y1={padding.top}
                  y2={height - padding.bottom}
                  stroke="var(--ring)"
                  strokeWidth="1.5"
                  strokeDasharray="2 3"
                />
              ) : null}
              <circle
                cx={x(index)}
                cy={y(snapshot.currentAbility)}
                r={snapshot.season === selectedSeason ? 4.5 : 2.5}
                fill="var(--card)"
                stroke="var(--primary)"
                strokeWidth={snapshot.season === selectedSeason ? 2 : 1.5}
              />
              <text x={x(index)} y={height - 17} textAnchor="middle" fill="var(--muted-foreground)">
                S{snapshot.season}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}

function CohortBenchmarkChart({
  primary,
  comparison,
}: {
  primary: Array<CareerSkillTrajectory>
  comparison: Array<CareerSkillTrajectory>
}) {
  const width = 920
  const height = 190
  const padding = { top: 14, right: 22, bottom: 30, left: 42 }
  const values = [...primary, ...comparison].map(
    (trajectory) => trajectory.currentAbility.average
  )
  const rawMinimum = Math.min(...values)
  const rawMaximum = Math.max(...values)
  const range = Math.max(rawMaximum - rawMinimum, 12)
  const minimum = Math.floor(rawMinimum - Math.max(3, range * 0.12))
  const maximum = Math.ceil(rawMaximum + Math.max(3, range * 0.12))
  const maxIndex = Math.max(primary.length - 1, 1)
  const x = (index: number) =>
    padding.left +
    (index / maxIndex) * (width - padding.left - padding.right)
  const y = (value: number) =>
    padding.top +
    ((maximum - value) / (maximum - minimum)) *
      (height - padding.top - padding.bottom)
  const points = (data: Array<CareerSkillTrajectory>) =>
    data
      .map((trajectory, index) => `${x(index)},${y(trajectory.currentAbility.average)}`)
      .join(" ")

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto min-w-[620px] text-[10px]"
        role="img"
        aria-label="Average cohort ability benchmark"
      >
        {[0, 1, 2, 3].map((step) => {
          const value = minimum + ((maximum - minimum) / 3) * step
          return (
            <g key={step}>
              <line x1={padding.left} x2={width - padding.right} y1={y(value)} y2={y(value)} stroke="var(--border)" strokeDasharray="2 5" />
              <text x={padding.left - 9} y={y(value) + 3} textAnchor="end" fill="var(--muted-foreground)">
                {Math.round(value)}
              </text>
            </g>
          )
        })}
        <polyline points={points(primary)} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
        <polyline points={points(comparison)} fill="none" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round" />
        {primary.map((trajectory, index) => (
          <text key={trajectory.season} x={x(index)} y={height - 10} textAnchor="middle" fill="var(--muted-foreground)">
            S{trajectory.season}
          </text>
        ))}
      </svg>
    </div>
  )
}

function EmptyEvidenceState({ running }: { running: boolean }) {
  return (
    <section className="rounded-lg border border-dashed border-border bg-muted/10 p-8 text-center">
      <p className="text-sm font-medium">{running ? "Workers are running" : "No report loaded"}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {running
          ? "The trace and cohort evidence will populate as the deterministic run completes."
          : "Run the harness to load cohort evidence."}
      </p>
    </section>
  )
}

function EmptyPanelState({ label }: { label: string }) {
  return <p className="text-xs leading-5 text-muted-foreground">{label}</p>
}

function TraceMetric({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="grid gap-0.5 rounded-md bg-muted/35 px-2.5 py-2">
      <span className="text-[0.625rem] text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
      <span className="text-[0.625rem] text-muted-foreground">{detail}</span>
    </div>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="block text-[0.625rem] text-muted-foreground">{label}</span>
      <span className="block truncate font-medium text-foreground">{value}</span>
    </div>
  )
}

function DiagnosticRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

function LegendDot({ label, tone }: { label: string; tone: "primary" | "muted" }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${tone === "primary" ? "bg-primary" : "bg-muted-foreground/60"}`} aria-hidden="true" />
      {label}
    </span>
  )
}

function ChartLegendLine({
  label,
  tone,
  dashed = false,
}: {
  label: string
  tone: "primary" | "muted"
  dashed?: boolean
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`block w-5 border-t-2 ${tone === "primary" ? "border-primary" : "border-muted-foreground"} ${dashed ? "border-dashed" : ""}`}
        aria-hidden="true"
      />
      {label}
    </span>
  )
}

function RunStateBadge({ state }: { state: RunState }) {
  const content =
    state === "running"
      ? "Running"
      : state === "error"
        ? "Error"
        : state === "success"
          ? "Complete"
          : "Ready"
  const variant = state === "error" ? "destructive" : state === "success" ? "secondary" : "outline"
  return <Badge variant={variant}>{content}</Badge>
}

function getPresetLabel(id: DevelopmentCohortPresetId) {
  return DEVELOPMENT_COHORT_PRESETS.find((preset) => preset.id === id)?.label ?? id
}

function getPresetLabelFromReport(report: CareerCohortReport) {
  const source = report.options.seed.split(":").at(-1)
  return getPresetLabel((source ?? "balanced-rookies") as DevelopmentCohortPresetId)
}

function createRunId(seed: string) {
  const normalized = seed.replace(/[^a-z0-9]/gi, "").toUpperCase()
  return `CH-${(normalized || "RUN").slice(-10)}`
}

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "run"
}

function formatTime(value: Date) {
  return value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(1) : "—"
}

function formatSigned(value: number) {
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function formatPlayerName(
  player: CareerTimeline["snapshots"][number]["player"],
  seed?: string
) {
  const name = [player.identity.firstName, player.identity.lastName]
    .filter(Boolean)
    .join(" ")
  return name || `Fixture ${formatTracePlayerId({ seed })}`
}

function formatTracePlayerId(timeline: { seed?: string } | null) {
  const index = Number(timeline?.seed?.split(":").at(-1))
  return `P-${Number.isFinite(index) ? String(index).padStart(4, "0") : "0001"}`
}

function formatArchetype(value: string) {
  return value.replaceAll("_", " ")
}
