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
  createTeamAssemblyLabRun,
  getTeamAssemblyLabPlayerName,
  getTeamAssemblyLabTeamName,
  serializeTeamAssemblyLabReport,
  summarizeUniversePopulation,
} from "@/lib/teamAssemblyLab"
import type { TeamAssemblyLabOptions } from "@/lib/teamAssemblyLab"
import { formatPlayerIdentity } from "@workspace/domain-v2"
import type { PlayerPosition } from "@workspace/domain-v2"
import {
  getPlayerCurrentAbility,
  STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG,
} from "@workspace/sim-v2"
import type {
  InitialPlayerUniverse,
  TeamAssemblyDiagnostics,
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

export const Route = createFileRoute("/developer-labs/team-assembly")({
  component: TeamAssemblyLabPage,
})

const positions: Array<PlayerPosition> = ["PG", "SG", "SF", "PF", "C"]

function NumberField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  )
}

function formatArchetype(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function TeamAssemblyLabPage() {
  const standardAssembly =
    STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG.rosterAssembly
  const [seed, setSeed] = React.useState("team-assembly-lab")
  const [coreDepthPerPosition, setCoreDepthPerPosition] = React.useState(
    standardAssembly.coreDepthPerPosition
  )
  const [shortlistSize, setShortlistSize] = React.useState(
    standardAssembly.shortlistSize
  )
  const [selectionVariance, setSelectionVariance] = React.useState(
    standardAssembly.selectionVariance
  )
  const [universe, setUniverse] = React.useState<InitialPlayerUniverse | null>(
    null
  )
  const [selectedTeamId, setSelectedTeamId] = React.useState<string | null>(
    null
  )
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "topTen", desc: true },
  ])
  const [error, setError] = React.useState<string | null>(null)
  const [isDirty, setIsDirty] = React.useState(true)

  const options: TeamAssemblyLabOptions = {
    seed,
    coreDepthPerPosition,
    shortlistSize,
    selectionVariance,
  }
  const teams = universe
    ? Object.values(universe.assemblyDiagnostics.teams)
    : []
  const selectedTeam =
    universe && selectedTeamId
      ? universe.assemblyDiagnostics.teams[selectedTeamId]
      : null
  const selectedRoster =
    universe && selectedTeamId
      ? universe.rosters[selectedTeamId].map(
          (playerId) => universe.players[playerId]
        )
      : []
  const selectedPicks =
    universe && selectedTeamId
      ? universe.assemblyDiagnostics.picks.filter(
          (pick) => pick.teamId === selectedTeamId
        )
      : []
  const freeAgentSummary = universe
    ? summarizeUniversePopulation(universe, universe.freeAgentIds)
    : null
  const draftSummary = universe
    ? summarizeUniversePopulation(universe, universe.draftProspectIds)
    : null

  function markDirty() {
    setIsDirty(true)
  }

  function handleGenerate() {
    try {
      const nextUniverse = createTeamAssemblyLabRun({
        seed,
        coreDepthPerPosition: Math.min(
          2,
          Math.max(1, Math.round(coreDepthPerPosition))
        ),
        shortlistSize: Math.min(10, Math.max(1, Math.round(shortlistSize))),
        selectionVariance: Math.min(10, Math.max(0, selectionVariance)),
      })
      setUniverse(nextUniverse)
      setSelectedTeamId(nextUniverse.assemblyDiagnostics.teamOrder[0] ?? null)
      setError(null)
      setIsDirty(false)
    } catch (caught) {
      setUniverse(null)
      setSelectedTeamId(null)
      setError(
        caught instanceof Error
          ? caught.message
          : "Team assembly could not complete."
      )
    }
  }

  function handleReset() {
    setSeed("team-assembly-lab")
    setCoreDepthPerPosition(standardAssembly.coreDepthPerPosition)
    setShortlistSize(standardAssembly.shortlistSize)
    setSelectionVariance(standardAssembly.selectionVariance)
    setIsDirty(true)
    setError(null)
  }

  function handleDownload() {
    if (!universe) return

    const blob = new Blob([serializeTeamAssemblyLabReport(options, universe)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `foh-team-assembly-${seed || "run"}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const columns = React.useMemo<Array<ColumnDef<TeamAssemblyDiagnostics>>>(
    () => [
      {
        id: "team",
        header: "Team",
        accessorFn: (team) => getTeamAssemblyLabTeamName(team.teamId),
        cell: ({ row }) => (
          <span className="font-medium">
            {getTeamAssemblyLabTeamName(row.original.teamId)}
          </span>
        ),
      },
      { accessorKey: "rosterSize", header: "Players" },
      {
        id: "topTen",
        header: "Top 10",
        accessorFn: (team) => team.topTenAverageAbility,
      },
      {
        accessorKey: "topFiveAverageAbility",
        header: "Top 5",
      },
      {
        accessorKey: "bestPlayerAbility",
        header: "Best",
      },
      {
        accessorKey: "averageAge",
        header: "Age",
        cell: ({ row }) => formatNumber(row.original.averageAge),
      },
      {
        accessorKey: "averagePotential",
        header: "Potential",
        cell: ({ row }) => formatNumber(row.original.averagePotential),
      },
      ...positions.map<ColumnDef<TeamAssemblyDiagnostics>>((position) => ({
        id: position,
        header: position,
        accessorFn: (team) => team.positionCoverage[position],
      })),
    ],
    []
  )
  const table = useReactTable({
    data: teams,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  const topTenStrength =
    universe?.assemblyDiagnostics.leagueStrength.topTenAverageAbility
  const strongestTeam = [...teams].sort(
    (left, right) =>
      right.topTenAverageAbility - left.topTenAverageAbility ||
      left.teamId.localeCompare(right.teamId)
  )[0]
  const weakestTeam = [...teams].sort(
    (left, right) =>
      left.topTenAverageAbility - right.topTenAverageAbility ||
      left.teamId.localeCompare(right.teamId)
  )[0]

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
              <span>Team Assembly</span>
              <Badge variant="outline">Developer only</Badge>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-balance">
              Team assembly lab
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Inspect how the standard player universe becomes thirty legal,
              position-covered rosters through a reproducible snake allocation.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/developer-labs/player-generation">
                Player generation lab
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/developer-labs">All labs</Link>
            </Button>
          </div>
        </header>

        <div className="grid items-start gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="xl:sticky xl:top-4">
            <CardHeader>
              <CardTitle>Assembly controls</CardTitle>
              <CardDescription>
                Player populations use the shared production presets.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-1.5">
                <Label htmlFor="assembly-seed">Seed</Label>
                <Input
                  id="assembly-seed"
                  value={seed}
                  onChange={(event) => {
                    setSeed(event.target.value)
                    markDirty()
                  }}
                />
              </div>
              <NumberField
                id="assembly-core-depth"
                label="Core depth per position"
                value={coreDepthPerPosition}
                min={1}
                max={2}
                onChange={(value) => {
                  setCoreDepthPerPosition(value)
                  markDirty()
                }}
              />
              <NumberField
                id="assembly-shortlist"
                label="Candidate shortlist"
                value={shortlistSize}
                min={1}
                max={10}
                onChange={(value) => {
                  setShortlistSize(value)
                  markDirty()
                }}
              />
              <NumberField
                id="assembly-variance"
                label="Selection variance"
                value={selectionVariance}
                min={0}
                max={10}
                step={0.5}
                onChange={(value) => {
                  setSelectionVariance(value)
                  markDirty()
                }}
              />

              <div className="grid grid-cols-3 gap-2 border-y border-border py-4 text-xs">
                <div>
                  <p className="text-muted-foreground">Teams</p>
                  <p className="mt-1 font-medium text-foreground">30</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Roster</p>
                  <p className="mt-1 font-medium text-foreground">15</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Players</p>
                  <p className="mt-1 font-medium text-foreground">640</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  className="flex-1"
                  onClick={handleGenerate}
                >
                  Generate universe
                </Button>
                <Button type="button" variant="outline" onClick={handleReset}>
                  Reset
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleDownload}
                disabled={!universe}
              >
                Download JSON
              </Button>
              <p className="text-xs leading-5 text-muted-foreground">
                {universe
                  ? isDirty
                    ? "Controls changed since the displayed run."
                    : `Generated with assembly version ${universe.metadata.rosterAssemblyVersion}.`
                  : "No universe generated yet."}
              </p>
            </CardContent>
          </Card>

          <section
            className="grid min-w-0 gap-5"
            aria-label="Assembly evidence"
          >
            {error ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
              >
                {error}
              </div>
            ) : null}

            {!universe ? (
              <div className="grid min-h-72 place-items-center rounded-lg border border-dashed border-border p-8 text-center">
                <div className="max-w-md">
                  <h2 className="text-base font-medium">
                    Generate the standard universe
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    The lab will create 450 roster players, 100 free agents, and
                    90 draft prospects before assembling all thirty teams.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryBlock
                    label="Validation"
                    value={
                      universe.validationIssues.length === 0
                        ? "Passed"
                        : `${universe.validationIssues.length} issues`
                    }
                    detail="640 unique players"
                  />
                  <SummaryBlock
                    label="Top-10 strength spread"
                    value={formatNumber(topTenStrength?.spread ?? 0)}
                    detail={`${formatNumber(topTenStrength?.minimum ?? 0)}–${formatNumber(topTenStrength?.maximum ?? 0)}`}
                  />
                  <SummaryBlock
                    label="Strongest roster"
                    value={getTeamAssemblyLabTeamName(strongestTeam.teamId)}
                    detail={`Top 10: ${formatNumber(strongestTeam.topTenAverageAbility)}`}
                  />
                  <SummaryBlock
                    label="Weakest roster"
                    value={getTeamAssemblyLabTeamName(weakestTeam.teamId)}
                    detail={`Top 10: ${formatNumber(weakestTeam.topTenAverageAbility)}`}
                  />
                </div>

                {universe.validationIssues.length > 0 ? (
                  <div
                    role="alert"
                    className="rounded-md border border-destructive/30 bg-destructive/5 p-4"
                  >
                    <h2 className="text-sm font-medium text-destructive">
                      Universe validation failed
                    </h2>
                    <ul className="mt-2 grid gap-1 text-xs text-destructive">
                      {universe.validationIssues.map((issue, index) => (
                        <li key={`${issue.code}-${index}`}>{issue.message}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <Card>
                  <CardHeader>
                    <CardTitle>Team comparison</CardTitle>
                    <CardDescription>
                      Select a row to inspect its roster and pick history.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
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
                            data-state={
                              selectedTeamId === row.original.teamId
                                ? "selected"
                                : undefined
                            }
                            className="cursor-pointer"
                            onClick={() =>
                              setSelectedTeamId(row.original.teamId)
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                setSelectedTeamId(row.original.teamId)
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

                {selectedTeam && selectedTeamId ? (
                  <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          {getTeamAssemblyLabTeamName(selectedTeamId)} roster
                        </CardTitle>
                        <CardDescription>
                          Two-deep core coverage followed by five bench picks.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Player</TableHead>
                              <TableHead>Position</TableHead>
                              <TableHead>Archetype</TableHead>
                              <TableHead>Current</TableHead>
                              <TableHead>Age</TableHead>
                              <TableHead>Potential</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {[...selectedRoster]
                              .sort(
                                (left, right) =>
                                  getPlayerCurrentAbility(right) -
                                    getPlayerCurrentAbility(left) ||
                                  left.id.localeCompare(right.id)
                              )
                              .map((player) => (
                                <TableRow key={player.id}>
                                  <TableCell>
                                    <div className="grid gap-0.5">
                                      <span className="font-medium">
                                        {formatPlayerIdentity(
                                          player.identity
                                        ) ?? player.id}
                                      </span>
                                      <span className="max-w-56 truncate text-xs text-muted-foreground">
                                        {player.id}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {player.profile.role.primaryPosition}
                                    {player.profile.role.secondaryPosition
                                      ? ` / ${player.profile.role.secondaryPosition}`
                                      : ""}
                                  </TableCell>
                                  <TableCell>
                                    {formatArchetype(
                                      player.profile.role.primaryArchetype
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {getPlayerCurrentAbility(player)}
                                  </TableCell>
                                  <TableCell>{player.age}</TableCell>
                                  <TableCell>
                                    {player.profile.development.potential}
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Pick log</CardTitle>
                        <CardDescription>
                          Why each player survived the configured shortlist.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-3">
                        {selectedPicks.map((pick) => (
                          <details
                            key={pick.overallPick}
                            className="rounded-md border border-border px-3 py-2"
                          >
                            <summary className="cursor-pointer text-xs font-medium">
                              Round {pick.round} ·{" "}
                              {pick.requiredPosition ?? "Bench"} ·{" "}
                              {getTeamAssemblyLabPlayerName(
                                universe,
                                pick.selectedPlayerId
                              )}
                            </summary>
                            <div className="mt-3 grid gap-2 text-xs">
                              {pick.shortlist.map((candidate) => (
                                <div
                                  key={candidate.playerId}
                                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-border pt-2 first:border-t-0 first:pt-0"
                                >
                                  <span className="truncate">
                                    {getTeamAssemblyLabPlayerName(
                                      universe,
                                      candidate.playerId
                                    )}
                                  </span>
                                  <span className="text-muted-foreground tabular-nums">
                                    {candidate.currentAbility}{" "}
                                    {candidate.selectionNoise >= 0 ? "+" : ""}
                                    {candidate.selectionNoise.toFixed(2)} ={" "}
                                    {candidate.adjustedScore.toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </details>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <PopulationSummary
                    title="Initial free agents"
                    count={freeAgentSummary?.count ?? 0}
                    ability={freeAgentSummary?.averageAbility ?? 0}
                    age={freeAgentSummary?.averageAge ?? 0}
                    potential={freeAgentSummary?.averagePotential ?? 0}
                  />
                  <PopulationSummary
                    title="Draft class"
                    count={draftSummary?.count ?? 0}
                    ability={draftSummary?.averageAbility ?? 0}
                    age={draftSummary?.averageAge ?? 0}
                    potential={draftSummary?.averagePotential ?? 0}
                  />
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}

function SummaryBlock({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function PopulationSummary({
  title,
  count,
  ability,
  age,
  potential,
}: {
  title: string
  count: number
  ability: number
  age: number
  potential: number
}) {
  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <Badge variant="outline">{count} players</Badge>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-4 text-xs">
        <div>
          <dt className="text-muted-foreground">Current</dt>
          <dd className="mt-1 font-medium">{formatNumber(ability)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Age</dt>
          <dd className="mt-1 font-medium">{formatNumber(age)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Potential</dt>
          <dd className="mt-1 font-medium">{formatNumber(potential)}</dd>
        </div>
      </dl>
    </section>
  )
}
