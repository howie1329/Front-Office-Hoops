import { createFileRoute, Link } from "@tanstack/react-router"
import * as React from "react"

import type {
  CareerCohortReport,
  CareerDevelopmentSettings,
  CareerMatchedCohortReport,
  CareerResolvedSettings,
  CareerSkillTrajectory,
  CareerTimeline,
} from "@workspace/domain-v2"
import type {
  CareerCohortRunOptions,
  CareerMatchedCohortRunOptions,
  CareerProgress,
} from "@workspace/calibration"
import { serializeCareerCohortReport } from "@workspace/calibration"
import { getPlayerCurrentAbility } from "@workspace/sim-v2"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  runCareerCohortInWorker,
  runMatchedCareerCohortInWorker,
} from "@/lib/careerCohortWorker"
import {
  CAREER_MATCHED_SETTING_OPTIONS,
  DEFAULT_DEVELOPMENT_COHORT_OPTIONS,
  DEVELOPMENT_COHORT_PRESETS,
  createMatchedVariantSettings,
  getMatchedSettingDescriptor,
  validateDevelopmentCohortOptions,
} from "@/lib/developmentCohortLab"
import type {
  DevelopmentCohortOptions,
  CareerMatchedSettingPath,
  DevelopmentCohortPresetId,
} from "@/lib/developmentCohortLab"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const Route = createFileRoute("/developer-labs/development-cohorts")({
  component: DevelopmentCohortsPage,
})

type RunState = "idle" | "running" | "success" | "error"

type RunBundle = {
  primary: CareerCohortReport
  comparison: CareerCohortReport | null
  matched: CareerMatchedCohortReport | null
}

function createCohortRunOptions(
  options: DevelopmentCohortOptions,
  presetId: DevelopmentCohortPresetId,
  useCurrentSettings: boolean
): CareerCohortRunOptions {
  const preset = DEVELOPMENT_COHORT_PRESETS.find((item) => item.id === presetId)
  const settings = useCurrentSettings
    ? options
    : {
        ...options,
        ...preset?.defaults,
      }
  return {
    seed: `${options.seed}:${presetId}`,
    startingAge: settings.startingAge,
    sampleSize: options.mode === "individual" ? 1 : options.sampleSize,
    runYears: options.runYears,
    season: options.season,
    minutesContext: options.minutesContext,
    coachingContext: options.coachingContext,
    injuryContext: settings.injuryContext,
    developmentContext: settings.developmentContext,
    populationContext: settings.populationContext,
    growthCurve: settings.growthCurve,
    declineCurve: settings.declineCurve,
    settings: structuredClone(options.settings),
    retainTimelines: true,
  }
}

