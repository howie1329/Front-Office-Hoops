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
  TEAM_ASSEMBLY_LAB_TEAM_COUNT,
} from "@/lib/teamAssemblyLab"
import type { TeamAssemblyLabOptions } from "@/lib/teamAssemblyLab"
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
import { cn } from "@workspace/ui/lib/utils"

export const Route = createFileRoute("/developer-labs/team-assembly")({
  component: TeamAssemblyLabPage,
})

const positions: Array<PlayerPosition> = ["PG", "SG", "SF", "PF", "C"]
const rosterPlayerCount =
  TEAM_ASSEMBLY_LAB_TEAM_COUNT *
  STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG.rosterSize
const totalPlayerCount =
  rosterPlayerCount +
  STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG.initialFreeAgentCount +
  STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG.draftProspectCount

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
        className="h-9 px-3 text-sm md:text-sm"
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
  const [runOptions, setRunOptions] =
    React.useState<TeamAssemblyLabOptions | null>(null)
  const [selectedTeamId, setSelectedTeamId] = React.useState<string | null>(
    null
  )
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "topTen", desc: true },
  ])
  const [error, setError] = React.useState<string | null>(null)
  const [assemblyStatus, setAssemblyStatus] = React.useState("")
  const [isDirty, setIsDirty] = React.useState(true)

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
      const effectiveOptions: TeamAssemblyLabOptions = {
        seed,
        coreDepthPerPosition: Math.min(
          2,
          Math.max(1, Math.round(coreDepthPerPosition))
        ),
        shortlistSize: Math.min(10, Math.max(1, Math.round(shortlistSize))),
        selectionVariance: Math.min(10, Math.max(0, selectionVariance)),
      }
      const nextUniverse = createTeamAssemblyLabRun(effectiveOptions)
      setUniverse(nextUniverse)
      setRunOptions(effectiveOptions)
      setSelectedTeamId(nextUniverse.assemblyDiagnostics.teamOrder[0] ?? null)
      setError(null)
      setIsDirty(false)
      setAssemblyStatus(
        `${nextUniverse.assemblyDiagnostics.teamOrder.length} teams assembled.`
      )
    } catch (caught) {
      setUniverse(null)
      setRunOptions(null)
      setSelectedTeamId(null)
      setAssemblyStatus("")
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
    if (!universe || !runOptions) return

    const blob = new Blob(
      [serializeTeamAssemblyLabReport(runOptions, universe)],
      {
        type: "application/json",
      }
    )
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `foh-team-assembly-${runOptions.seed || "run"}.json`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
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
        cell: ({ row }) => formatNumber(row.original.topTenAverageAbility),
      },
      {
        accessorKey: "topFiveAverageAbility",
        header: "Top 5",
        cell: ({ row }) => formatNumber(row.original.topFiveAverageAbility),
      },
      {
        accessorKey: "bestPlayerAbility",
        header: "Best",
        cell: ({ row }) => formatNumber(row.original.bestPlayerAbility),
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
    <main className="min-h-svh bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-8">
        <header className="border-b border-border pb-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Link
                  to="/developer-labs"
                  className="transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none"
                >
                  Developer Labs
                </Link>
                <span aria-hidden="true">/</span>
                <span>Team assembly</span>
                <Badge variant="outline" className="font-medium">
                  Developer only
                </Badge>
              </div>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-balance">
                Team assembly lab
              </h1>
              <p className="mt-2 max-w-2xl text-base leading-7 text-pretty text-muted-foreground">
                Assemble a legal league from the generated player universe, then
                inspect roster strength, position coverage, and every selection
                decision.
              </p>
            </div>
            <nav className="flex flex-wrap gap-2" aria-label="Lab actions">
              <Button variant="outline" asChild className="h-10 px-3 text-sm">
                <Link to="/developer-labs/player-generation">
                  Player generation lab
                </Link>
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
              1. Configure
            </span>
            <span aria-hidden="true">→</span>
            <span className="rounded-md border border-border bg-muted px-2 py-1">
              2. Assemble
            </span>
            <span aria-hidden="true">→</span>
            <span className="rounded-md border border-border bg-muted px-2 py-1">
              3. Inspect rosters
            </span>
          </div>
        </header>

        <div className="grid items-start gap-6 xl:grid-cols-[336px_minmax(0,1fr)]">
          <Card className="gap-0 overflow-hidden py-0 ring-border xl:sticky xl:top-4">
            <CardHeader className="border-b border-border bg-muted/20 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Assembly controls</CardTitle>
                  <CardDescription className="mt-1 text-sm">
                    Every control is included in the export.
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className={
                    universe && isDirty
                      ? "bg-foreground text-background"
                      : "text-muted-foreground"
                  }
                >
                  {universe
                    ? isDirty
                      ? "Settings changed"
                      : "Run current"
                    : "Ready to run"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-5 px-5 py-5">
              <div className="grid gap-1.5">
                <Label htmlFor="assembly-seed">Seed</Label>
                <Input
                  id="assembly-seed"
                  className="h-9 px-3 text-sm md:text-sm"
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
                  <p className="mt-1 font-medium text-foreground">
                    {TEAM_ASSEMBLY_LAB_TEAM_COUNT}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Roster</p>
                  <p className="mt-1 font-medium text-foreground">
                    {STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG.rosterSize}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Players</p>
                  <p className="mt-1 font-medium text-foreground">
                    {totalPlayerCount}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  className="h-10 text-sm"
                  onClick={handleGenerate}
                >
                  Generate universe
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 text-sm"
                  onClick={handleReset}
                >
                  Reset
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-10 text-sm"
                onClick={handleDownload}
                disabled={!universe}
              >
                Download JSON
              </Button>
              <p className="text-center text-xs leading-5 text-muted-foreground">
                {universe
                  ? isDirty
                    ? "Controls changed since the displayed run."
                    : `Generated with assembly version ${universe.metadata.rosterAssemblyVersion}.`
                  : "No universe generated yet."}
              </p>
            </CardContent>
          </Card>

          <section className="grid min-w-0 gap-5">
            <p className="sr-only" aria-live="polite">
              {assemblyStatus}
            </p>
            {error ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
              >
                {error}
              </div>
            ) : null}

            {!universe ? (
              <Card className="gap-0 py-0 ring-border">
                <CardHeader className="border-b border-border px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">Evidence</CardTitle>
                      <CardDescription className="mt-1 text-sm">
                        Assemble a reproducible league to inspect roster
                        quality.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="font-medium">
                      {TEAM_ASSEMBLY_LAB_TEAM_COUNT} teams planned
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-5 py-5 sm:px-6 sm:py-6">
                  <div className="grid min-h-[360px] place-content-center gap-4 rounded-lg border border-dashed border-border bg-muted/30 px-6 text-center">
                    <div className="mx-auto max-w-xl">
                      <h2 className="text-lg font-semibold">
                        Build the standard universe
                      </h2>
                      <p className="mt-2 text-base leading-7 text-pretty text-muted-foreground">
                        Create {rosterPlayerCount} roster players,{" "}
                        {
                          STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG.initialFreeAgentCount
                        }{" "}
                        free agents, and{" "}
                        {
                          STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG.draftProspectCount
                        }{" "}
                        draft prospects, then assemble all{" "}
                        {TEAM_ASSEMBLY_LAB_TEAM_COUNT} teams with legal position
                        coverage.
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-medium text-muted-foreground">
                      <span>{TEAM_ASSEMBLY_LAB_TEAM_COUNT} teams</span>
                      <span>{rosterPlayerCount} roster players</span>
                      <span>{totalPlayerCount} total players</span>
                    </div>
                    <Button
                      className="mx-auto h-10 px-4 text-sm"
                      onClick={handleGenerate}
                    >
                      Generate universe
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid divide-y divide-border overflow-hidden rounded-lg border border-border bg-muted/40 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
                  <SummaryBlock
                    label="Validation"
                    value={
                      universe.validationIssues.length === 0
                        ? "Passed"
                        : `${universe.validationIssues.length} issues`
                    }
                    detail={`${totalPlayerCount} unique players`}
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

                <Card className="gap-0 py-0 ring-border">
                  <CardHeader className="border-b border-border bg-muted/20 px-5 py-4 sm:px-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg">
                          Team comparison
                        </CardTitle>
                        <CardDescription className="mt-1 text-sm">
                          Select a row to inspect its roster and pick history.
                        </CardDescription>
                      </div>
                      {selectedTeam ? (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-xs font-medium text-muted-foreground">
                            Selected
                          </span>
                          <Badge variant="outline" className="font-medium">
                            {getTeamAssemblyLabTeamName(selectedTeam.teamId)}
                          </Badge>
                        </div>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table
                      className="min-w-[900px]"
                      aria-label="Team comparison"
                    >
                      <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                          <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                              <TableHead
                                key={header.id}
                                className={
                                  header.column.id === "team"
                                    ? "sticky left-0 z-10 border-r border-border bg-background"
                                    : undefined
                                }
                                aria-sort={
                                  header.column.getIsSorted() === "asc"
                                    ? "ascending"
                                    : header.column.getIsSorted() === "desc"
                                      ? "descending"
                                      : "none"
                                }
                              >
                                {header.isPlaceholder ? null : (
                                  <button
                                    type="button"
                                    aria-label={
                                      "Sort by " +
                                      String(header.column.columnDef.header)
                                    }
                                    className="rounded-sm font-medium hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
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
                            role="row"
                            tabIndex={0}
                            aria-selected={
                              selectedTeamId === row.original.teamId
                            }
                            data-state={
                              selectedTeamId === row.original.teamId
                                ? "selected"
                                : undefined
                            }
                            className={cn(
                              "group cursor-pointer hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
                              selectedTeamId === row.original.teamId &&
                                "bg-muted"
                            )}
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
                              <TableCell
                                key={cell.id}
                                className={cn(
                                  "sticky left-0 z-[1] border-r border-border bg-background group-hover:bg-muted",
                                  cell.column.id === "team" &&
                                    selectedTeamId === row.original.teamId &&
                                    "bg-muted"
                                )}
                              >
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
                    <Card className="gap-0 py-0 ring-border">
                      <CardHeader className="border-b border-border bg-muted/20 px-5 py-4 sm:px-6">
                        <CardTitle className="text-lg">
                          {getTeamAssemblyLabTeamName(selectedTeamId)} roster
                        </CardTitle>
                        <CardDescription className="mt-1 text-sm">
                          Two-deep core coverage followed by five bench picks.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="overflow-x-auto p-0">
                        <Table
                          className="min-w-[680px]"
                          aria-label="Selected roster"
                        >
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
                                        {getTeamAssemblyLabPlayerName(
                                          universe,
                                          player.id
                                        )}
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

                    <Card className="gap-0 py-0 ring-border">
                      <CardHeader className="border-b border-border bg-muted/20 px-5 py-4 sm:px-6">
                        <CardTitle className="text-lg">Pick log</CardTitle>
                        <CardDescription className="mt-1 text-sm">
                          Why each player survived the configured shortlist.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-3 px-5 py-5 sm:px-6">
                        {selectedPicks.map((pick) => (
                          <details
                            key={pick.overallPick}
                            className="rounded-md border border-border bg-muted/20 px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-ring hover:bg-muted motion-reduce:transition-none"
                          >
                            <summary className="cursor-pointer list-none text-xs font-medium outline-none [&::-webkit-details-marker]:hidden">
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

                <div className="grid gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Other player pools
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Population evidence carried through from the shared
                      universe.
                    </p>
                  </div>
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
    <div className="px-4 py-4">
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
    <section className="rounded-lg border border-border bg-muted/20 p-4">
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
