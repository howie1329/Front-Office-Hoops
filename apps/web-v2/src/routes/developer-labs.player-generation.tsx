import { createFileRoute, Link } from "@tanstack/react-router"
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import type { ColumnDef, SortingState } from "@tanstack/react-table"
import * as React from "react"

import {
  createDefaultLabConfig,
  createHistogram,
  createLabPopulation,
  createLabPresetDefaults,
  formatRoleLabel,
  getLabMetric,
  getLabPlayerDisplayName,
  getLabPlayerIndex,
  LAB_METRICS,
  LAB_POPULATION_PRESET_IDS,
  serializeLabReport,
  summarizeLabPlayers,
  validateLabConfig,
} from "@/lib/playerGenerationLab"
import type {
  LabMetricKey,
  LabMode,
  LabPopulationPresetId,
  LabRunOptions,
} from "@/lib/playerGenerationLab"
import type {
  DistributionConfig,
  NumericRange,
  PlayerGenerationConfig,
  PlayerPopulationPresetId,
  PlayerSkillKey,
} from "@workspace/domain-v2"
import type {
  PlayerGenerationResult,
  PlayerIdentityMode,
  PlayerPopulationResult,
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

export const Route = createFileRoute("/developer-labs/player-generation")({
  component: PlayerGenerationLabPage,
})

const skillOptions: Array<PlayerSkillKey> = [
  "shooting",
  "finishing",
  "passing",
  "handling",
  "rebounding",
  "defense",
  "basketballIQ",
  "stamina",
]

const skillLabels: Record<PlayerSkillKey, string> = {
  shooting: "Shooting",
  finishing: "Finishing",
  passing: "Passing",
  handling: "Handling",
  rebounding: "Rebounding",
  defense: "Defense",
  basketballIQ: "Basketball IQ",
  stamina: "Stamina",
}

function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  )
}

function RangeFields({
  id,
  label,
  value,
  onChange,
  min,
  max,
}: {
  id: string
  label: string
  value: NumericRange
  onChange: (value: NumericRange) => void
  min?: number
  max?: number
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-xs font-medium">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          id={`${id}-min`}
          label="Min"
          value={value.min}
          min={min}
          max={max}
          onChange={(minValue) => onChange({ ...value, min: minValue })}
        />
        <NumberField
          id={`${id}-max`}
          label="Max"
          value={value.max}
          min={min}
          max={max}
          onChange={(maxValue) => onChange({ ...value, max: maxValue })}
        />
      </div>
    </fieldset>
  )
}

function DistributionFields({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: DistributionConfig
  onChange: (value: DistributionConfig) => void
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-xs font-medium">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          id={`${id}-center`}
          label="Center"
          value={value.center}
          onChange={(center) => onChange({ ...value, center })}
        />
        <NumberField
          id={`${id}-spread`}
          label="Spread"
          value={value.spread}
          min={0}
          step={0.5}
          onChange={(spread) => onChange({ ...value, spread })}
        />
      </div>
    </fieldset>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-4 border-b border-border pb-5 last:border-b-0 last:pb-0">
      <div>
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
    </section>
  )
}