function DevelopmentCohortsPage() {
  const [options, setOptions] = React.useState<DevelopmentCohortOptions>(
    DEFAULT_DEVELOPMENT_COHORT_OPTIONS
  )
  const [bundle, setBundle] = React.useState<RunBundle | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = React.useState<string | null>(
    null
  )
  const [runState, setRunState] = React.useState<RunState>("idle")
  const [runError, setRunError] = React.useState<string | null>(null)
  const [lastRunAt, setLastRunAt] = React.useState<Date | null>(null)
  const [selectedSeason, setSelectedSeason] = React.useState<number | null>(
    null
  )
  const [progress, setProgress] = React.useState<CareerProgress>({
    completed: 0,
    total: DEFAULT_DEVELOPMENT_COHORT_OPTIONS.sampleSize,
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
      const comparisonEnabled = nextOptions.mode === "comparison"
      const runSize =
        nextOptions.mode === "individual" ? 1 : nextOptions.sampleSize
      const total = runSize * (comparisonEnabled ? 2 : 1)
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
          label: cohort === "primary" ? "Running cohort A" : "Running cohort B",
          seed: nextProgress.seed,
        })
      }

      const primaryOptions = createCohortRunOptions(
        nextOptions,
        nextOptions.presetId,
        true
      )

      try {
        let primary: CareerCohortReport
        let comparison: CareerCohortReport | null = null
        let matched: CareerMatchedCohortReport | null = null
        if (comparisonEnabled) {
          const matchedOptions: CareerMatchedCohortRunOptions = {
            ...primaryOptions,
            variantSettings: createMatchedVariantSettings(nextOptions),
            onProgress: (nextProgress) => {
              updateProgress(
                nextProgress.label.startsWith("Baseline")
                  ? "primary"
                  : "comparison",
                nextProgress
              )
            },
          }
          matched = await runMatchedCareerCohortInWorker({
            ...matchedOptions,
            signal: controller.signal,
          })
          primary = matched.baseline
          comparison = matched.variant
        } else {
          primary = await runCareerCohortInWorker({
            ...primaryOptions,
            signal: controller.signal,
            onProgress: (nextProgress) =>
              updateProgress("primary", nextProgress),
          })
        }

        if (controller.signal.aborted) return
        setBundle({ primary, comparison, matched })
        setSelectedPlayerId(primary.playerIndex[0]?.playerId ?? null)
        setSelectedSeason(primary.timelines?.[0]?.snapshots[0]?.season ?? null)
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
      version: 5,
      runId: createRunId(options.seed),
      harnessOptions: options,
      primary: JSON.parse(serializeCareerCohortReport(bundle.primary)),
      comparison: bundle.comparison
        ? JSON.parse(serializeCareerCohortReport(bundle.comparison))
        : null,
      matched: bundle.matched
        ? {
            schema: bundle.matched.schema,
            version: bundle.matched.version,
            settingsDiff: bundle.matched.settingsDiff,
            playerPairs: bundle.matched.playerPairs,
          }
        : null,
      selectedPlayerId,
      selectedTimeline:
        bundle.primary.timelines?.find(
          (timeline) => timeline.playerId === selectedPlayerId
        ) ?? null,
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
  const selectedTimeline =
    bundle?.primary.timelines?.find(
      (timeline) => timeline.playerId === selectedPlayerId
    ) ?? null

  return (
    <main className="min-h-svh bg-background px-4 py-4 text-foreground sm:px-6 lg:px-8 lg:py-6">
      <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-5">
        <header className="grid gap-4 border-b border-border pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
              <Link
                to="/developer-labs"
                className="transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                Developer Labs
              </Link>
              <span aria-hidden="true">/</span>
              <span className="text-foreground">Career cohort explorer</span>
              <Badge variant="outline">Developer only</Badge>
              <Badge variant="secondary">V2 calibration</Badge>
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-[-0.03em]">
                Career cohort explorer
              </h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                Follow a cohort from first season through peak, decline, and
                retirement, then open any player for a season-by-season trace.
              </p>
            </div>
            <p className="max-w-sm text-xs leading-5 text-muted-foreground sm:text-right">
              Evidence-first view for tuning development curves and checking how
              settings move the full distribution.
            </p>
          </div>
        </header>

        <section
          className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
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
            <MetaItem label="Preset" value={getPresetLabel(options.presetId)} />
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
              size="sm"
              onClick={handleRun}
              disabled={runState === "running" || errors.length > 0}
            >
              {runState === "running" ? "Running…" : "Run cohort"}
            </Button>
          </div>
          {runState === "running" ? (
            <Progress
              className="col-span-full"
              value={Math.max(3, progressPercent)}
              aria-label="Cohort run progress"
            />
          ) : null}
        </section>

        {runError ? (
          <Alert variant="destructive">
            <AlertTitle>Run failed.</AlertTitle>
            <AlertDescription>{runError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid items-start gap-5 xl:grid-cols-[13rem_minmax(0,1fr)_17rem]">
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
            aria-label="Cohort evidence canvas"
          >
            {bundle ? (
              <CohortBenchmarkPanel
                primary={bundle.primary}
                comparison={bundle.comparison}
              />
            ) : null}
            {bundle ? (
              <PlayerIndexPanel
                report={bundle.primary}
                selectedPlayerId={selectedPlayerId}
                onSelectPlayer={(playerId) => {
                  setSelectedPlayerId(playerId)
                  const timeline = bundle.primary.timelines?.find(
                    (candidate) => candidate.playerId === playerId
                  )
                  setSelectedSeason(timeline?.snapshots[0]?.season ?? null)
                }}
              />
            ) : null}
            <TracePanel
              timeline={selectedTimeline}
              selectedSeason={selectedSeason}
            />
            {bundle ? (
              <>
                <CareerSettingsPanel
                  settings={bundle.primary.resolvedSettings}
                />
                {bundle.matched ? (
                  <MatchedSettingsPanel matched={bundle.matched} />
                ) : null}
                {bundle.comparison ? (
                  <ComparisonPanel
                    primary={bundle.primary}
                    comparison={bundle.comparison}
                  />
                ) : null}
                <EventLogPanel timeline={selectedTimeline} />
              </>
            ) : (
              <EmptyEvidenceState running={runState === "running"} />
            )}
          </section>

          <InspectorPanel
            timeline={selectedTimeline}
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
  const settings = options.settings ?? {}
  const updateSettings = (next: CareerDevelopmentSettings) =>
    onUpdate({ settings: { ...settings, ...next } })
  const updateGrowthMultipliers = (
    next: NonNullable<CareerDevelopmentSettings["growthMultipliers"]>
  ) =>
    updateSettings({
      growthMultipliers: { ...settings.growthMultipliers, ...next },
    })
  const updateDeclineMultipliers = (
    next: NonNullable<CareerDevelopmentSettings["declineMultipliers"]>
  ) =>
    updateSettings({
      declineMultipliers: { ...settings.declineMultipliers, ...next },
    })

  return (
    <aside
      className="order-2 rounded-lg border border-border bg-card xl:sticky xl:top-5 xl:order-1 xl:max-h-[calc(100svh-2.5rem)] xl:overflow-y-auto"
      aria-label="Run configuration"
    >
      <div className="border-b border-border px-3 py-3">
        <p className="text-sm font-semibold text-foreground">Configuration</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Tune the cohort, then rerun the same worker-backed report.
        </p>
      </div>
      <div className="grid gap-4 p-3">
        <fieldset className="grid gap-3">
          <legend className="text-xs font-semibold text-foreground">
            View
          </legend>
          <ContextSelect
            id="cohort-mode"
            label="Explorer"
            value={options.mode}
            options={[
              ["cohort", "One cohort"],
              ["individual", "Individual trace"],
              ["comparison", "Matched setting"],
            ]}
            onChange={(value) =>
              onUpdate({ mode: value as DevelopmentCohortOptions["mode"] })
            }
          />
          <div className="grid gap-1.5">
            <Label htmlFor="cohort-primary">Primary scenario</Label>
            <Select
              value={options.presetId}
              onValueChange={(value) => {
                const preset = DEVELOPMENT_COHORT_PRESETS.find(
                  (item) => item.id === value
                )
                onUpdate({
                  presetId: value as DevelopmentCohortPresetId,
                  ...preset?.defaults,
                })
              }}
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
          {options.mode === "comparison" ? (
            <div className="grid gap-3 rounded-md border border-dashed border-border bg-muted/20 p-2.5">
              <ContextSelect
                id="cohort-comparison-setting"
                label="Matched variable"
                value={options.comparisonSetting}
                options={CAREER_MATCHED_SETTING_OPTIONS.map((setting) => [
                  setting.path,
                  setting.label,
                ])}
                onChange={(value) => {
                  const path = value as CareerMatchedSettingPath
                  onUpdate({
                    comparisonSetting: path,
                    comparisonValue:
                      getMatchedSettingDescriptor(path).defaultValue,
                  })
                }}
              />
              <SettingsNumberField
                id="cohort-comparison-value"
                label="Variant value"
                value={options.comparisonValue}
                min={getMatchedSettingDescriptor(options.comparisonSetting).min}
                max={getMatchedSettingDescriptor(options.comparisonSetting).max}
                step={
                  getMatchedSettingDescriptor(options.comparisonSetting).step
                }
                onChange={(value) => onUpdate({ comparisonValue: value })}
              />
              <p className="text-[0.6875rem] leading-4 text-muted-foreground">
                Baseline and variant use the same generated players. Only this
                resolved setting changes.
              </p>
            </div>
          ) : null}
        </fieldset>

        <div className="grid gap-3 border-y border-border py-4">
          <p className="text-xs font-semibold text-foreground">Cohort inputs</p>
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
              <Label htmlFor="cohort-starting-age">Starting age</Label>
              <Input
                id="cohort-starting-age"
                type="number"
                min={18}
                max={40}
                value={options.startingAge}
                onChange={(event) =>
                  onUpdate({ startingAge: Number(event.target.value) })
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="cohort-years">Run horizon</Label>
              <Select
                value={String(options.runYears)}
                onValueChange={(value) => onUpdate({ runYears: Number(value) })}
              >
                <SelectTrigger id="cohort-years" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cohort-season">Base season</Label>
              <Input
                id="cohort-season"
                type="number"
                min={0}
                value={options.season ?? 1}
                onChange={(event) =>
                  onUpdate({ season: Number(event.target.value) })
                }
              />
            </div>
          </div>
        </div>

        <fieldset className="grid gap-3">
          <legend className="text-xs font-semibold text-foreground">
            Player context
          </legend>
          <ContextSelect
            id="cohort-minutes"
            label="Minutes opportunity"
            value={options.minutesContext}
            options={[
              ["low", "Low"],
              ["zero", "Zero minutes"],
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
          <ContextSelect
            id="cohort-injury"
            label="Injury context"
            value={options.injuryContext}
            options={[
              ["healthy", "Healthy"],
              ["normal", "Normal"],
              ["injured", "Injured"],
            ]}
            onChange={(value) =>
              onUpdate({
                injuryContext:
                  value as DevelopmentCohortOptions["injuryContext"],
              })
            }
          />
          <ContextSelect
            id="cohort-development"
            label="Development profile"
            value={options.developmentContext}
            options={[
              ["standard", "Standard"],
              ["high-potential", "High potential"],
              ["low-potential", "Low potential"],
              ["high-volatility", "High volatility"],
            ]}
            onChange={(value) =>
              onUpdate({
                developmentContext:
                  value as DevelopmentCohortOptions["developmentContext"],
              })
            }
          />
          <ContextSelect
            id="cohort-population"
            label="Population source"
            value={options.populationContext}
            options={[
              ["draft-class", "Draft class"],
              ["roster", "Roster"],
              ["free-agent", "Free-agent pool"],
              ["veteran", "Veteran pool"],
            ]}
            onChange={(value) =>
              onUpdate({
                populationContext:
                  value as DevelopmentCohortOptions["populationContext"],
              })
            }
          />
          <ContextSelect
            id="cohort-growth-curve"
            label="Growth curve"
            value={options.growthCurve}
            options={[
              ["distribution", "Generated distribution"],
              ["slow", "Slow"],
              ["standard", "Standard"],
              ["fast", "Fast"],
              ["elite", "Elite"],
            ]}
            onChange={(value) =>
              onUpdate({
                growthCurve: value as DevelopmentCohortOptions["growthCurve"],
              })
            }
          />
          <ContextSelect
            id="cohort-decline-curve"
            label="Decline curve"
            value={options.declineCurve}
            options={[
              ["distribution", "Generated distribution"],
              ["durable", "Durable"],
              ["standard", "Standard"],
              ["early", "Early"],
              ["steep", "Steep"],
            ]}
            onChange={(value) =>
              onUpdate({
                declineCurve: value as DevelopmentCohortOptions["declineCurve"],
              })
            }
          />
        </fieldset>

        <details open className="group border-t border-border pt-4">
          <summary className="cursor-pointer list-none text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30 [&::-webkit-details-marker]:hidden">
            <span className="mr-1 text-muted-foreground transition-transform group-open:inline-block group-open:rotate-90">
              ›
            </span>
            Development engine
          </summary>
          <p className="mt-1 text-[0.6875rem] leading-5 text-muted-foreground">
            These controls change the resolved engine rules and are saved with
            the report.
          </p>
          <div className="mt-3 grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <SettingsNumberField
                id="career-growth-rate"
                label="Growth rate"
                value={settings.growthRateScale ?? 1.6}
                min={0.25}
                max={3}
                step={0.05}
                onChange={(value) => updateSettings({ growthRateScale: value })}
              />
              <SettingsNumberField
                id="career-growth-noise"
                label="Growth noise"
                value={settings.growthNoiseScale ?? 1}
                min={0}
                max={3}
                step={0.05}
                onChange={(value) =>
                  updateSettings({ growthNoiseScale: value })
                }
              />
            </div>
            <fieldset className="grid gap-2">
              <legend className="text-[0.6875rem] font-medium text-muted-foreground">
                Growth curve multipliers
              </legend>
              <div className="grid grid-cols-2 gap-2">
                <SettingsNumberField
                  id="career-growth-slow"
                  label="Slow"
                  value={settings.growthMultipliers?.slow ?? 0.6}
                  min={0.1}
                  max={3}
                  step={0.05}
                  onChange={(value) => updateGrowthMultipliers({ slow: value })}
                />
                <SettingsNumberField
                  id="career-growth-standard"
                  label="Standard"
                  value={settings.growthMultipliers?.standard ?? 1}
                  min={0.1}
                  max={3}
                  step={0.05}
                  onChange={(value) =>
                    updateGrowthMultipliers({ standard: value })
                  }
                />
                <SettingsNumberField
                  id="career-growth-fast"
                  label="Fast"
                  value={settings.growthMultipliers?.fast ?? 1.4}
                  min={0.1}
                  max={3}
                  step={0.05}
                  onChange={(value) => updateGrowthMultipliers({ fast: value })}
                />
                <SettingsNumberField
                  id="career-growth-elite"
                  label="Elite"
                  value={settings.growthMultipliers?.elite ?? 1.8}
                  min={0.1}
                  max={3}
                  step={0.05}
                  onChange={(value) =>
                    updateGrowthMultipliers({ elite: value })
                  }
                />
              </div>
            </fieldset>
            <fieldset className="grid gap-2">
              <legend className="text-[0.6875rem] font-medium text-muted-foreground">
                Decline curve multipliers
              </legend>
              <div className="grid grid-cols-2 gap-2">
                <SettingsNumberField
                  id="career-decline-durable"
                  label="Durable"
                  value={settings.declineMultipliers?.durable ?? 0.7}
                  min={0.1}
                  max={3}
                  step={0.05}
                  onChange={(value) =>
                    updateDeclineMultipliers({ durable: value })
                  }
                />
                <SettingsNumberField
                  id="career-decline-standard"
                  label="Standard"
                  value={settings.declineMultipliers?.standard ?? 1}
                  min={0.1}
                  max={3}
                  step={0.05}
                  onChange={(value) =>
                    updateDeclineMultipliers({ standard: value })
                  }
                />
                <SettingsNumberField
                  id="career-decline-early"
                  label="Early"
                  value={settings.declineMultipliers?.early ?? 1.25}
                  min={0.1}
                  max={3}
                  step={0.05}
                  onChange={(value) =>
                    updateDeclineMultipliers({ early: value })
                  }
                />
                <SettingsNumberField
                  id="career-decline-steep"
                  label="Steep"
                  value={settings.declineMultipliers?.steep ?? 1.6}
                  min={0.1}
                  max={3}
                  step={0.05}
                  onChange={(value) =>
                    updateDeclineMultipliers({ steep: value })
                  }
                />
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-2">
              <SettingsNumberField
                id="career-stall-chance"
                label="Stall chance"
                value={settings.stallChance ?? 0.04}
                min={0}
                max={1}
                step={0.01}
                onChange={(value) => updateSettings({ stallChance: value })}
              />
              <SettingsNumberField
                id="career-stall-magnitude"
                label="Stall size"
                value={settings.stallMagnitude ?? 0.15}
                min={0}
                max={1}
                step={0.05}
                onChange={(value) => updateSettings({ stallMagnitude: value })}
              />
              <SettingsNumberField
                id="career-surge-chance"
                label="Surge chance"
                value={settings.surgeChance ?? 0.04}
                min={0}
                max={1}
                step={0.01}
                onChange={(value) => updateSettings({ surgeChance: value })}
              />
              <SettingsNumberField
                id="career-surge-magnitude"
                label="Surge size"
                value={settings.surgeMagnitude ?? 0.15}
                min={0}
                max={1}
                step={0.05}
                onChange={(value) => updateSettings({ surgeMagnitude: value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <SettingsNumberField
                id="career-growth-transition"
                label="Growth transition"
                value={settings.growthTransitionChance ?? 0.01}
                min={0}
                max={1}
                step={0.01}
                onChange={(value) =>
                  updateSettings({ growthTransitionChance: value })
                }
              />
              <SettingsNumberField
                id="career-decline-transition"
                label="Decline transition"
                value={settings.declineTransitionChance ?? 0.01}
                min={0}
                max={1}
                step={0.01}
                onChange={(value) =>
                  updateSettings({ declineTransitionChance: value })
                }
              />
            </div>
            <ContextSelect
              id="career-timing-preset"
              label="Timing preset"
              value={settings.timingPreset ?? "standard"}
              options={[
                ["standard", "Standard timing"],
                ["early", "Earlier peak and decline"],
                ["late", "Later peak and decline"],
              ]}
              onChange={(value) =>
                updateSettings({
                  timingPreset:
                    value as CareerDevelopmentSettings["timingPreset"],
                })
              }
            />
          </div>
        </details>

        <details className="group rounded-md border border-border bg-muted/20 px-2.5 py-2">
          <summary className="cursor-pointer list-none text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
            <span className="mr-1 text-muted-foreground transition-transform group-open:inline-block group-open:rotate-90">
              ›
            </span>
            Advanced context
          </summary>
          <div className="mt-2 grid gap-1.5 border-t border-border pt-2 text-[0.6875rem] leading-5 text-muted-foreground">
            <span>
              Growth and decline tiers are persisted on each generated player.
            </span>
            <span>
              Potential remains a forecast signal, not a guaranteed ceiling.
            </span>
            <span>
              Curve multipliers are recorded in the exported resolved settings.
            </span>
          </div>
        </details>

        {errors.length > 0 ? (
          <Alert variant="destructive">
            <AlertTitle>Configuration error</AlertTitle>
            <AlertDescription>
              <ul className="grid gap-1">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
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
          The cohort index is paginated for large runs. Select any player to
          inspect the detailed timeline and event log.
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

function SettingsNumberField({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-[0.6875rem]">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-8 text-xs tabular-nums"
      />
    </div>
  )
}

function PlayerIndexPanel({
  report,
  selectedPlayerId,
  onSelectPlayer,
}: {
  report: CareerCohortReport
  selectedPlayerId: string | null
  onSelectPlayer: (playerId: string) => void
}) {
  const [query, setQuery] = React.useState("")
  const [page, setPage] = React.useState(0)
  const pageSize = 25
  const filteredPlayers = report.playerIndex.filter((player) => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return true
    return `${player.playerId} ${player.seed} ${player.growthCurve} ${player.declineCurve}`
      .toLowerCase()
      .includes(normalizedQuery)
  })
  const pageCount = Math.max(1, Math.ceil(filteredPlayers.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const visiblePlayers = filteredPlayers.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  )

  React.useEffect(() => {
    setPage(0)
  }, [query])

  return (
    <section
      className="overflow-hidden rounded-lg border border-border bg-card"
      aria-labelledby="player-index-heading"
    >
      <div className="flex flex-col gap-3 border-b border-border px-3 py-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="player-index-heading" className="text-sm font-semibold">
            Cohort players
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {filteredPlayers.length.toLocaleString()} of{" "}
            {report.playerIndex.length.toLocaleString()} players · click a row
            to open its full career trace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            aria-label="Filter cohort players"
            className="h-8 w-48 text-xs"
            placeholder="Filter player or curve"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
            {currentPage + 1}/{pageCount}
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead>Player</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>Peak</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Curves</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiblePlayers.map((player) => (
              <TableRow
                key={player.playerId}
                data-state={
                  player.playerId === selectedPlayerId ? "selected" : undefined
                }
              >
                <TableCell className="p-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto w-full justify-start rounded-none px-2 py-2 text-left text-xs font-medium"
                    onClick={() => onSelectPlayer(player.playerId)}
                    aria-pressed={player.playerId === selectedPlayerId}
                  >
                    {formatIndexPlayerId(player.playerId)}
                  </Button>
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  {player.startingAge}
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  {formatNumber(player.peakAbility)}{" "}
                  <span className="text-muted-foreground">
                    @ {player.realizedPeakAge}
                  </span>
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  {formatNumber(player.finalAbility)}
                </TableCell>
                <TableCell className="text-[0.6875rem] capitalize">
                  {player.growthCurve} / {player.declineCurve}
                </TableCell>
                <TableCell>
                  <Badge variant={player.retired ? "secondary" : "outline"}>
                    {player.retired
                      ? `Retired ${player.retirementAge}`
                      : "Active"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {visiblePlayers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-20 text-center text-xs text-muted-foreground"
                >
                  No players match this filter.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <span className="text-[0.6875rem] text-muted-foreground">
          Paginated index keeps large cohorts inspectable.
        </span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={currentPage === 0}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={currentPage >= pageCount - 1}
            onClick={() =>
              setPage((value) => Math.min(pageCount - 1, value + 1))
            }
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  )
}

function TracePanel({
  timeline,
  selectedSeason,
}: {
  timeline: CareerTimeline | null
  selectedSeason: number | null
}) {
  const firstSnapshot = timeline?.snapshots[0]
  const player = firstSnapshot?.playerAtSeasonStart
  const name = player
    ? formatPlayerName(player, timeline?.seed)
    : "Selected player"

  return (
    <section
      className="overflow-hidden rounded-lg border border-border bg-card"
      aria-labelledby="trace-heading"
    >
      <div className="flex flex-col gap-3 border-b border-border px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">
            Player trajectory
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2
              id="trace-heading"
              className="text-base font-semibold tracking-tight"
            >
              {name}
            </h2>
            {player ? (
              <span className="text-xs text-muted-foreground">
                {formatTracePlayerId(timeline)} ·{" "}
                {player.profile.role.primaryPosition} ·{" "}
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
            {timeline
              ? `${timeline.snapshots.length} observed seasons`
              : "Waiting for run"}
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
                value={formatNumber(
                  timeline.snapshots[0]?.potentialForecast ?? 0
                )}
                detail="At draft"
              />
              <TraceMetric
                label="Plateau"
                value={`${timeline.plateauLength} yrs`}
                detail="Observed phase"
              />
              <TraceMetric
                label="Endpoint"
                value={formatNumber(
                  getPlayerCurrentAbility(timeline.finalPlayer)
                )}
                detail={`Age ${timeline.finalPlayer.age}`}
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
  comparison: CareerCohortReport | null
}) {
  return (
    <section
      className="overflow-hidden rounded-lg border border-border bg-card"
      aria-labelledby="benchmark-heading"
    >
      <div className="flex flex-col gap-2 border-b border-border px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="benchmark-heading" className="text-base font-semibold">
            Cohort trajectory
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {comparison
              ? "Baseline and variant means show how the matched setting moves the distribution."
              : "Average overall ability across the run, with the selected player available in the inspector."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-[0.6875rem] text-muted-foreground">
          <LegendDot
            label={comparison ? "Baseline" : getPresetLabelFromReport(primary)}
            tone="primary"
          />
          {comparison ? <LegendDot label="Variant" tone="muted" /> : null}
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <CohortBenchmarkChart
          primary={primary.summary.skillTrajectories}
          comparison={comparison?.summary.skillTrajectories ?? []}
        />
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 sm:grid-cols-4">
          <TraceMetric
            label="A peak age"
            value={formatNumber(primary.summary.averagePeakAge)}
            detail={`${formatPercent(primary.summary.breakoutRate)} breakout`}
          />
          {comparison ? (
            <TraceMetric
              label="B peak age"
              value={formatNumber(comparison.summary.averagePeakAge)}
              detail={`${formatPercent(comparison.summary.breakoutRate)} breakout`}
            />
          ) : null}
          <TraceMetric
            label="A availability"
            value={formatPercent(primary.summary.availabilityRate)}
            detail={`${formatPercent(primary.summary.retirementRate)} retired`}
          />
          {comparison ? (
            <TraceMetric
              label="B availability"
              value={formatPercent(comparison.summary.availabilityRate)}
              detail={`${formatPercent(comparison.summary.retirementRate)} retired`}
            />
          ) : null}
        </div>
        <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-3">
          {[
            ["Growth", "Skill opportunity compounds before the plateau."],
            [
              "Plateau",
              "Training can still move the player, but the curve has leveled.",
            ],
            [
              "Decline",
              "Availability and decline rules shape the final seasons.",
            ],
          ].map(([phase, description]) => (
            <div key={phase} className="grid gap-0.5">
              <span className="text-xs font-medium">{phase}</span>
              <span className="text-[0.6875rem] leading-4 text-muted-foreground">
                {description}
              </span>
            </div>
          ))}
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
    {
      label: "Mean forecast error",
      primary: primary.summary.potentialForecastError.mean,
      comparison: comparison.summary.potentialForecastError.mean,
      format: formatSigned,
    },
    {
      label: "Within 3 forecast points",
      primary: primary.summary.potentialForecastError.within3Rate,
      comparison: comparison.summary.potentialForecastError.within3Rate,
      format: formatPercent,
    },
    {
      label: "Exceeded forecast",
      primary: primary.summary.potentialForecastError.exceededForecastRate,
      comparison:
        comparison.summary.potentialForecastError.exceededForecastRate,
      format: formatPercent,
    },
    {
      label: "Surge timeline rate",
      primary: primary.summary.growthEvents.surgeRate,
      comparison: comparison.summary.growthEvents.surgeRate,
      format: formatPercent,
    },
    {
      label: "Stall timeline rate",
      primary: primary.summary.growthEvents.stallRate,
      comparison: comparison.summary.growthEvents.stallRate,
      format: formatPercent,
    },
  ]

  return (
    <section
      className="overflow-hidden rounded-lg border border-border bg-card"
      aria-labelledby="comparison-heading"
    >
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
            <TableHead>Baseline</TableHead>
            <TableHead>Variant</TableHead>
            <TableHead>Delta</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label}>
              <TableCell className="font-medium text-muted-foreground">
                {row.label}
              </TableCell>
              <TableCell className="tabular-nums">
                {row.format(row.primary)}
              </TableCell>
              <TableCell className="tabular-nums">
                {row.format(row.comparison)}
              </TableCell>
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

function MatchedSettingsPanel({
  matched,
}: {
  matched: CareerMatchedCohortReport
}) {
  const setting = matched.settingsDiff[0]
  return (
    <section
      className="overflow-hidden rounded-lg border border-border bg-card"
      aria-labelledby="matched-settings-heading"
    >
      <div className="border-b border-border px-3 py-3">
        <p className="text-[0.6875rem] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
          Matched calibration
        </p>
        <h2
          id="matched-settings-heading"
          className="mt-1 text-sm font-semibold"
        >
          One-variable comparison
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Both arms reuse the same generated player fixtures, so the delta can
          be attributed to this setting.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
        <DiagnosticRow label="Setting" value={setting.path} />
        <DiagnosticRow
          label="Baseline"
          value={formatDiagnosticValue(setting.baseline)}
        />
        <DiagnosticRow
          label="Variant"
          value={formatDiagnosticValue(setting.variant)}
        />
        <DiagnosticRow
          label="Matched players"
          value={formatNumber(matched.playerPairs.length)}
        />
      </div>
    </section>
  )
}

function CareerSettingsPanel({
  settings,
}: {
  settings: CareerResolvedSettings
}) {
  return (
    <section
      className="overflow-hidden rounded-lg border border-border bg-card"
      aria-labelledby="career-settings-heading"
    >
      <div className="border-b border-border px-3 py-3">
        <p className="text-[0.6875rem] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
          Resolved engine settings
        </p>
        <h2 id="career-settings-heading" className="mt-1 text-sm font-semibold">
          Reproducibility snapshot
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          These are the values the worker passed into the career engine for this
          report.
        </p>
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
        <div className="grid gap-1.5">
          <DiagnosticRow
            label="Settings version"
            value={String(settings.settingsVersion)}
          />
          <DiagnosticRow
            label="Growth rate scale"
            value={settings.growthRateScale.toFixed(2)}
          />
          <DiagnosticRow
            label="Growth noise scale"
            value={settings.growthNoiseScale.toFixed(2)}
          />
          <DiagnosticRow label="Timing preset" value={settings.timingPreset} />
        </div>
        <div className="grid gap-1.5">
          <DiagnosticRow
            label="Growth curves"
            value={`${settings.growthMultipliers.slow.toFixed(2)} / ${settings.growthMultipliers.standard.toFixed(2)} / ${settings.growthMultipliers.fast.toFixed(2)} / ${settings.growthMultipliers.elite.toFixed(2)}`}
          />
          <DiagnosticRow
            label="Decline curves"
            value={`${settings.declineMultipliers.durable.toFixed(2)} / ${settings.declineMultipliers.standard.toFixed(2)} / ${settings.declineMultipliers.early.toFixed(2)} / ${settings.declineMultipliers.steep.toFixed(2)}`}
          />
          <DiagnosticRow
            label="Stall / surge chance"
            value={`${formatPercent(settings.stallChance)} / ${formatPercent(settings.surgeChance)}`}
          />
          <DiagnosticRow
            label="Transition chance"
            value={`${formatPercent(settings.growthTransitionChance)} / ${formatPercent(settings.declineTransitionChance)}`}
          />
        </div>
      </div>
    </section>
  )
}

function EventLogPanel({ timeline }: { timeline: CareerTimeline | null }) {
  const events = timeline
    ? timeline.snapshots.flatMap((snapshot) =>
        (snapshot.seasonResult.development?.events ?? []).map((event) => ({
          ...event,
          age: snapshot.ageAtSeasonStart,
        }))
      )
    : []

  return (
    <section
      className="overflow-hidden rounded-lg border border-border bg-card"
      aria-labelledby="event-log-heading"
    >
      <div className="flex items-baseline justify-between gap-2 border-b border-border px-3 py-3">
        <div>
          <p className="text-[0.6875rem] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
            Event log
          </p>
          <h2 id="event-log-heading" className="mt-1 text-sm font-semibold">
            Development transitions
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {events.length} events
        </span>
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
                    {event.delta > 0 ? "+" : ""}
                    {formatNumber(event.delta)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-20 text-center text-muted-foreground"
                >
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
  const player = timeline?.snapshots[0]?.playerAtSeasonStart
  const phases = timeline
    ? timeline.snapshots.reduce<Record<string, number>>((counts, snapshot) => {
        counts[snapshot.phase] = (counts[snapshot.phase] ?? 0) + 1
        return counts
      }, {})
    : {}

  return (
    <aside
      className="order-3 grid content-start gap-4 xl:sticky xl:top-5"
      aria-label="Selected player inspector"
    >
      <section
        className="overflow-hidden rounded-lg border border-border bg-card"
        aria-labelledby="inspector-heading"
      >
        <div className="border-b border-border px-3 py-3">
          <h2 id="inspector-heading" className="text-sm font-semibold">
            Selected player
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Click a season to focus the trace and inspect the engine state.
          </p>
        </div>
        {timeline ? (
          <>
            <div className="grid gap-2 border-b border-border px-3 py-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Player ID</span>
                <span className="font-medium tabular-nums">
                  {formatTracePlayerId(timeline)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Position</span>
                <span className="font-medium">
                  {player?.profile.role.primaryPosition ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Focused season</span>
                <span className="font-medium tabular-nums">
                  {focusedSnapshot?.season ?? "—"}
                </span>
              </div>
            </div>
            <div className="max-h-[22rem] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="px-2 text-[0.625rem]">S</TableHead>
                    <TableHead className="px-2 text-[0.625rem]">Age</TableHead>
                    <TableHead className="px-2 text-[0.625rem]">OVR</TableHead>
                    <TableHead className="px-2 text-[0.625rem]">
                      Phase
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeline.snapshots.map((snapshot) => (
                    <TableRow
                      key={snapshot.season}
                      data-state={
                        snapshot.season === selectedSeason
                          ? "selected"
                          : undefined
                      }
                    >
                      <TableCell className="p-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto w-full justify-start rounded-none px-2 py-2 text-left text-xs tabular-nums"
                          onClick={() => onSelectSeason(snapshot.season)}
                          aria-pressed={snapshot.season === selectedSeason}
                        >
                          {snapshot.season}
                        </Button>
                      </TableCell>
                      <TableCell className="px-2 py-2 text-xs tabular-nums">
                        {snapshot.ageAtSeasonStart}
                      </TableCell>
                      <TableCell className="px-2 py-2 text-xs font-medium tabular-nums">
                        {formatNumber(snapshot.currentAbility)}
                      </TableCell>
                      <TableCell className="px-2 py-2 text-[0.625rem] capitalize">
                        {snapshot.phase}
                      </TableCell>
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

      <section
        className="overflow-hidden rounded-lg border border-border bg-card"
        aria-labelledby="phase-heading"
      >
        <div className="border-b border-border px-3 py-3">
          <h2 id="phase-heading" className="text-sm font-semibold">
            Phase duration
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Observed seasons in each phase.
          </p>
        </div>
        <div className="grid gap-2 p-3">
          {(["growth", "plateau", "decline"] as const).map((phase) => (
            <div
              key={phase}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span className="text-muted-foreground capitalize">{phase}</span>
              <span className="font-medium tabular-nums">
                {phases[phase] ?? 0} seasons
              </span>
            </div>
          ))}
          {focusedSnapshot ? (
            <div className="mt-1 grid gap-2 border-t border-border pt-3 text-xs">
              <DiagnosticRow
                label="Games played"
                value={`${focusedSnapshot.seasonResult.availability.gamesPlayed}/${focusedSnapshot.seasonResult.availability.gamesScheduled}`}
              />
              <DiagnosticRow
                label="Availability"
                value={formatPercent(
                  focusedSnapshot.seasonResult.availability.availabilityRate
                )}
              />
              <DiagnosticRow
                label="Potential forecast"
                value={formatNumber(focusedSnapshot.potentialForecast)}
              />
              <DiagnosticRow
                label="Growth curve"
                value={
                  focusedSnapshot.seasonResult.development?.growthCurve ?? "—"
                }
              />
              <DiagnosticRow
                label="Decline curve"
                value={
                  focusedSnapshot.seasonResult.development?.declineCurve ?? "—"
                }
              />
              <DiagnosticRow
                label="Applied growth"
                value={
                  focusedSnapshot.seasonResult.development
                    ? `${focusedSnapshot.seasonResult.development.appliedGrowthMultiplier.toFixed(2)}×`
                    : "—"
                }
              />
              <DiagnosticRow
                label="Applied decline"
                value={
                  focusedSnapshot.seasonResult.development
                    ? `${focusedSnapshot.seasonResult.development.appliedDeclineMultiplier.toFixed(2)}×`
                    : "—"
                }
              />
              <DiagnosticRow
                label="Retirement probability"
                value={formatPercent(
                  focusedSnapshot.seasonResult.retirement.probability
                )}
              />
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
    padding.left + (index / maxIndex) * (width - padding.left - padding.right)
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
              x={
                x(index) - (width - padding.left - padding.right) / maxIndex / 2
              }
              y={padding.top}
              width={(width - padding.left - padding.right) / maxIndex}
              height={height - padding.top - padding.bottom}
              fill="var(--muted)"
              opacity={
                snapshot.phase === "plateau"
                  ? 0.18
                  : snapshot.phase === "decline"
                    ? 0.08
                    : 0.04
              }
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
                <text
                  x={padding.left - 9}
                  y={y(value) + 3}
                  textAnchor="end"
                  fill="var(--muted-foreground)"
                >
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
              <text
                x={x(index)}
                y={height - 17}
                textAnchor="middle"
                fill="var(--muted-foreground)"
              >
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
  const height = 260
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
    padding.left + (index / maxIndex) * (width - padding.left - padding.right)
  const y = (value: number) =>
    padding.top +
    ((maximum - value) / (maximum - minimum)) *
      (height - padding.top - padding.bottom)
  const points = (data: Array<CareerSkillTrajectory>) =>
    data
      .map(
        (trajectory, index) =>
          `${x(index)},${y(trajectory.currentAbility.average)}`
      )
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
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y(value)}
                y2={y(value)}
                stroke="var(--border)"
                strokeDasharray="2 5"
              />
              <text
                x={padding.left - 9}
                y={y(value) + 3}
                textAnchor="end"
                fill="var(--muted-foreground)"
              >
                {Math.round(value)}
              </text>
            </g>
          )
        })}
        <polyline
          points={points(primary)}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <polyline
          points={points(comparison)}
          fill="none"
          stroke="var(--muted-foreground)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {primary.map((trajectory, index) => (
          <text
            key={trajectory.season}
            x={x(index)}
            y={height - 10}
            textAnchor="middle"
            fill="var(--muted-foreground)"
          >
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
      <p className="text-sm font-medium">
        {running ? "Workers are running" : "No report loaded"}
      </p>
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
      <span className="block text-[0.625rem] text-muted-foreground">
        {label}
      </span>
      <span className="block truncate font-medium text-foreground">
        {value}
      </span>
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

function LegendDot({
  label,
  tone,
}: {
  label: string
  tone: "primary" | "muted"
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`size-2 rounded-full ${tone === "primary" ? "bg-primary" : "bg-muted-foreground/60"}`}
        aria-hidden="true"
      />
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
  const variant =
    state === "error"
      ? "destructive"
      : state === "success"
        ? "secondary"
        : "outline"
  return <Badge variant={variant}>{content}</Badge>
}

function getPresetLabel(id: DevelopmentCohortPresetId) {
  return (
    DEVELOPMENT_COHORT_PRESETS.find((preset) => preset.id === id)?.label ?? id
  )
}

function getPresetLabelFromReport(report: CareerCohortReport) {
  const source = report.options.seed.split(":").at(-1)
  return getPresetLabel(
    (source ?? "balanced-rookies") as DevelopmentCohortPresetId
  )
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

function formatDiagnosticValue(value: number | string) {
  return typeof value === "number" ? formatNumber(value) : value
}

function formatSigned(value: number) {
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function formatPlayerName(
  player: CareerTimeline["snapshots"][number]["playerAtSeasonStart"],
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

function formatIndexPlayerId(playerId: string) {
  const index = Number(playerId.split(":").at(-1))
  return `P-${Number.isFinite(index) ? String(index).padStart(4, "0") : "????"}`
}

function formatArchetype(value: string) {
  return value.replaceAll("_", " ")
}
