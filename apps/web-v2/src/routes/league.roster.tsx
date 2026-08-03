import { createFileRoute, useNavigate } from "@tanstack/react-router"
import * as React from "react"

import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  FilterHorizontalIcon,
  Search02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type {
  JsonRecord,
  GameRotationInput,
  LeagueDocument,
  PlayerEntity,
} from "@workspace/domain-v2"
import {
  createDefaultRotation,
  getContractSalary,
  getContractYearsRemaining,
  getPlayerCurrentAbility,
  projectTeamFinance,
} from "@workspace/sim-v2"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useLeagueShell } from "@/components/league-shell"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/league/roster")({
  validateSearch: (
    search: Record<string, unknown>
  ): { saveId?: string; playerId?: string; tab?: RosterTab } => {
    const saveId = typeof search.saveId === "string" ? search.saveId : undefined
    const playerId =
      typeof search.playerId === "string" ? search.playerId : undefined
    const tab =
      search.tab === "rotation" || search.tab === "roster"
        ? search.tab
        : undefined

    return { saveId, playerId, tab }
  },
  component: TeamRosterPage,
})

const ROSTER_LIMIT = 15
const TEAM_REGULATION_MINUTES = 240
const ROSTER_TABS = ["roster", "rotation"] as const
const POSITION_FILTERS = ["all", "PG", "SG", "SF", "PF", "C"] as const
const HEALTH_FILTERS = ["all", "available", "out"] as const
const CONTRACT_FILTERS = ["all", "signed", "missing"] as const
const SORT_KEYS = [
  "name",
  "position",
  "age",
  "overall",
  "salary",
  "years",
] as const

type PositionFilter = (typeof POSITION_FILTERS)[number]
type HealthFilter = (typeof HEALTH_FILTERS)[number]
type ContractFilter = (typeof CONTRACT_FILTERS)[number]
type SortKey = (typeof SORT_KEYS)[number]
type SortDirection = "asc" | "desc"
type SortState = { key: SortKey; direction: SortDirection }
type RosterTab = (typeof ROSTER_TABS)[number]