function PlayerGenerationLabPage() {
  const [config, setConfig] = React.useState<PlayerGenerationConfig>(
    createDefaultLabConfig
  )
  const [seed, setSeed] = React.useState("player-lab")
  const [mode, setMode] = React.useState<LabMode>("batch")
  const [presetId, setPresetId] =
    React.useState<LabPopulationPresetId>("initial-roster")
  const [basePresetId, setBasePresetId] =
    React.useState<PlayerPopulationPresetId>("initial-roster")
  const [identityMode, setIdentityMode] =
    React.useState<PlayerIdentityMode>("generated")
  const [count, setCount] = React.useState(450)
  const [sampleIndex, setSampleIndex] = React.useState(1)
  const [results, setResults] = React.useState<Array<PlayerGenerationResult>>(
    []
  )
  const [population, setPopulation] =
    React.useState<PlayerPopulationResult | null>(null)
  const [selectedResult, setSelectedResult] =
    React.useState<PlayerGenerationResult | null>(null)
  const [metricKey, setMetricKey] = React.useState<LabMetricKey>("latentTalent")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [isDirty, setIsDirty] = React.useState(true)

  const errors = React.useMemo(() => validateLabConfig(config), [config])
  const summary = React.useMemo(() => summarizeLabPlayers(results), [results])
  const metric = getLabMetric(metricKey)
  const histogram = React.useMemo(
    () => createHistogram(results.map((result) => metric.getValue(result))),
    [metric, results]
  )

  function updateConfig(next: PlayerGenerationConfig) {
    setConfig(next)
    setPresetId("custom")
    setIsDirty(true)
  }

  function updateRange<TField extends keyof PlayerGenerationConfig>(
    key: TField,
    value: PlayerGenerationConfig[TField]
  ) {
    updateConfig({ ...config, [key]: value })
  }

  function handleGenerate() {
    const options: LabRunOptions = {
      seed,
      mode,
      count: Math.min(500, Math.max(1, count)),
      sampleIndex: Math.max(1, sampleIndex),
      identityMode,
      presetId,
      basePresetId,
      config,
    }
    const nextPopulation = createLabPopulation(options)
    setPopulation(nextPopulation)
    setResults(nextPopulation.results)
    setSelectedResult(nextPopulation.results[0] ?? null)
    setIsDirty(false)
  }

  function handleReset() {
    const defaults = createLabPresetDefaults(basePresetId)
    setConfig(defaults.config)
    setSeed("player-lab")
    setMode("batch")
    setIdentityMode("generated")
    setPresetId(basePresetId)
    setCount(defaults.count)
    setSampleIndex(1)
    setIsDirty(true)
  }

  function handleDownload() {
    if (!population) return

    const options: LabRunOptions = {
      seed,
      mode,
      count,
      sampleIndex,
      identityMode,
      presetId,
      basePresetId,
      config,
    }
    const blob = new Blob([serializeLabReport(options, population)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `foh-player-generation-${seed || "run"}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function handlePresetChange(value: string) {
    if (value === "custom") {
      return
    }

    const nextPresetId = value as PlayerPopulationPresetId
    const defaults = createLabPresetDefaults(nextPresetId)
    setConfig(defaults.config)
    setCount(defaults.count)
    setMode("batch")
    setPresetId(nextPresetId)
    setBasePresetId(nextPresetId)
    setIsDirty(true)
  }

  const columns = React.useMemo<Array<ColumnDef<PlayerGenerationResult>>>(
    () => [
      {
        id: "player",
        header: "Player",
        accessorFn: (row) => getLabPlayerDisplayName(row),
        cell: ({ row }) => (
          <div className="grid gap-0.5">
            <span className="font-medium">
              {getLabPlayerDisplayName(row.original)}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              Sample {String(getLabPlayerIndex(row.original)).padStart(3, "0")}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "diagnostics.talentTier",
        header: "Tier",
        cell: ({ row }) => row.original.diagnostics.talentTier,
      },
      {
        id: "position",
        header: "Position",
        accessorFn: (row) => row.player.profile.role.primaryPosition,
        cell: ({ row }) => {
          const role = row.original.player.profile.role
          return `${role.primaryPosition}${role.secondaryPosition ? ` / ${role.secondaryPosition}` : ""}`
        },
      },
      {
        id: "archetype",
        header: "Archetype",
        accessorFn: (row) => row.player.profile.role.primaryArchetype,
        cell: ({ row }) => {
          const role = row.original.player.profile.role
          return `${formatRoleLabel(role.primaryArchetype)}${role.secondaryArchetype ? ` / ${formatRoleLabel(role.secondaryArchetype)}` : ""}`
        },
      },
      {
        accessorKey: "diagnostics.latentTalent",
        header: "Latent",
        cell: ({ row }) => row.original.diagnostics.latentTalent,
      },
      {
        accessorKey: "diagnostics.currentAbility",
        header: "Current",
        cell: ({ row }) => row.original.diagnostics.currentAbility,
      },
      {
        id: "potential",
        header: "Potential",
        accessorFn: (row) => row.player.profile.development.potential,
      },
      {
        id: "potentialGap",
        header: "Gap",
        accessorFn: (row) =>
          row.player.profile.development.potential -
          row.diagnostics.currentAbility,
      },
      { accessorKey: "player.age", header: "Age" },
      {
        id: "height",
        header: "Height",
        accessorFn: (row) => row.player.profile.physical.heightInches,
      },
      {
        id: "speed",
        header: "Speed",
        accessorFn: (row) => row.player.profile.physical.speed,
      },
      {
        id: "shooting",
        header: "Shoot",
        accessorFn: (row) => row.player.profile.skills.shooting,
      },
      {
        id: "passing",
        header: "Pass",
        accessorFn: (row) => row.player.profile.skills.passing,
      },
      {
        id: "iq",
        header: "IQ",
        accessorFn: (row) => row.player.profile.skills.basketballIQ,
      },
      {
        id: "defense",
        header: "Defense",
        accessorFn: (row) => row.player.profile.skills.defense,
      },
      {
        id: "injury",
        header: "Injury res.",
        accessorFn: (row) => row.player.profile.injuryResistance,
      },
      {
        id: "traits",
        header: "Traits",
        cell: ({ row }) => row.original.player.profile.traits.join(", ") || "—",
      },
    ],
    []
  )

  const table = useReactTable({
    data: results,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

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
              <span>Player Generation</span>
              <Badge variant="outline">Developer only</Badge>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-balance">
              Player generation lab
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Change the generator assumptions, run a reproducible sample, and
              inspect how each completed profile resolves into positions and
              archetypes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/developer-labs/team-assembly">Team assembly lab</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              Reset defaults
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/developer-labs">All labs</Link>
            </Button>
          </div>
        </header>

        <div className="grid items-start gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="xl:sticky xl:top-4">
            <CardHeader>
              <CardTitle>Run configuration</CardTitle>
              <CardDescription>
                Every control is included in the exported report.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <Section title="Run" description="Seed and sample shape">
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="lab-population-preset">
                      Population preset
                    </Label>
                    <Select value={presetId} onValueChange={handlePresetChange}>
                      <SelectTrigger
                        id="lab-population-preset"
                        className="h-9 w-full px-3 text-sm"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LAB_POPULATION_PRESET_IDS.map((id) => (
                          <SelectItem key={id} value={id}>
                            {
                              {
                                "initial-roster": "Initial roster",
                                "initial-free-agents": "Initial free agents",
                                "draft-class": "Draft class",
                              }[id]
                            }
                          </SelectItem>
                        ))}
                        <SelectItem value="custom" disabled>
                          Custom
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs leading-5 text-muted-foreground">
                      Presets use the same defaults as production league
                      generation.
                    </p>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="lab-seed">Seed</Label>
                    <Input
                      id="lab-seed"
                      value={seed}
                      onChange={(event) => {
                        setSeed(event.target.value)
                        setIsDirty(true)
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={mode === "batch" ? "default" : "outline"}
                      onClick={() => {
                        setMode("batch")
                        setIsDirty(true)
                      }}
                    >
                      Batch
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={mode === "single" ? "default" : "outline"}
                      onClick={() => {
                        setMode("single")
                        setIsDirty(true)
                      }}
                    >
                      Single
                    </Button>
                  </div>
                  <fieldset className="grid gap-2">
                    <legend className="text-xs font-medium">Identity</legend>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          identityMode === "generated" ? "default" : "outline"
                        }
                        aria-pressed={identityMode === "generated"}
                        onClick={() => {
                          setIdentityMode("generated")
                          setIsDirty(true)
                        }}
                      >
                        Generated names
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          identityMode === "none" ? "default" : "outline"
                        }
                        aria-pressed={identityMode === "none"}
                        onClick={() => {
                          setIdentityMode("none")
                          setIsDirty(true)
                        }}
                      >
                        Numbered placeholders
                      </Button>
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">
                      Placeholders are display-only; exported players remain
                      nameless.
                    </p>
                  </fieldset>
                  {mode === "batch" ? (
                    <NumberField
                      id="lab-count"
                      label="Players"
                      value={count}
                      min={1}
                      max={500}
                      onChange={(value) => {
                        setCount(value)
                        setPresetId("custom")
                        setIsDirty(true)
                      }}
                    />
                  ) : (
                    <NumberField
                      id="lab-sample-index"
                      label="Sample index"
                      value={sampleIndex}
                      min={1}
                      onChange={(value) => {
                        setSampleIndex(value)
                        setIsDirty(true)
                      }}
                    />
                  )}
                </div>
              </Section>

              <Section
                title="Talent model"
                description="Shape the population and elite tail"
              >
                <div className="grid gap-4">
                  <RangeFields
                    id="lab-age"
                    label="Age range"
                    value={config.age}
                    min={18}
                    max={50}
                    onChange={(age) => updateRange("age", age)}
                  />
                  <RangeFields
                    id="lab-rating"
                    label="Rating bounds"
                    value={config.ratingBounds}
                    min={0}
                    max={100}
                    onChange={(ratingBounds) =>
                      updateRange("ratingBounds", ratingBounds)
                    }
                  />
                  <DistributionFields
                    id="lab-talent"
                    label="Latent talent distribution"
                    value={config.talentDistribution}
                    onChange={(talentDistribution) =>
                      updateRange("talentDistribution", talentDistribution)
                    }
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <NumberField
                      id="lab-tail-70"
                      label="70+"
                      value={config.starTailFrequency.above70}
                      min={0}
                      max={1}
                      step={0.001}
                      onChange={(above70) =>
                        updateConfig({
                          ...config,
                          starTailFrequency: {
                            ...config.starTailFrequency,
                            above70,
                          },
                        })
                      }
                    />
                    <NumberField
                      id="lab-tail-80"
                      label="80+"
                      value={config.starTailFrequency.above80}
                      min={0}
                      max={1}
                      step={0.001}
                      onChange={(above80) =>
                        updateConfig({
                          ...config,
                          starTailFrequency: {
                            ...config.starTailFrequency,
                            above80,
                          },
                        })
                      }
                    />
                    <NumberField
                      id="lab-tail-90"
                      label="90+"
                      value={config.starTailFrequency.above90}
                      min={0}
                      max={1}
                      step={0.001}
                      onChange={(above90) =>
                        updateConfig({
                          ...config,
                          starTailFrequency: {
                            ...config.starTailFrequency,
                            above90,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </Section>

              <Section
                title="Physical profile"
                description="Measurements and athletic ranges"
              >
                <div className="grid gap-4">
                  <RangeFields
                    id="lab-height"
                    label="Height (in)"
                    value={config.physical.heightInches}
                    min={48}
                    max={96}
                    onChange={(heightInches) =>
                      updateConfig({
                        ...config,
                        physical: { ...config.physical, heightInches },
                      })
                    }
                  />
                  <RangeFields
                    id="lab-weight"
                    label="Weight (lb)"
                    value={config.physical.weightPounds}
                    min={80}
                    max={500}
                    onChange={(weightPounds) =>
                      updateConfig({
                        ...config,
                        physical: { ...config.physical, weightPounds },
                      })
                    }
                  />
                  <RangeFields
                    id="lab-wingspan"
                    label="Wingspan (in)"
                    value={config.physical.wingspanInches}
                    min={48}
                    max={110}
                    onChange={(wingspanInches) =>
                      updateConfig({
                        ...config,
                        physical: { ...config.physical, wingspanInches },
                      })
                    }
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <RangeFields
                      id="lab-speed"
                      label="Speed"
                      value={config.physical.speed}
                      min={0}
                      max={100}
                      onChange={(speed) =>
                        updateConfig({
                          ...config,
                          physical: { ...config.physical, speed },
                        })
                      }
                    />
                    <RangeFields
                      id="lab-strength"
                      label="Strength"
                      value={config.physical.strength}
                      min={0}
                      max={100}
                      onChange={(strength) =>
                        updateConfig({
                          ...config,
                          physical: { ...config.physical, strength },
                        })
                      }
                    />
                    <RangeFields
                      id="lab-vertical"
                      label="Vertical"
                      value={config.physical.vertical}
                      min={0}
                      max={100}
                      onChange={(vertical) =>
                        updateConfig({
                          ...config,
                          physical: { ...config.physical, vertical },
                        })
                      }
                    />
                  </div>
                </div>
              </Section>

              <Section
                title="Development"
                description="Ceiling headroom, growth, and unpredictability"
              >
                <div className="grid gap-4">
                  <DistributionFields
                    id="lab-potential"
                    label="Potential headroom"
                    value={config.development.potential}
                    onChange={(potentialDistribution) =>
                      updateConfig({
                        ...config,
                        development: {
                          ...config.development,
                          potential: {
                            ...config.development.potential,
                            ...potentialDistribution,
                            center: Math.min(
                              potentialDistribution.center,
                              config.development.potential.maxHeadroom
                            ),
                          },
                        },
                      })
                    }
                  />
                  <NumberField
                    id="lab-potential-max-headroom"
                    label="Maximum potential headroom"
                    value={config.development.potential.maxHeadroom}
                    min={0}
                    max={100}
                    onChange={(maxHeadroom) =>
                      updateConfig({
                        ...config,
                        development: {
                          ...config.development,
                          potential: {
                            ...config.development.potential,
                            maxHeadroom: Math.max(0, maxHeadroom),
                            center: Math.min(
                              config.development.potential.center,
                              Math.max(0, maxHeadroom)
                            ),
                          },
                        },
                      })
                    }
                  />
                  <DistributionFields
                    id="lab-development"
                    label="Development rating"
                    value={config.development.rating}
                    onChange={(rating) =>
                      updateConfig({
                        ...config,
                        development: { ...config.development, rating },
                      })
                    }
                  />
                  <DistributionFields
                    id="lab-volatility"
                    label="Development volatility"
                    value={config.development.volatility}
                    onChange={(volatility) =>
                      updateConfig({
                        ...config,
                        development: { ...config.development, volatility },
                      })
                    }
                  />
                  <NumberField
                    id="lab-trait-frequency"
                    label="Trait frequency"
                    value={config.traitFrequency}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(traitFrequency) =>
                      updateConfig({ ...config, traitFrequency })
                    }
                  />
                  <div className="grid gap-1.5">
                    <Label htmlFor="lab-traits">Available traits</Label>
                    <Input
                      id="lab-traits"
                      value={config.availableTraits.join(", ")}
                      onChange={(event) =>
                        updateConfig({
                          ...config,
                          availableTraits: event.target.value
                            .split(",")
                            .map((trait) => trait.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </div>
                </div>
              </Section>

              <Section
                title="Role classification"
                description="Thresholds for secondary eligibility and specialist labels"
              >
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    id="lab-position-fit"
                    label="Min position fit"
                    value={config.classification.minPositionFit}
                    min={0}
                    max={100}
                    onChange={(minPositionFit) =>
                      updateConfig({
                        ...config,
                        classification: {
                          ...config.classification,
                          minPositionFit,
                        },
                      })
                    }
                  />
                  <NumberField
                    id="lab-position-gap"
                    label="Position gap"
                    value={config.classification.maxSecondaryPositionGap}
                    min={0}
                    max={100}
                    onChange={(maxSecondaryPositionGap) =>
                      updateConfig({
                        ...config,
                        classification: {
                          ...config.classification,
                          maxSecondaryPositionGap,
                        },
                      })
                    }
                  />
                  <NumberField
                    id="lab-archetype-fit"
                    label="Min archetype fit"
                    value={config.classification.minArchetypeFit}
                    min={0}
                    max={100}
                    onChange={(minArchetypeFit) =>
                      updateConfig({
                        ...config,
                        classification: {
                          ...config.classification,
                          minArchetypeFit,
                        },
                      })
                    }
                  />
                  <NumberField
                    id="lab-secondary-archetype-fit"
                    label="Secondary fit"
                    value={config.classification.minSecondaryArchetypeFit}
                    min={0}
                    max={100}
                    onChange={(minSecondaryArchetypeFit) =>
                      updateConfig({
                        ...config,
                        classification: {
                          ...config.classification,
                          minSecondaryArchetypeFit,
                        },
                      })
                    }
                  />
                  <NumberField
                    id="lab-archetype-gap"
                    label="Archetype gap"
                    value={config.classification.maxSecondaryArchetypeGap}
                    min={0}
                    max={100}
                    onChange={(maxSecondaryArchetypeGap) =>
                      updateConfig({
                        ...config,
                        classification: {
                          ...config.classification,
                          maxSecondaryArchetypeGap,
                        },
                      })
                    }
                  />
                </div>
              </Section>

              <Section
                title="Skill correlations"
                description="Pairwise relationships from -1 to 1"
              >
                <div className="grid gap-2">
                  {config.skillCorrelations.map((correlation, index) => (
                    <div
                      key={`${correlation.first}-${correlation.second}-${index}`}
                      className="grid grid-cols-[1fr_1fr_72px_auto] items-end gap-1.5"
                    >
                      <div className="grid gap-1">
                        <Label htmlFor={`corr-first-${index}`}>First</Label>
                        <select
                          id={`corr-first-${index}`}
                          className="h-7 rounded-md border border-input bg-input/20 px-2 text-xs"
                          value={correlation.first}
                          onChange={(event) => {
                            const next = [...config.skillCorrelations]
                            next[index] = {
                              ...correlation,
                              first: event.target.value as PlayerSkillKey,
                            }
                            updateConfig({ ...config, skillCorrelations: next })
                          }}
                        >
                          {skillOptions.map((skill) => (
                            <option key={skill} value={skill}>
                              {skillLabels[skill]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor={`corr-second-${index}`}>Second</Label>
                        <select
                          id={`corr-second-${index}`}
                          className="h-7 rounded-md border border-input bg-input/20 px-2 text-xs"
                          value={correlation.second}
                          onChange={(event) => {
                            const next = [...config.skillCorrelations]
                            next[index] = {
                              ...correlation,
                              second: event.target.value as PlayerSkillKey,
                            }
                            updateConfig({ ...config, skillCorrelations: next })
                          }}
                        >
                          {skillOptions.map((skill) => (
                            <option key={skill} value={skill}>
                              {skillLabels[skill]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <NumberField
                        id={`corr-strength-${index}`}
                        label="Strength"
                        value={correlation.strength}
                        min={-1}
                        max={1}
                        step={0.05}
                        onChange={(strength) => {
                          const next = [...config.skillCorrelations]
                          next[index] = { ...correlation, strength }
                          updateConfig({ ...config, skillCorrelations: next })
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-xs"
                        aria-label={`Remove correlation ${index + 1}`}
                        onClick={() =>
                          updateConfig({
                            ...config,
                            skillCorrelations: config.skillCorrelations.filter(
                              (_, itemIndex) => itemIndex !== index
                            ),
                          })
                        }
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      updateConfig({
                        ...config,
                        skillCorrelations: [
                          ...config.skillCorrelations,
                          {
                            first: "passing",
                            second: "basketballIQ",
                            strength: 0.1,
                          },
                        ],
                      })
                    }
                  >
                    Add correlation
                  </Button>
                </div>
              </Section>

              {errors.length > 0 ? (
                <div
                  className="grid gap-1 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive"
                  role="alert"
                >
                  {errors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              ) : null}

              <Button
                disabled={errors.length > 0 || !seed.trim()}
                onClick={handleGenerate}
              >
                Generate {mode === "batch" ? `${count} players` : "player"}
              </Button>
            </CardContent>
          </Card>

          <section className="grid min-w-0 gap-5" aria-live="polite">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Evidence</CardTitle>
                    <CardDescription>
                      {results.length
                        ? `${results.length} deterministic result${results.length === 1 ? "" : "s"} from “${seed}”.`
                        : "Run the generator to inspect a profile or population."}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {isDirty && results.length ? (
                      <Badge variant="outline">Settings changed</Badge>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!results.length}
                      onClick={handleDownload}
                    >
                      Download JSON
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-5">
                {results.length ? (
                  <>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {[
                        ["Players", summary.count],
                        [
                          "Avg current ability",
                          summary.averageCurrentAbility.toFixed(1),
                        ],
                        ["Avg potential", summary.averagePotential.toFixed(1)],
                        [
                          "Avg potential gap",
                          summary.averagePotentialGap.toFixed(1),
                        ],
                        ["Avg latent talent", summary.averageTalent.toFixed(1)],
                        [
                          "With traits",
                          `${Math.round(summary.traitRate * 100)}%`,
                        ],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-md border border-border bg-muted/30 px-3 py-2"
                        >
                          <p className="text-xs text-muted-foreground">
                            {label}
                          </p>
                          <p className="mt-1 text-lg font-semibold tabular-nums">
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="grid gap-3 lg:grid-cols-[1fr_240px]">
                      <div className="grid gap-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h2 className="text-sm font-medium">
                              Distribution
                            </h2>
                            <p className="text-xs text-muted-foreground">
                              Developer diagnostic; not a player overall.
                            </p>
                          </div>
                          <select
                            aria-label="Histogram metric"
                            className="h-7 rounded-md border border-input bg-input/20 px-2 text-xs"
                            value={metricKey}
                            onChange={(event) =>
                              setMetricKey(event.target.value as LabMetricKey)
                            }
                          >
                            {LAB_METRICS.map((option) => (
                              <option key={option.key} value={option.key}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex h-32 items-end gap-1 border-b border-l border-border px-2 pt-4 pb-2">
                          {histogram.map((bucket) => {
                            const max = Math.max(
                              ...histogram.map((item) => item.count),
                              1
                            )
                            return (
                              <div
                                key={bucket.label}
                                className="group relative flex h-full flex-1 items-end"
                                title={`${bucket.label}: ${bucket.count}`}
                              >
                                <div
                                  className="w-full rounded-t-sm bg-primary/75 transition-[height] duration-200 ease-out"
                                  style={{
                                    height: `${Math.max(4, (bucket.count / max) * 100)}%`,
                                  }}
                                />
                              </div>
                            )
                          })}
                        </div>
                        <div className="grid grid-cols-4 text-[0.625rem] text-muted-foreground">
                          <span>{histogram[0]?.label}</span>
                          <span />
                          <span />
                          <span className="text-right">
                            {histogram.at(-1)?.label}
                          </span>
                        </div>
                      </div>
                      <div className="grid content-start gap-2 rounded-md border border-border bg-muted/20 p-3">
                        <h2 className="text-sm font-medium">
                          Latent talent tiers
                        </h2>
                        {Object.entries(summary.tierCounts).map(
                          ([tier, value]) => (
                            <div
                              key={tier}
                              className="flex items-center justify-between gap-3 text-xs"
                            >
                              <span className="text-muted-foreground">
                                {tier}
                              </span>
                              <span className="font-medium tabular-nums">
                                {value}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-3">
                      <RoleSummary
                        title="Primary positions"
                        values={summary.primaryPositionCounts}
                      />
                      <RoleSummary
                        title="Primary archetypes"
                        values={summary.primaryArchetypeCounts}
                        formatLabel={formatRoleLabel}
                      />
                      <div className="grid content-start gap-2 rounded-md border border-border bg-muted/20 p-3">
                        <h2 className="text-sm font-medium">Role confidence</h2>
                        <Detail
                          label="Secondary position"
                          value={`${Math.round(summary.secondaryPositionRate * 100)}%`}
                        />
                        <Detail
                          label="Secondary archetype"
                          value={`${Math.round(summary.secondaryArchetypeRate * 100)}%`}
                        />
                        <Detail
                          label="Low position confidence"
                          value={`${Math.round(summary.lowPositionConfidenceRate * 100)}%`}
                        />
                        <Detail
                          label="Low archetype confidence"
                          value={`${Math.round(summary.lowArchetypeConfidenceRate * 100)}%`}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid min-h-64 place-content-center gap-2 border border-dashed border-border px-6 text-center">
                    <p className="text-sm font-medium">No run yet</p>
                    <p className="mx-auto max-w-sm text-xs leading-5 text-muted-foreground">
                      Adjust the assumptions on the left, then generate a
                      reproducible sample. The result table and diagnostics will
                      appear here.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {results.length && mode === "single" && selectedResult ? (
              <PlayerDetail result={selectedResult} />
            ) : null}

            {results.length && mode === "batch" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Generated players</CardTitle>
                  <CardDescription>
                    Click a row to inspect raw and final skill values.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <TableHead key={header.id}>
                              {header.isPlaceholder ? null : (
                                <button
                                  type="button"
                                  className="font-medium hover:text-primary"
                                  onClick={header.column.getToggleSortingHandler()}
                                >
                                  {flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}{" "}
                                  {(
                                    { asc: "↑", desc: "↓" } as Record<
                                      string,
                                      string
                                    >
                                  )[header.column.getIsSorted() as string] ??
                                    "↕"}
                                </button>
                              )}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {table.getRowModel().rows.map((row) => (
                        <TableRow
                          key={row.id}
                          tabIndex={0}
                          className="cursor-pointer"
                          onClick={() => setSelectedResult(row.original)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              setSelectedResult(row.original)
                            }
                          }}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : null}

            {results.length && mode === "batch" && selectedResult ? (
              <PlayerDetail result={selectedResult} />
            ) : null}
          </section>
        </div>
      </div>
    </main>
  )
}

function PlayerDetail({ result }: { result: PlayerGenerationResult }) {
  const { player, diagnostics } = result
  const sampleIndex = getLabPlayerIndex(result)
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{getLabPlayerDisplayName(result)}</CardTitle>
            <CardDescription>
              Sample {String(sampleIndex).padStart(3, "0")} · {player.age} years
              old · {diagnostics.talentTier} talent tier
            </CardDescription>
          </div>
          <Badge>{diagnostics.latentTalent} latent talent</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <DetailGroup title="Physical">
          <Detail
            label="Height"
            value={`${player.profile.physical.heightInches} in`}
          />
          <Detail
            label="Weight"
            value={`${player.profile.physical.weightPounds} lb`}
          />
          <Detail
            label="Wingspan"
            value={`${player.profile.physical.wingspanInches} in`}
          />
          <Detail label="Speed" value={player.profile.physical.speed} />
          <Detail label="Strength" value={player.profile.physical.strength} />
          <Detail label="Vertical" value={player.profile.physical.vertical} />
        </DetailGroup>
        <DetailGroup title="Current profile">
          {Object.entries(player.profile.skills).map(([skill, value]) => (
            <Detail
              key={skill}
              label={skillLabels[skill as PlayerSkillKey]}
              value={Number(value)}
            />
          ))}
          <Detail
            label="Injury resistance"
            value={player.profile.injuryResistance}
          />
        </DetailGroup>
        <DetailGroup title="Development">
          <Detail
            label="Potential"
            value={player.profile.development.potential}
          />
          <Detail
            label="Development rating"
            value={player.profile.development.rating}
          />
          <Detail
            label="Volatility"
            value={player.profile.development.volatility}
          />
          <Detail
            label="Traits"
            value={player.profile.traits.join(", ") || "None"}
          />
        </DetailGroup>
        <DetailGroup title="Role classification">
          <Detail
            label="Primary position"
            value={player.profile.role.primaryPosition}
          />
          <Detail
            label="Secondary position"
            value={player.profile.role.secondaryPosition ?? "None"}
          />
          <Detail
            label="Primary archetype"
            value={formatRoleLabel(player.profile.role.primaryArchetype)}
          />
          <Detail
            label="Secondary archetype"
            value={
              player.profile.role.secondaryArchetype
                ? formatRoleLabel(player.profile.role.secondaryArchetype)
                : "None"
            }
          />
          <Detail
            label="Position confidence"
            value={diagnostics.role.positionConfidence}
          />
          <Detail
            label="Archetype confidence"
            value={diagnostics.role.archetypeConfidence}
          />
        </DetailGroup>
        <DetailGroup title="Generation diagnostics">
          <Detail label="Current ability" value={diagnostics.currentAbility} />
          <Detail label="Potential base" value={diagnostics.potentialBase} />
          <Detail
            label="Generated upside"
            value={diagnostics.potentialUpside}
          />
          <Detail
            label="Position fit"
            value={
              diagnostics.role.positionFits[player.profile.role.primaryPosition]
            }
          />
          <Detail
            label="Archetype fit"
            value={
              diagnostics.role.archetypeFits[
                player.profile.role.primaryArchetype
              ]
            }
          />
          <Detail
            label="Gate failures"
            value={
              diagnostics.role.specialistGateFailures.length
                ? diagnostics.role.specialistGateFailures
                    .map(formatRoleLabel)
                    .join(", ")
                : "None"
            }
          />
          {Object.entries(diagnostics.rawSkills).map(([skill, value]) => (
            <Detail
              key={skill}
              label={`${skillLabels[skill as PlayerSkillKey]} raw`}
              value={`${value} → ${player.profile.skills[skill as PlayerSkillKey]}`}
            />
          ))}
        </DetailGroup>
      </CardContent>
    </Card>
  )
}

function DetailGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="grid content-start gap-2">
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="grid gap-1.5">{children}</div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/70 py-1.5 text-xs last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

function RoleSummary({
  title,
  values,
  formatLabel: labelFormatter = (value) => value,
}: {
  title: string
  values: Record<string, number>
  formatLabel?: (value: string) => string
}) {
  return (
    <div className="grid content-start gap-2 rounded-md border border-border bg-muted/20 p-3">
      <h2 className="text-sm font-medium">{title}</h2>
      {Object.entries(values)
        .sort(([, left], [, right]) => right - left)
        .map(([value, count]) => (
          <div
            key={value}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <span className="text-muted-foreground">
              {labelFormatter(value)}
            </span>
            <span className="font-medium tabular-nums">{count}</span>
          </div>
        ))}
    </div>
  )
}
