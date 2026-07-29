import { createFileRoute, Link } from "@tanstack/react-router"
import * as React from "react"

import {
  createDevelopmentCohortReport,
  DEFAULT_DEVELOPMENT_COHORT_OPTIONS,
  DEVELOPMENT_COHORT_PRESETS,
  serializeDevelopmentCohortReport,
  validateDevelopmentCohortOptions,
} from "@/lib/developmentCohortLab"
import type {
  DevelopmentCohort,
  DevelopmentCohortOptions,
  DevelopmentCohortPresetId,
  DevelopmentCohortReport,
} from "@/lib/developmentCohortLab"
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

export const Route = createFileRoute("/developer-labs/development-cohorts")({
  component: DevelopmentCohortsPage,
})

function DevelopmentCohortsPage() {
  const [options, setOptions] = React.useState<DevelopmentCohortOptions>(
    DEFAULT_DEVELOPMENT_COHORT_OPTIONS
  )
  const [report, setReport] = React.useState<DevelopmentCohortReport>(() =>
    createDevelopmentCohortReport(DEFAULT_DEVELOPMENT_COHORT_OPTIONS)
  )
  const [isDirty, setIsDirty] = React.useState(false)
  const errors = validateDevelopmentCohortOptions(options)

  function updateOptions(next: Partial<DevelopmentCohortOptions>) {
    setOptions((current) => ({ ...current, ...next }))
    setIsDirty(true)
  }

  function handleRun() {
    if (errors.length > 0) return
    setReport(createDevelopmentCohortReport(options))
    setIsDirty(false)
  }

  function handleReset() {
    setOptions(DEFAULT_DEVELOPMENT_COHORT_OPTIONS)
    setReport(createDevelopmentCohortReport(DEFAULT_DEVELOPMENT_COHORT_OPTIONS))
    setIsDirty(false)
  }

  function handleDownload() {
    const blob = new Blob([serializeDevelopmentCohortReport(report)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `foh-development-cohorts-${report.options.seed || "run"}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const [primaryCohort, comparisonCohort] = report.cohorts

  return (
    <main className="min-h-svh bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Link to="/developer-labs" className="hover:text-foreground">
                Developer Labs
              </Link>
              <span aria-hidden="true">/</span>
              <span>Development Cohorts</span>
              <Badge variant="outline">Developer only</Badge>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-balance">
              Development cohorts
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Compare career-shape assumptions across age, development, health,
              and coaching contexts before they become league behavior.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/developer-labs">All labs</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              Reset defaults
            </Button>
          </div>
        </header>

        <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/25 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Fixture preview</Badge>
            <span className="text-muted-foreground">
              Representative report data for validating the workspace UI.
            </span>
          </div>
          <span className="text-muted-foreground">
            Report v{report.version} · seed {report.options.seed || "—"}
          </span>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="xl:sticky xl:top-4">
            <CardHeader>
              <CardTitle>Run configuration</CardTitle>
              <CardDescription>
                Every input will travel with the eventual cohort report.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <fieldset className="grid gap-3">
                <legend className="text-sm font-medium">Cohorts</legend>
                <div className="grid gap-1.5">
                  <Label htmlFor="cohort-primary">Primary cohort</Label>
                  <Select
                    value={options.presetId}
                    onValueChange={(value) =>
                      updateOptions({
                        presetId: value as DevelopmentCohortPresetId,
                      })
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
                  <Label htmlFor="cohort-comparison">Comparison cohort</Label>
                  <Select
                    value={options.comparisonPresetId}
                    onValueChange={(value) =>
                      updateOptions({
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
                    onChange={(event) =>
                      updateOptions({ seed: event.target.value })
                    }
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
                        updateOptions({
                          sampleSize: Number(event.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="cohort-years">Career length</Label>
                    <Select
                      value={String(options.careerYears)}
                      onValueChange={(value) =>
                        updateOptions({
                          careerYears: Number(value) as 3 | 5 | 10,
                        })
                      }
                    >
                      <SelectTrigger id="cohort-years" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 years</SelectItem>
                        <SelectItem value="5">5 years</SelectItem>
                        <SelectItem value="10">10 years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <fieldset className="grid gap-3">
                <legend className="text-sm font-medium">Context</legend>
                <div className="grid gap-1.5">
                  <Label htmlFor="cohort-minutes">Minutes opportunity</Label>
                  <Select
                    value={options.minutesContext}
                    onValueChange={(value) =>
                      updateOptions({
                        minutesContext:
                          value as DevelopmentCohortOptions["minutesContext"],
                      })
                    }
                  >
                    <SelectTrigger id="cohort-minutes" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="typical">Typical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cohort-coaching">Coaching context</Label>
                  <Select
                    value={options.coachingContext}
                    onValueChange={(value) =>
                      updateOptions({
                        coachingContext:
                          value as DevelopmentCohortOptions["coachingContext"],
                      })
                    }
                  >
                    <SelectTrigger id="cohort-coaching" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weak">Weak support</SelectItem>
                      <SelectItem value="standard">Standard support</SelectItem>
                      <SelectItem value="strong">Strong support</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </fieldset>

              {errors.length > 0 ? (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs leading-5 text-destructive"
                >
                  <p className="font-medium">Run needs attention</p>
                  <ul className="mt-1 grid gap-1">
                    {errors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex gap-2">
                <Button
                  type="button"
                  className="flex-1"
                  onClick={handleRun}
                  disabled={errors.length > 0}
                >
                  Preview cohort run
                </Button>
                <Button type="button" variant="outline" onClick={handleReset}>
                  Reset
                </Button>
              </div>
              <Button type="button" variant="outline" onClick={handleDownload}>
                Download JSON
              </Button>
              <p className="text-xs leading-5 text-muted-foreground">
                {isDirty
                  ? "Controls changed since the displayed fixture."
                  : "Displayed values match the selected fixture report."}
              </p>
            </CardContent>
          </Card>

          <section className="grid min-w-0 gap-5" aria-label="Cohort evidence">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryMetric
                label="Players per cohort"
                value={report.options.sampleSize.toLocaleString()}
                detail={`${report.options.careerYears}-year preview`}
              />
              <SummaryMetric
                label="Average net change"
                value={`${primaryCohort.averageNetChange > 0 ? "+" : ""}${primaryCohort.averageNetChange}`}
                detail={primaryCohort.label}
              />
              <SummaryMetric
                label="Ending availability"
                value={`${primaryCohort.availability}%`}
                detail={`${primaryCohort.label} at year ${report.options.careerYears}`}
              />
              <SummaryMetric
                label="Forecast accuracy"
                value={`${report.diagnostics.forecastAccuracy}%`}
                detail="Fixture diagnostic"
              />
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Career shape</CardTitle>
                    <CardDescription>
                      Average overall trajectory across both cohorts.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <LegendDot tone="primary" label={primaryCohort.label} />
                    <LegendDot tone="muted" label={comparisonCohort.label} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <TrajectoryChart cohorts={report.cohorts} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cohort comparison</CardTitle>
                <CardDescription>
                  The high-level outcomes that should remain explainable in a
                  later cohort report.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cohort</TableHead>
                      <TableHead>Start age</TableHead>
                      <TableHead>Peak age</TableHead>
                      <TableHead>Net change</TableHead>
                      <TableHead>Availability</TableHead>
                      <TableHead>Retirement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.cohorts.map((cohort) => (
                      <TableRow key={cohort.id}>
                        <TableCell>
                          <div className="grid gap-0.5">
                            <span className="font-medium">{cohort.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {cohort.players.toLocaleString()} players
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{cohort.startingAge}</TableCell>
                        <TableCell>{cohort.peakAge}</TableCell>
                        <TableCell className="font-medium tabular-nums">
                          {cohort.averageNetChange > 0 ? "+" : ""}
                          {cohort.averageNetChange}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {cohort.availability}%
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {cohort.retirementRate}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
              <Card>
                <CardHeader>
                  <CardTitle>Skill trajectories</CardTitle>
                  <CardDescription>
                    Separate skill movement makes age and development effects
                    easier to inspect than a single overall delta.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <TrajectoryTable cohorts={report.cohorts} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Diagnostic notes</CardTitle>
                  <CardDescription>
                    Developer-only context that should not leak into gameplay.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <DiagnosticRow
                    label="Failed seeds"
                    value={report.diagnostics.failedSeeds}
                  />
                  <DiagnosticRow
                    label="Injury recovery"
                    value={`${report.diagnostics.injuryRecoveryRate}%`}
                  />
                  <div className="border-t border-border pt-3">
                    <ul className="grid gap-2 text-xs leading-5 text-muted-foreground">
                      {report.diagnostics.notes.map((note) => (
                        <li key={note} className="flex gap-2">
                          <span
                            aria-hidden="true"
                            className="mt-1 size-1.5 shrink-0 rounded-full bg-muted-foreground/60"
                          />
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

function SummaryMetric({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="grid gap-1 rounded-lg border border-border bg-card px-4 py-3 ring-1 ring-foreground/5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tracking-tight tabular-nums">
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </div>
  )
}

function LegendDot({
  tone,
  label,
}: {
  tone: "primary" | "muted"
  label: string
}) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span
        className={`size-2 rounded-full ${tone === "primary" ? "bg-primary" : "bg-muted-foreground/50"}`}
      />
      {label}
    </span>
  )
}

function TrajectoryChart({
  cohorts,
}: {
  cohorts: [DevelopmentCohort, DevelopmentCohort]
}) {
  const width = 760
  const height = 240
  const padding = { top: 18, right: 20, bottom: 34, left: 38 }
  const values = cohorts.flatMap((cohort) =>
    cohort.years.map((year) => year.overall)
  )
  const minimum = Math.floor(Math.min(...values) - 2)
  const maximum = Math.ceil(Math.max(...values) + 2)
  const maxIndex = Math.max(
    ...cohorts.map((cohort) => cohort.years.length - 1),
    1
  )
  const x = (index: number) =>
    padding.left + (index / maxIndex) * (width - padding.left - padding.right)
  const y = (value: number) =>
    padding.top +
    ((maximum - value) / (maximum - minimum)) *
      (height - padding.top - padding.bottom)

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-[620px] text-xs"
        role="img"
        aria-label="Average overall trajectory comparison"
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
                strokeDasharray="2 4"
              />
              <text
                x={padding.left - 8}
                y={y(value) + 4}
                textAnchor="end"
                fill="var(--muted-foreground)"
              >
                {Math.round(value)}
              </text>
            </g>
          )
        })}
        {cohorts.map((cohort, cohortIndex) => (
          <polyline
            key={cohort.id}
            fill="none"
            stroke={
              cohortIndex === 0 ? "var(--primary)" : "var(--muted-foreground)"
            }
            strokeWidth={cohortIndex === 0 ? 2.5 : 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={cohort.years
              .map((year, index) => `${x(index)},${y(year.overall)}`)
              .join(" ")}
          />
        ))}
        {cohorts[0].years.map((year, index) => (
          <text
            key={year.year}
            x={x(index)}
            y={height - 10}
            textAnchor="middle"
            fill="var(--muted-foreground)"
          >
            Year {year.year}
          </text>
        ))}
      </svg>
    </div>
  )
}

function TrajectoryTable({
  cohorts,
}: {
  cohorts: [DevelopmentCohort, DevelopmentCohort]
}) {
  const years = cohorts[0].years
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Year</TableHead>
          <TableHead>Age</TableHead>
          <TableHead>{cohorts[0].label}</TableHead>
          <TableHead>{cohorts[1].label}</TableHead>
          <TableHead>Availability</TableHead>
          <TableHead>Events</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {years.map((year, index) => {
          const comparisonYear = cohorts[1].years[index]
          return (
            <TableRow key={year.year}>
              <TableCell className="font-medium">{year.year}</TableCell>
              <TableCell>{year.age}</TableCell>
              <TableCell className="font-medium tabular-nums">
                {year.overall}
              </TableCell>
              <TableCell className="tabular-nums">
                {comparisonYear.overall}
              </TableCell>
              <TableCell className="tabular-nums">
                {year.availability}% / {comparisonYear.availability}%
              </TableCell>
              <TableCell className="tabular-nums">
                {year.developmentEvents} / {comparisonYear.developmentEvents}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
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