function formatMoney(value: number | null): string {
  if (value === null) return "—"

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatMillions(value: number | null): string {
  if (value === null) return "—"
  return `$${(value / 1_000_000).toFixed(1)}M`
}

function fullName(player: PlayerEntity): string {
  return [player.identity.firstName, player.identity.lastName]
    .filter(Boolean)
    .join(" ")
}

function numericField(
  record: JsonRecord | undefined,
  key: string
): number | null {
  const value = record?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function getPlayerContract(
  league: LeagueDocument,
  playerId: string
): JsonRecord | undefined {
  return Object.values(league.entities.contracts).find(
    (contract) =>
      contract.playerId === playerId &&
      contract.teamId === league.state.userTeamId
  )
}

function getRosterPlayers(
  league: LeagueDocument,
  teamId: string
): Array<PlayerEntity> {
  return (league.entities.teams[teamId].rosterPlayerIds ?? [])
    .map((playerId) => league.entities.players[playerId])
    .filter((player): player is PlayerEntity => Boolean(player))
}

function getPlayerHealth(
  league: LeagueDocument,
  playerId: string
): { label: string; detail?: string; unavailable: boolean } {
  const injuryEvent = [...league.history.events]
    .reverse()
    .find(
      (event) =>
        event.type === "injury.recorded" &&
        event.entityRefs.some(
          (reference) =>
            reference.type === "player" && reference.id === playerId
        )
    )

  if (!injuryEvent) return { label: "Available", unavailable: false }

  const gamesRemaining = numericField(injuryEvent.payload, "gamesRemaining")
  if (gamesRemaining && gamesRemaining > 0) {
    return {
      label: "Out",
      detail: `${gamesRemaining} games remaining`,
      unavailable: true,
    }
  }

  return { label: "Available", unavailable: false }
}

function ratingGrade(value: number): string {
  if (value >= 90) return "A+"
  if (value >= 85) return "A"
  if (value >= 80) return "B+"
  if (value >= 75) return "B"
  if (value >= 70) return "C+"
  if (value >= 60) return "C"
  return "D"
}

function titleCase(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function average(values: Array<number>): number {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0
}

function RosterSummary({
  league,
  teamId,
}: {
  league: LeagueDocument
  teamId: string
}) {
  const rosterPlayers = getRosterPlayers(league, teamId)
  const rosterCount = rosterPlayers.length
  const finance = projectTeamFinance(league, teamId, 1)
  const current = finance.seasons[0]
  const teamOverall = Math.round(
    average(rosterPlayers.map(getPlayerCurrentAbility))
  )
  const averageAge = average(rosterPlayers.map((player) => player.age))
  const hasRosterIssue = rosterCount > ROSTER_LIMIT
  const rosterMessage = hasRosterIssue
    ? `Roster exceeds the ${ROSTER_LIMIT}-player limit. Remove a player before advancing.`
    : ""

  return (
    <section
      aria-labelledby="roster-heading"
      className="shrink-0 border-b border-border"
    >
      <h1 id="roster-heading" className="sr-only">
        Roster
      </h1>
      <TooltipProvider>
        <dl className="grid grid-cols-2 divide-x divide-border sm:grid-cols-5">
          {[
            [
              "Payroll",
              formatMillions(current.payroll),
              "Active salary + dead money",
            ],
            [
              "Dead money",
              formatMillions(current.deadMoney),
              "Released contracts",
            ],
            ["Team OVR", String(teamOverall), "Average current ability"],
            ["Average age", averageAge.toFixed(1), "Years"],
          ].map(([label, value, detail], index) => (
            <div key={label} className={cn("py-3 pr-4", index > 0 && "pl-4")}>
              <dt className="text-[11px] text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums">
                {value}
              </dd>
              <p className="truncate text-[10px] text-muted-foreground">
                {detail}
              </p>
            </div>
          ))}
          <div className="col-span-2 py-3 pr-4 sm:col-span-1 sm:pl-4">
            <dt className="text-[11px] text-muted-foreground">Roster spots</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums">
              {hasRosterIssue ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      aria-label={`${rosterCount} of ${ROSTER_LIMIT} roster spots. ${rosterMessage}`}
                      className="text-destructive underline decoration-dotted underline-offset-4"
                    >
                      {rosterCount} / {ROSTER_LIMIT}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{rosterMessage}</TooltipContent>
                </Tooltip>
              ) : (
                <span>
                  {rosterCount} / {ROSTER_LIMIT}
                </span>
              )}
            </dd>
            <p className="truncate text-[10px] text-muted-foreground">
              Standard roster
            </p>
          </div>
        </dl>
      </TooltipProvider>
    </section>
  )
}

function compareSortValues(
  left: string | number | null,
  right: string | number | null
): number {
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1
  if (typeof left === "string" && typeof right === "string") {
    return left.localeCompare(right)
  }
  return Number(left) - Number(right)
}

function getPlayerSortValue(
  league: LeagueDocument,
  player: PlayerEntity,
  key: SortKey
): string | number | null {
  switch (key) {
    case "name":
      return fullName(player)
    case "position":
      return player.profile.role.primaryPosition
    case "age":
      return player.age
    case "overall":
      return getPlayerCurrentAbility(player)
    case "salary":
      return getContractSalary(
        getPlayerContract(league, player.id),
        league.state.season
      )
    case "years":
      return getContractYearsRemaining(
        getPlayerContract(league, player.id),
        league.state.season
      )
  }
}

function SortableTableHead({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
  className,
}: {
  label: string
  sortKey: SortKey
  sort: SortState
  onSort: (key: SortKey) => void
  align?: "left" | "right"
  className?: string
}) {
  const active = sort.key === sortKey
  const direction = active ? sort.direction : undefined

  return (
    <TableHead
      aria-sort={
        direction === "asc"
          ? "ascending"
          : direction === "desc"
            ? "descending"
            : "none"
      }
      className={cn(align === "right" && "text-right", className)}
    >
      <button
        type="button"
        className={cn(
          "inline-flex min-h-10 items-center gap-1.5 text-xs font-medium hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          align === "right" && "ml-auto"
        )}
        aria-label={`${label}: ${active ? `sorted ${direction === "asc" ? "ascending" : "descending"}` : "not sorted"}. Activate to sort.`}
        onClick={() => onSort(sortKey)}
      >
        <span>{label}</span>
        <span aria-hidden="true" className="text-[10px] text-muted-foreground">
          {active ? (direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </TableHead>
  )
}

function RosterTable({
  league,
  teamId,
  selectedPlayerId,
  onSelectPlayer,
  onReleasePlayer,
  isSimulating,
}: {
  league: LeagueDocument
  teamId: string
  selectedPlayerId?: string
  onSelectPlayer: (playerId: string) => void
  onReleasePlayer: (player: PlayerEntity) => void
  isSimulating: boolean
}) {
  const [query, setQuery] = React.useState("")
  const [positionFilter, setPositionFilter] =
    React.useState<PositionFilter>("all")
  const [healthFilter, setHealthFilter] = React.useState<HealthFilter>("all")
  const [contractFilter, setContractFilter] =
    React.useState<ContractFilter>("all")
  const [sort, setSort] = React.useState<SortState>({
    key: "overall",
    direction: "desc",
  })
  const players = React.useMemo(
    () => getRosterPlayers(league, teamId),
    [league, teamId]
  )

  const visiblePlayers = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const filtered = players.filter((player) => {
      const name = fullName(player).toLowerCase()
      const position = player.profile.role.primaryPosition
      const health = getPlayerHealth(league, player.id)
      const hasContract = Boolean(getPlayerContract(league, player.id))
      const matchesQuery = !normalizedQuery || name.includes(normalizedQuery)
      const matchesPosition =
        positionFilter === "all" || position === positionFilter
      const matchesHealth =
        healthFilter === "all" ||
        (healthFilter === "out" ? health.unavailable : !health.unavailable)
      const matchesContract =
        contractFilter === "all" ||
        (contractFilter === "signed" ? hasContract : !hasContract)

      return matchesQuery && matchesPosition && matchesHealth && matchesContract
    })

    return filtered.sort((left, right) => {
      const comparison = compareSortValues(
        getPlayerSortValue(league, left, sort.key),
        getPlayerSortValue(league, right, sort.key)
      )
      return sort.direction === "asc" ? comparison : -comparison
    })
  }, [
    contractFilter,
    healthFilter,
    league,
    players,
    positionFilter,
    query,
    sort,
  ])

  const activeFilterCount = [
    positionFilter !== "all",
    healthFilter !== "all",
    contractFilter !== "all",
  ].filter(Boolean).length

  function handleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    )
  }

  function clearFilters() {
    setPositionFilter("all")
    setHealthFilter("all")
    setContractFilter("all")
  }

  return (
    <section
      aria-labelledby="roster-table-heading"
      className="flex min-h-0 flex-1 flex-col border-y border-border"
    >
      <h2 id="roster-table-heading" className="sr-only">
        Team roster players
      </h2>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2.5 sm:px-4">
        <p className="text-sm font-semibold">Players</p>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          <div className="relative min-w-48 flex-1 sm:max-w-60">
            <HugeiconsIcon
              icon={Search02Icon}
              size={14}
              strokeWidth={2}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search players"
              aria-label="Search roster players"
              className="h-8 pl-8"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <HugeiconsIcon
                  icon={FilterHorizontalIcon}
                  size={14}
                  strokeWidth={2}
                  aria-hidden="true"
                />
                Filters
                {activeFilterCount > 0 ? (
                  <span className="ml-0.5 text-muted-foreground">
                    · {activeFilterCount}
                  </span>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Position</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={positionFilter}
                onValueChange={(value) =>
                  setPositionFilter(value as PositionFilter)
                }
              >
                <DropdownMenuRadioItem value="all">
                  All positions
                </DropdownMenuRadioItem>
                {POSITION_FILTERS.slice(1).map((position) => (
                  <DropdownMenuRadioItem key={position} value={position}>
                    {position}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Health</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={healthFilter}
                onValueChange={(value) =>
                  setHealthFilter(value as HealthFilter)
                }
              >
                <DropdownMenuRadioItem value="all">
                  All health statuses
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="available">
                  Available
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="out">Out</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Contract</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={contractFilter}
                onValueChange={(value) =>
                  setContractFilter(value as ContractFilter)
                }
              >
                <DropdownMenuRadioItem value="all">
                  All contracts
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="signed">
                  Signed
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="missing">
                  Missing
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              {activeFilterCount > 0 ? (
                <>
                  <DropdownMenuSeparator />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start px-2 text-xs"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </Button>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {visiblePlayers.length > 0 ? (
          <Table className="min-w-[860px]">
            <TableCaption className="sr-only">
              Team roster. Select a player to open their detail sheet.
            </TableCaption>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <SortableTableHead
                  label="Player"
                  sortKey="name"
                  sort={sort}
                  onSort={handleSort}
                  className="sticky left-0 z-20 w-[28%] bg-background"
                />
                <SortableTableHead
                  label="Pos"
                  sortKey="position"
                  sort={sort}
                  onSort={handleSort}
                />
                <SortableTableHead
                  label="Age"
                  sortKey="age"
                  sort={sort}
                  onSort={handleSort}
                  align="right"
                />
                <SortableTableHead
                  label="OVR"
                  sortKey="overall"
                  sort={sort}
                  onSort={handleSort}
                  align="right"
                />
                <TableHead>Production</TableHead>
                <TableHead>Health</TableHead>
                <SortableTableHead
                  label="Salary"
                  sortKey="salary"
                  sort={sort}
                  onSort={handleSort}
                  align="right"
                />
                <SortableTableHead
                  label="Years"
                  sortKey="years"
                  sort={sort}
                  onSort={handleSort}
                  align="right"
                />
                <TableHead className="pr-3 text-right sm:pr-4">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiblePlayers.map((player) => {
                const contract = getPlayerContract(league, player.id)
                const health = getPlayerHealth(league, player.id)
                const selected = player.id === selectedPlayerId

                return (
                  <TableRow
                    key={player.id}
                    tabIndex={0}
                    aria-selected={selected}
                    data-state={selected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
                      selected && "bg-muted"
                    )}
                    onClick={() => onSelectPlayer(player.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        onSelectPlayer(player.id)
                      }
                    }}
                  >
                    <TableCell
                      className={cn(
                        "sticky left-0 z-[1] bg-background font-medium",
                        selected && "bg-muted"
                      )}
                    >
                      {fullName(player)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {player.profile.role.primaryPosition}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {player.age}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {Math.round(getPlayerCurrentAbility(player))}
                    </TableCell>
                    <TableCell
                      className="text-muted-foreground"
                      title="Production data is not available yet."
                      aria-label="Production data is not available yet"
                    >
                      —
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        title={health.detail}
                        className={cn(health.unavailable && "text-destructive")}
                      >
                        {health.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(
                        getContractSalary(contract, league.state.season)
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {getContractYearsRemaining(
                        contract,
                        league.state.season
                      ) ?? "—"}
                    </TableCell>
                    <TableCell className="pr-3 text-right sm:pr-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isSimulating}
                        className="text-destructive hover:text-destructive"
                        onClick={(event) => {
                          event.stopPropagation()
                          onReleasePlayer(player)
                        }}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        Release
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="flex min-h-48 items-center justify-center px-4 text-center">
            <div>
              <p className="text-sm font-medium">
                No players match these filters.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Clear a filter or search for another player.
              </p>
              {activeFilterCount > 0 ? (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="mt-2 h-auto p-0 text-xs"
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-3 py-2.5 text-xs text-muted-foreground sm:px-4">
        <span>
          {visiblePlayers.length} of {players.length} players shown
        </span>
        <span className="hidden sm:inline">
          Select a row to inspect a player.
        </span>
      </div>
    </section>
  )
}

function getRoleLabel(player: PlayerEntity): string {
  const ability = getPlayerCurrentAbility(player)
  if (ability >= 85) return "Star"
  if (ability >= 78) return "Starter"
  if (ability >= 70) return "Rotation"
  return "Depth"
}

function getEditorRotation(
  league: LeagueDocument,
  teamId: string
): GameRotationInput {
  const players = getRosterPlayers(league, teamId)
  const rosterIds = new Set(players.map((player) => player.id))
  const saved = league.state.rotations?.[teamId]

  if (!saved) return createDefaultRotation(players)

  const depthOrder = [
    ...saved.depthOrder.filter((playerId) => rosterIds.has(playerId)),
    ...players
      .map((player) => player.id)
      .filter((playerId) => !saved.depthOrder.includes(playerId)),
  ]
  const starters = saved.starters.filter((playerId) => rosterIds.has(playerId))

  for (const playerId of depthOrder) {
    if (starters.length >= 5) break
    if (!starters.includes(playerId)) starters.push(playerId)
  }

  const orderedDepth = [
    ...starters,
    ...depthOrder.filter((playerId) => !starters.includes(playerId)),
  ]

  return {
    starters,
    depthOrder: orderedDepth,
    targetMinutes: Object.fromEntries(
      orderedDepth.map((playerId) => [
        playerId,
        saved.targetMinutes[playerId] ?? (starters.includes(playerId) ? 32 : 0),
      ])
    ),
  }
}

function rotationFingerprint(rotation: GameRotationInput): string {
  return JSON.stringify({
    starters: rotation.starters,
    depthOrder: rotation.depthOrder,
    targetMinutes: rotation.targetMinutes,
  })
}

function canCoverPositions(players: Array<PlayerEntity>): boolean {
  const positions = ["PG", "SG", "SF", "PF", "C"]

  function cover(positionIndex: number, used: Set<string>): boolean {
    if (positionIndex === positions.length) return true

    const position = positions[positionIndex]
    return players.some((player) => {
      if (
        used.has(player.id) ||
        (player.profile.role.primaryPosition !== position &&
          player.profile.role.secondaryPosition !== position)
      ) {
        return false
      }
      used.add(player.id)
      const covered = cover(positionIndex + 1, used)
      used.delete(player.id)
      return covered
    })
  }

  return cover(0, new Set())
}

function RotationSummary({
  league,
  teamId,
  rotation,
}: {
  league: LeagueDocument
  teamId: string
  rotation: GameRotationInput
}) {
  const players = getRosterPlayers(league, teamId)
  const byId = new Map(players.map((player) => [player.id, player]))
  const starters = rotation.starters
    .map((playerId) => byId.get(playerId))
    .filter((player): player is PlayerEntity => Boolean(player))
  const totalMinutes = rotation.depthOrder.reduce(
    (total, playerId) => total + (rotation.targetMinutes[playerId] ?? 0),
    0
  )
  const unavailableStarters = starters.filter(
    (player) => getPlayerHealth(league, player.id).unavailable
  )
  const minuteDelta = TEAM_REGULATION_MINUTES - totalMinutes
  const hasPositionCoverage = canCoverPositions(starters)

  return (
    <div className="grid shrink-0 border-b border-border sm:grid-cols-4 sm:divide-x sm:divide-border">
      <div className="border-b border-border px-3 py-3 sm:border-b-0 sm:px-4">
        <p className="text-[11px] text-muted-foreground">Starters</p>
        <p className="mt-1 text-sm font-semibold tabular-nums">
          {starters.length} / 5
        </p>
        <p className="truncate text-[10px] text-muted-foreground">
          {hasPositionCoverage ? "Position coverage ready" : "Coverage issue"}
        </p>
      </div>
      <div className="border-b border-border px-3 py-3 sm:border-b-0 sm:px-4">
        <p className="text-[11px] text-muted-foreground">Target minutes</p>
        <p
          className={cn(
            "mt-1 text-sm font-semibold tabular-nums",
            minuteDelta !== 0 && "text-destructive"
          )}
        >
          {totalMinutes} / {TEAM_REGULATION_MINUTES}
        </p>
        <p className="truncate text-[10px] text-muted-foreground">
          {minuteDelta === 0
            ? "Regulation target"
            : `${Math.abs(minuteDelta)} min ${minuteDelta > 0 ? "remaining" : "over"}`}
        </p>
      </div>
      <div className="border-b border-border px-3 py-3 sm:border-b-0 sm:px-4">
        <p className="text-[11px] text-muted-foreground">Bench order</p>
        <p className="mt-1 text-sm font-semibold tabular-nums">
          {
            rotation.depthOrder.filter(
              (playerId) => !rotation.starters.includes(playerId)
            ).length
          }
        </p>
        <p className="truncate text-[10px] text-muted-foreground">
          Ordered behind the starters
        </p>
      </div>
      <div className="px-3 py-3 sm:px-4">
        <p className="text-[11px] text-muted-foreground">Availability</p>
        <p
          className={cn(
            "mt-1 text-sm font-semibold",
            unavailableStarters.length > 0 && "text-destructive"
          )}
        >
          {unavailableStarters.length > 0
            ? `${unavailableStarters.length} starter${unavailableStarters.length === 1 ? "" : "s"} out`
            : "All starters available"}
        </p>
        <p className="truncate text-[10px] text-muted-foreground">
          Health can change actual minutes
        </p>
      </div>
    </div>
  )
}

function RotationEditor({
  league,
  teamId,
  isSaving,
  onSave,
}: {
  league: LeagueDocument
  teamId: string
  isSaving: boolean
  onSave: (rotation: GameRotationInput) => Promise<boolean>
}) {
  const savedRotation = React.useMemo(
    () => getEditorRotation(league, teamId),
    [league, teamId]
  )
  const [rotation, setRotation] =
    React.useState<GameRotationInput>(savedRotation)

  React.useEffect(() => {
    setRotation(savedRotation)
  }, [savedRotation])

  const players = React.useMemo(
    () => getRosterPlayers(league, teamId),
    [league, teamId]
  )
  const playersById = React.useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players]
  )
  const benchOrder = rotation.depthOrder.filter(
    (playerId) => !rotation.starters.includes(playerId)
  )
  const totalMinutes = rotation.depthOrder.reduce(
    (total, playerId) => total + (rotation.targetMinutes[playerId] ?? 0),
    0
  )
  const starterPlayers = rotation.starters
    .map((playerId) => playersById.get(playerId))
    .filter((player): player is PlayerEntity => Boolean(player))
  const unavailableStarters = starterPlayers.filter(
    (player) => getPlayerHealth(league, player.id).unavailable
  )
  const hasPositionCoverage = canCoverPositions(starterPlayers)
  const issues = [
    rotation.starters.length !== 5 ? "Select exactly five starters." : null,
    !hasPositionCoverage
      ? "The starters do not cover all five positions."
      : null,
    totalMinutes !== TEAM_REGULATION_MINUTES
      ? `Target minutes must total ${TEAM_REGULATION_MINUTES}.`
      : null,
    unavailableStarters.length > 0
      ? "An unavailable player is assigned to the starting five."
      : null,
  ].filter((issue): issue is string => Boolean(issue))
  const isDirty =
    rotationFingerprint(rotation) !== rotationFingerprint(savedRotation)
  const canSave = issues.length === 0 && isDirty && !isSaving

  function updateRotation(
    update: (current: GameRotationInput) => GameRotationInput
  ) {
    setRotation((current) => update(current))
  }

  function updateMinutes(playerId: string, value: string) {
    const parsed = Number(value)
    const minutes = Number.isFinite(parsed)
      ? Math.min(60, Math.max(0, Math.round(parsed)))
      : 0
    updateRotation((current) => ({
      ...current,
      targetMinutes: {
        ...current.targetMinutes,
        [playerId]: minutes,
      },
    }))
  }

  function toggleStarter(playerId: string, checked: boolean) {
    updateRotation((current) => {
      const starters = checked
        ? [...current.starters, playerId]
        : current.starters.filter((id) => id !== playerId)
      const currentBenchOrder = current.depthOrder.filter(
        (id) => !starters.includes(id)
      )
      return {
        ...current,
        starters,
        depthOrder: [...starters, ...currentBenchOrder],
      }
    })
  }

  function moveBenchPlayer(playerId: string, direction: -1 | 1) {
    updateRotation((current) => {
      const currentBenchOrder = current.depthOrder.filter(
        (id) => !current.starters.includes(id)
      )
      const index = currentBenchOrder.indexOf(playerId)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= currentBenchOrder.length) {
        return current
      }
      const nextBenchOrder = [...currentBenchOrder]
      const [moved] = nextBenchOrder.splice(index, 1)
      nextBenchOrder.splice(nextIndex, 0, moved)
      return {
        ...current,
        depthOrder: [...current.starters, ...nextBenchOrder],
      }
    })
  }

  function renderRow(
    playerId: string,
    group: "starter" | "bench",
    index: number
  ) {
    const player = playersById.get(playerId)
    if (!player) return null

    const health = getPlayerHealth(league, player.id)
    const benchIndex = group === "bench" ? benchOrder.indexOf(player.id) : -1
    const isStarter = group === "starter"

    return (
      <TableRow
        key={player.id}
        className={cn(health.unavailable && "bg-muted/40")}
      >
        <TableCell className="w-10 text-center text-xs text-muted-foreground tabular-nums">
          {isStarter ? index + 1 : benchIndex + 1}
        </TableCell>
        <TableCell className="min-w-48 font-medium">
          <div className="flex items-center gap-2">
            <span>{fullName(player)}</span>
            {health.unavailable ? (
              <Badge variant="outline" className="text-destructive">
                {health.label}
              </Badge>
            ) : null}
          </div>
        </TableCell>
        <TableCell className="whitespace-nowrap text-muted-foreground">
          {player.profile.role.primaryPosition}
          {player.profile.role.secondaryPosition
            ? ` / ${player.profile.role.secondaryPosition}`
            : ""}
        </TableCell>
        <TableCell>
          <label className="inline-flex min-h-8 items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={isStarter}
              aria-label={`${fullName(player)} starter`}
              onChange={(event) =>
                toggleStarter(player.id, event.target.checked)
              }
              className="size-3.5 accent-primary"
            />
            <span>{isStarter ? "Starter" : "Bench"}</span>
          </label>
        </TableCell>
        <TableCell className="w-28 text-right">
          <div className="ml-auto flex items-center justify-end gap-1">
            <Input
              type="number"
              min={0}
              max={60}
              step={1}
              value={rotation.targetMinutes[player.id] ?? 0}
              aria-label={`${fullName(player)} target minutes`}
              onChange={(event) => updateMinutes(player.id, event.target.value)}
              className="h-8 w-16 text-right tabular-nums"
            />
            <span className="text-[11px] text-muted-foreground">min</span>
          </div>
        </TableCell>
        <TableCell className="w-16 text-right font-medium tabular-nums">
          {Math.round(getPlayerCurrentAbility(player))}
        </TableCell>
        <TableCell className="w-24 pr-3 text-right sm:pr-4">
          {group === "bench" ? (
            <span className="inline-flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={benchIndex <= 0}
                aria-label={`Move ${fullName(player)} up in bench order`}
                title="Move up in bench order"
                onClick={() => moveBenchPlayer(player.id, -1)}
              >
                <HugeiconsIcon icon={ArrowUp01Icon} size={13} strokeWidth={2} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={benchIndex === benchOrder.length - 1}
                aria-label={`Move ${fullName(player)} down in bench order`}
                title="Move down in bench order"
                onClick={() => moveBenchPlayer(player.id, 1)}
              >
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  size={13}
                  strokeWidth={2}
                />
              </Button>
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">—</span>
          )}
        </TableCell>
      </TableRow>
    )
  }

  return (
    <section
      aria-labelledby="rotation-editor-heading"
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden border-y border-border"
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border px-3 py-3 sm:px-4">
        <div>
          <h2 id="rotation-editor-heading" className="text-sm font-semibold">
            Rotation
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Set the starting five, order the bench, and assign target minutes.
            The coach handles substitutions and game conditions can change the
            final minutes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSaving}
            onClick={() => setRotation(getEditorRotation(league, teamId))}
          >
            Reset
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canSave}
            onClick={() => void onSave(rotation)}
          >
            {isSaving ? "Saving…" : "Save rotation"}
          </Button>
        </div>
      </div>

      <RotationSummary league={league} teamId={teamId} rotation={rotation} />

      <div className="shrink-0 border-b border-border px-3 py-2.5 text-xs sm:px-4">
        {issues.length > 0 ? (
          <ul className="space-y-1 text-destructive" aria-live="polite">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : isDirty ? (
          <p className="text-muted-foreground" aria-live="polite">
            Unsaved rotation changes.
          </p>
        ) : (
          <p className="text-muted-foreground">Rotation saved.</p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <Table className="min-w-[860px]">
          <TableCaption className="sr-only">
            Set starters, bench order, and target minutes for the team rotation.
          </TableCaption>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="w-10 text-center">#</TableHead>
              <TableHead>Player</TableHead>
              <TableHead>Pos</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Target</TableHead>
              <TableHead className="text-right">OVR</TableHead>
              <TableHead className="pr-3 text-right sm:pr-4">Order</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableCell colSpan={7} className="py-2 text-[11px] font-semibold">
                Starting five
              </TableCell>
            </TableRow>
            {rotation.starters.map((playerId, index) =>
              renderRow(playerId, "starter", index)
            )}
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableCell colSpan={7} className="py-2 text-[11px] font-semibold">
                Bench order
              </TableCell>
            </TableRow>
            {benchOrder.map((playerId) => renderRow(playerId, "bench", 0))}
          </TableBody>
        </Table>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-3 py-2.5 text-xs text-muted-foreground sm:px-4">
        <span>{rotation.depthOrder.length} players listed</span>
        <span className="hidden sm:inline">
          Target minutes are normalized against a 240-minute regulation game.
        </span>
      </div>
    </section>
  )
}

function DetailMetric({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  )
}

function PlayerSheet({
  league,
  player,
  onOpenChange,
  onSetRotation,
}: {
  league: LeagueDocument
  player?: PlayerEntity
  onOpenChange: (open: boolean) => void
  onSetRotation: () => void
}) {
  const contract = player ? getPlayerContract(league, player.id) : undefined
  const health = player ? getPlayerHealth(league, player.id) : undefined
  const ability = player ? Math.round(getPlayerCurrentAbility(player)) : null
  const playerEvents = player
    ? league.history.events
        .filter((event) =>
          event.entityRefs.some((reference) => reference.id === player.id)
        )
        .slice(-3)
        .reverse()
    : []

  return (
    <Sheet open={Boolean(player)} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[min(100vw,32rem)] max-w-none overflow-y-auto p-0 sm:max-w-none"
      >
        {player ? (
          <>
            <SheetHeader className="border-b border-border px-5 py-5 pr-14 sm:px-6">
              <SheetTitle className="text-base font-semibold">
                {fullName(player)}
              </SheetTitle>
              <SheetDescription>
                {player.profile.role.primaryPosition} · {getRoleLabel(player)} ·{" "}
                <span
                  className={cn(
                    health?.unavailable ? "text-destructive" : "text-foreground"
                  )}
                >
                  {health?.label}
                </span>
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col px-5 sm:px-6">
              <section
                className="border-b border-border py-5"
                aria-labelledby="player-overview-heading"
              >
                <h2
                  id="player-overview-heading"
                  className="text-xs font-semibold"
                >
                  Overview
                </h2>
                <dl className="mt-3 divide-y divide-border text-xs">
                  <DetailMetric label="Overall" value={ability ?? "—"} />
                  <DetailMetric label="Age" value={player.age} />
                  <DetailMetric
                    label="Position"
                    value={player.profile.role.primaryPosition}
                  />
                  <DetailMetric
                    label="Secondary"
                    value={player.profile.role.secondaryPosition ?? "—"}
                  />
                  <DetailMetric
                    label="Potential"
                    value={player.profile.development.potential}
                  />
                </dl>
              </section>

              <section
                className="border-b border-border py-5"
                aria-labelledby="player-skills-heading"
              >
                <h2
                  id="player-skills-heading"
                  className="text-xs font-semibold"
                >
                  Skill snapshot
                </h2>
                <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 text-xs">
                  {[
                    ["Shooting", player.profile.skills.shooting],
                    ["Finishing", player.profile.skills.finishing],
                    ["Passing", player.profile.skills.passing],
                    ["Handling", player.profile.skills.handling],
                    ["Rebounding", player.profile.skills.rebounding],
                    ["Defense", player.profile.skills.defense],
                    ["Basketball IQ", player.profile.skills.basketballIQ],
                    ["Stamina", player.profile.skills.stamina],
                  ].map(([label, value]) => (
                    <div
                      key={label as string}
                      className="flex items-center justify-between gap-3"
                    >
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-medium tabular-nums">
                        {ratingGrade(value as number)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section
                className="border-b border-border py-5"
                aria-labelledby="player-production-heading"
              >
                <h2
                  id="player-production-heading"
                  className="text-xs font-semibold"
                >
                  Recent production
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  No game sample yet. Production will populate after the league
                  simulates games.
                </p>
              </section>

              <section
                className="border-b border-border py-5"
                aria-labelledby="player-contract-heading"
              >
                <h2
                  id="player-contract-heading"
                  className="text-xs font-semibold"
                >
                  Contract
                </h2>
                <dl className="mt-3 divide-y divide-border text-xs">
                  <DetailMetric
                    label="Salary"
                    value={formatMoney(
                      getContractSalary(contract, league.state.season)
                    )}
                  />
                  <DetailMetric
                    label="Years remaining"
                    value={
                      getContractYearsRemaining(
                        contract,
                        league.state.season
                      ) ?? "—"
                    }
                  />
                  <DetailMetric
                    label="Contract source"
                    value={
                      typeof contract?.source === "string"
                        ? titleCase(contract.source)
                        : "—"
                    }
                  />
                </dl>
              </section>

              <section
                className="border-b border-border py-5"
                aria-labelledby="player-value-heading"
              >
                <h2 id="player-value-heading" className="text-xs font-semibold">
                  Player value
                </h2>
                <dl className="mt-3 divide-y divide-border text-xs">
                  <DetailMetric
                    label="Current ability"
                    value={ability ?? "—"}
                  />
                  <DetailMetric
                    label="Market signal"
                    value={
                      ability !== null
                        ? ability >= 80
                          ? "Strong"
                          : "Developing"
                        : "—"
                    }
                  />
                  <DetailMetric
                    label="Durability"
                    value={player.profile.injuryResistance}
                  />
                </dl>
              </section>

              <section className="py-5" aria-labelledby="player-events-heading">
                <h2
                  id="player-events-heading"
                  className="text-xs font-semibold"
                >
                  Recent events
                </h2>
                {playerEvents.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                    {playerEvents.map((event) => (
                      <li key={event.id}>{event.summary}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    No player-specific events recorded.
                  </p>
                )}
              </section>
            </div>

            <SheetFooter className="sticky bottom-0 border-t border-border bg-background/95 px-5 py-4 backdrop-blur-sm sm:px-6">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button onClick={onSetRotation}>Set rotation</Button>
                <Button
                  variant="outline"
                  disabled
                  title="Transaction commands are not enabled in the current league slice."
                >
                  Add to trade
                </Button>
                <Button
                  variant="outline"
                  disabled
                  title="Contract commands are not enabled in the current league slice."
                >
                  Review contract
                </Button>
              </div>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function getRemainingContractValue(
  league: LeagueDocument,
  playerId: string
): number {
  const contract = getPlayerContract(league, playerId)
  const yearsRemaining = getContractYearsRemaining(
    contract,
    league.state.season
  )

  const years = typeof yearsRemaining === "number" ? yearsRemaining : 0
  if (!contract || years <= 0) return 0

  return Array.from(
    { length: years },
    (_, index) => getContractSalary(contract, league.state.season + index) ?? 0
  ).reduce((sum, salary) => sum + salary, 0)
}

function ReleasePlayerDialog({
  league,
  player,
  isReleasing,
  onOpenChange,
  onConfirm,
}: {
  league: LeagueDocument
  player?: PlayerEntity
  isReleasing: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
}) {
  const remainingSalary = player
    ? getRemainingContractValue(league, player.id)
    : 0

  return (
    <AlertDialog open={Boolean(player)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Release {player ? fullName(player) : "this player"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This immediately removes the player from your roster and makes them
            a free agent. Their remaining contract stays on your books as dead
            money until another team signs them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center justify-between gap-4 rounded-md bg-muted px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            Remaining contract value
          </span>
          <span className="font-semibold tabular-nums">
            {formatMillions(remainingSalary)}
          </span>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isReleasing}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isReleasing}
            onClick={onConfirm}
          >
            Release player
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function TeamRosterPage() {
  const { playerId, tab = "roster" } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const {
    league,
    teamId,
    handleReleasePlayer,
    handleSetRotation,
    isSimulating,
  } = useLeagueShell()
  const [releasePlayer, setReleasePlayer] = React.useState<PlayerEntity>()
  const rosterPlayerIds = league.entities.teams[teamId].rosterPlayerIds ?? []
  const selectedPlayer =
    playerId && rosterPlayerIds.includes(playerId)
      ? league.entities.players[playerId]
      : undefined

  function selectPlayer(nextPlayerId: string) {
    void navigate({
      search: (previous) => ({ ...previous, playerId: nextPlayerId }),
    })
  }

  function closePlayer() {
    void navigate({
      search: (previous) => ({ ...previous, playerId: undefined }),
    })
  }

  function changeTab(nextTab: string) {
    if (!ROSTER_TABS.includes(nextTab as RosterTab)) return
    void navigate({
      search: (previous) => ({
        ...previous,
        tab: nextTab as RosterTab,
        playerId: nextTab === "rotation" ? undefined : previous.playerId,
      }),
    })
  }

  async function confirmRelease() {
    if (!releasePlayer) return

    const completed = await handleReleasePlayer(releasePlayer.id)
    if (completed) setReleasePlayer(undefined)
  }

  return (
    <>
      <div className="mx-auto flex min-h-0 w-full max-w-[96rem] flex-1 flex-col overflow-y-auto px-4 py-3 sm:px-6 lg:overflow-hidden lg:px-8">
        <RosterSummary league={league} teamId={teamId} />
        <Tabs
          value={tab}
          onValueChange={changeTab}
          className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
        >
          <div className="shrink-0 border-b border-border">
            <TabsList variant="line" className="h-10 px-1 sm:px-2">
              <TabsTrigger value="roster" className="h-full px-3">
                Roster
              </TabsTrigger>
              <TabsTrigger value="rotation" className="h-full px-3">
                Rotation
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent
            value="roster"
            className="mt-0 min-h-0 flex-1 overflow-hidden"
          >
            <RosterTable
              league={league}
              teamId={teamId}
              selectedPlayerId={selectedPlayer?.id}
              onSelectPlayer={selectPlayer}
              onReleasePlayer={setReleasePlayer}
              isSimulating={isSimulating}
            />
          </TabsContent>
          <TabsContent
            value="rotation"
            className="mt-0 min-h-0 flex-1 overflow-hidden"
          >
            <RotationEditor
              league={league}
              teamId={teamId}
              isSaving={isSimulating}
              onSave={(rotation) => handleSetRotation(rotation)}
            />
          </TabsContent>
        </Tabs>
      </div>

      <PlayerSheet
        league={league}
        player={selectedPlayer}
        onOpenChange={(open) => {
          if (!open) closePlayer()
        }}
        onSetRotation={() => {
          closePlayer()
          changeTab("rotation")
        }}
      />
      <ReleasePlayerDialog
        league={league}
        player={releasePlayer}
        isReleasing={isSimulating}
        onOpenChange={(open) => {
          if (!open && !isSimulating) setReleasePlayer(undefined)
        }}
        onConfirm={confirmRelease}
      />
    </>
  )
}
