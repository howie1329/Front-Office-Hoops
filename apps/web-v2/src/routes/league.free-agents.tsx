import { createFileRoute, useNavigate } from "@tanstack/react-router"
import * as React from "react"

import { FilterHorizontalIcon, Search02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { PlayerEntity } from "@workspace/domain-v2"
import {
  getFreeAgencyWindowStatus,
  projectCurrentFreeAgents,
  projectTeamFinance,
} from "@workspace/sim-v2"
import type {
  CurrentFreeAgentProjection,
  TeamFinanceProjection,
} from "@workspace/sim-v2"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

export const Route = createFileRoute("/league/free-agents")({
  validateSearch: (
    search: Record<string, unknown>
  ): { saveId?: string; playerId?: string } => {
    const saveId = typeof search.saveId === "string" ? search.saveId : undefined
    const playerId =
      typeof search.playerId === "string" ? search.playerId : undefined

    return { saveId, playerId }
  },
  component: TeamFreeAgentsPage,
})

const ROSTER_LIMIT = 15
const POSITION_FILTERS = ["all", "PG", "SG", "SF", "PF", "C"] as const
const RATING_FILTERS = ["all", "60-plus", "70-plus", "80-plus"] as const
const POTENTIAL_FILTERS = ["all", "60-plus", "70-plus", "80-plus"] as const
const AGE_FILTERS = ["all", "25-under", "26-30", "31-plus"] as const
const CONTRACT_FILTERS = ["all", "under-5", "5-to-10", "10-plus"] as const
const SORT_KEYS = [
  "name",
  "age",
  "position",
  "overall",
  "potential",
  "expectedAnnualSalary",
  "expectedYears",
] as const

type PositionFilter = (typeof POSITION_FILTERS)[number]
type RatingFilter = (typeof RATING_FILTERS)[number]
type PotentialFilter = (typeof POTENTIAL_FILTERS)[number]
type AgeFilter = (typeof AGE_FILTERS)[number]
type ContractFilter = (typeof CONTRACT_FILTERS)[number]
type SortKey = (typeof SORT_KEYS)[number]
type SortDirection = "asc" | "desc"
type SortState = { key: SortKey; direction: SortDirection }

type FreeAgentRow = {
  player: PlayerEntity
  projection: CurrentFreeAgentProjection
}

function fullName(player: PlayerEntity): string {
  return [player.identity.firstName, player.identity.lastName]
    .filter(Boolean)
    .join(" ")
}

function formatMoney(value: number): string {
  if (value === 0) return "$0"

  const sign = value < 0 ? "-" : ""
  const absolute = Math.abs(value)
  if (absolute >= 1_000_000) {
    return `${sign}$${(absolute / 1_000_000).toFixed(1)}M`
  }
  if (absolute >= 1_000) {
    return `${sign}$${Math.round(absolute / 1_000)}K`
  }
  return `${sign}$${Math.round(absolute)}`
}

function formatMoneyInput(value: number): string {
  return String(Math.round(value))
}

function contractLabel(projection: CurrentFreeAgentProjection): string {
  return `${formatMoney(projection.expectedAnnualSalary)} × ${projection.expectedYears} yrs`
}

function filterLabel(value: string): string {
  return value
    .replace("-plus", "+")
    .replace("-under", " or under")
    .replace("-to-", "–")
    .replace("under-", "Under ")
    .replace("5-to-10", "$5M–$10M")
    .replace("10-plus", "$10M+")
    .replace("all", "All")
}

function getSortValue(row: FreeAgentRow, key: SortKey): string | number {
  switch (key) {
    case "name":
      return fullName(row.player)
    case "age":
      return row.player.age
    case "position":
      return row.player.profile.role.primaryPosition
    case "overall":
      return row.projection.overall
    case "potential":
      return row.projection.potential
    case "expectedAnnualSalary":
      return row.projection.expectedAnnualSalary
    case "expectedYears":
      return row.projection.expectedYears
  }
}

function compareValues(left: string | number, right: string | number): number {
  if (typeof left === "string" && typeof right === "string") {
    return left.localeCompare(right)
  }
  return Number(left) - Number(right)
}

function matchesRating(
  value: number,
  filter: RatingFilter | PotentialFilter
): boolean {
  if (filter === "all") return true
  const threshold = Number(filter.split("-")[0])
  return value >= threshold
}

function matchesAge(age: number, filter: AgeFilter): boolean {
  if (filter === "all") return true
  if (filter === "25-under") return age <= 25
  if (filter === "26-30") return age >= 26 && age <= 30
  return age >= 31
}

function matchesContract(salary: number, filter: ContractFilter): boolean {
  if (filter === "all") return true
  if (filter === "under-5") return salary < 5_000_000
  if (filter === "5-to-10") return salary >= 5_000_000 && salary < 10_000_000
  return salary >= 10_000_000
}

function FreeAgencySummary({
  finance,
  openSpots,
  rosterFull,
  window,
}: {
  finance: TeamFinanceProjection
  openSpots: number
  rosterFull: boolean
  window: ReturnType<typeof getFreeAgencyWindowStatus>
}) {
  const current = finance.seasons[0]
  const metrics = [
    ["Signing window", window.label, window.detail],
    [
      "Open roster spots",
      rosterFull ? "Full" : String(openSpots),
      `of ${ROSTER_LIMIT}`,
    ],
    ["Cap room", formatMoney(current.capRoom), "Informational"],
    ["Tax room", formatMoney(current.taxRoom), "Informational"],
  ] as const

  return (
    <section
      className="shrink-0 border-b border-border"
      aria-label="Free agency summary"
    >
      <dl className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
        {metrics.map(([label, value, detail], index) => (
          <div key={label} className={cn("py-2.5 pr-4", index > 0 && "pl-4")}>
            <dt className="text-[11px] text-muted-foreground">{label}</dt>
            <dd
              className={cn(
                "mt-0.5 truncate text-sm font-semibold tabular-nums",
                label === "Signing window" &&
                  (window.open ? "text-foreground" : "text-muted-foreground"),
                label === "Open roster spots" &&
                  rosterFull &&
                  "text-destructive",
                (label === "Cap room" || label === "Tax room") &&
                  Number(value.replace(/[$MK,]/g, "")) < 0 &&
                  "text-destructive"
              )}
            >
              {value}
            </dd>
            <p className="truncate text-[10px] text-muted-foreground">
              {detail}
            </p>
          </div>
        ))}
      </dl>
    </section>
  )
}

function SortableHead({
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
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex min-h-8 items-center gap-1 text-[11px] font-medium hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          align === "right" && "ml-auto"
        )}
        aria-label={`${label}: ${active ? `sorted ${direction === "asc" ? "ascending" : "descending"}` : "not sorted"}. Activate to sort.`}
      >
        {label}
        <span aria-hidden="true" className="text-[10px] text-muted-foreground">
          {active ? (direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </TableHead>
  )
}

function FiltersMenu({
  positionFilter,
  ratingFilter,
  potentialFilter,
  ageFilter,
  contractFilter,
  onPositionChange,
  onRatingChange,
  onPotentialChange,
  onAgeChange,
  onContractChange,
  activeFilterCount,
}: {
  positionFilter: PositionFilter
  ratingFilter: RatingFilter
  potentialFilter: PotentialFilter
  ageFilter: AgeFilter
  contractFilter: ContractFilter
  onPositionChange: (value: PositionFilter) => void
  onRatingChange: (value: RatingFilter) => void
  onPotentialChange: (value: PotentialFilter) => void
  onAgeChange: (value: AgeFilter) => void
  onContractChange: (value: ContractFilter) => void
  activeFilterCount: number
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5">
          <HugeiconsIcon
            icon={FilterHorizontalIcon}
            size={14}
            strokeWidth={2}
            aria-hidden="true"
          />
          Filters
          {activeFilterCount > 0 ? (
            <Badge
              variant="secondary"
              className="ml-0.5 h-4 min-w-4 px-1 text-[10px]"
            >
              {activeFilterCount}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-[min(70vh,30rem)] w-64 overflow-y-auto"
      >
        <DropdownMenuLabel>Position</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={positionFilter}
          onValueChange={(value) => onPositionChange(value as PositionFilter)}
        >
          {POSITION_FILTERS.map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {value === "all" ? "All positions" : value}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Overall</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={ratingFilter}
          onValueChange={(value) => onRatingChange(value as RatingFilter)}
        >
          {RATING_FILTERS.map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {value === "all"
                ? "All ratings"
                : `${filterLabel(value)} overall`}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Potential</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={potentialFilter}
          onValueChange={(value) => onPotentialChange(value as PotentialFilter)}
        >
          {POTENTIAL_FILTERS.map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {value === "all"
                ? "All potential"
                : `${filterLabel(value)} potential`}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Age</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={ageFilter}
          onValueChange={(value) => onAgeChange(value as AgeFilter)}
        >
          {AGE_FILTERS.map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {value === "all" ? "All ages" : filterLabel(value)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Expected salary</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={contractFilter}
          onValueChange={(value) => onContractChange(value as ContractFilter)}
        >
          {CONTRACT_FILTERS.map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {value === "all" ? "All estimates" : filterLabel(value)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function FreeAgentTable({
  rows,
  selectedPlayerId,
  canOffer,
  offerDisabledReason,
  onSelectPlayer,
  onOffer,
}: {
  rows: Array<FreeAgentRow>
  selectedPlayerId?: string
  canOffer: boolean
  offerDisabledReason: string
  onSelectPlayer: (playerId: string) => void
  onOffer: (row: FreeAgentRow) => void
}) {
  const [query, setQuery] = React.useState("")
  const [positionFilter, setPositionFilter] =
    React.useState<PositionFilter>("all")
  const [ratingFilter, setRatingFilter] = React.useState<RatingFilter>("all")
  const [potentialFilter, setPotentialFilter] =
    React.useState<PotentialFilter>("all")
  const [ageFilter, setAgeFilter] = React.useState<AgeFilter>("all")
  const [contractFilter, setContractFilter] =
    React.useState<ContractFilter>("all")
  const [sort, setSort] = React.useState<SortState>({
    key: "expectedAnnualSalary",
    direction: "desc",
  })

  const activeFilterCount = [
    positionFilter,
    ratingFilter,
    potentialFilter,
    ageFilter,
    contractFilter,
  ].filter((value) => value !== "all").length

  const visibleRows = rows
    .filter((row) => {
      const normalizedQuery = query.trim().toLowerCase()
      const matchesQuery = normalizedQuery
        ? fullName(row.player).toLowerCase().includes(normalizedQuery) ||
          row.player.profile.role.primaryPosition
            .toLowerCase()
            .includes(normalizedQuery)
        : true
      const matchesPosition =
        positionFilter === "all" ||
        row.player.profile.role.primaryPosition === positionFilter
      return (
        matchesQuery &&
        matchesPosition &&
        matchesRating(row.projection.overall, ratingFilter) &&
        matchesRating(row.projection.potential, potentialFilter) &&
        matchesAge(row.player.age, ageFilter) &&
        matchesContract(row.projection.expectedAnnualSalary, contractFilter)
      )
    })
    .sort((left, right) => {
      const comparison = compareValues(
        getSortValue(left, sort.key),
        getSortValue(right, sort.key)
      )
      return sort.direction === "asc" ? comparison : -comparison
    })

  function handleSort(key: SortKey) {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }))
  }

  return (
    <section
      className="flex min-h-0 flex-1 flex-col border-y border-border"
      aria-labelledby="free-agents-heading"
    >
      <div className="shrink-0 border-b border-border px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 id="free-agents-heading" className="text-sm font-semibold">
            Current free agents
          </h2>
          <div className="flex w-full gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-52">
              <HugeiconsIcon
                icon={Search02Icon}
                size={14}
                strokeWidth={2}
                aria-hidden="true"
                className="absolute top-1/2 left-2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search players"
                aria-label="Search free agents"
                className="h-8 pl-7"
              />
            </div>
            <FiltersMenu
              positionFilter={positionFilter}
              ratingFilter={ratingFilter}
              potentialFilter={potentialFilter}
              ageFilter={ageFilter}
              contractFilter={contractFilter}
              onPositionChange={setPositionFilter}
              onRatingChange={setRatingFilter}
              onPotentialChange={setPotentialFilter}
              onAgeChange={setAgeFilter}
              onContractChange={setContractFilter}
              activeFilterCount={activeFilterCount}
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {visibleRows.length > 0 ? (
          <TooltipProvider>
            <Table className="min-w-[900px]">
              <TableCaption className="sr-only">
                Current free agents and projected contract expectations.
              </TableCaption>
              <TableHeader className="sticky top-0 z-20 bg-background">
                <TableRow>
                  <SortableHead
                    label="Player"
                    sortKey="name"
                    sort={sort}
                    onSort={handleSort}
                    className="sticky left-0 z-30 bg-background pl-3 sm:pl-4"
                  />
                  <SortableHead
                    label="Age"
                    sortKey="age"
                    sort={sort}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortableHead
                    label="Pos"
                    sortKey="position"
                    sort={sort}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="OVR"
                    sortKey="overall"
                    sort={sort}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortableHead
                    label="POT"
                    sortKey="potential"
                    sort={sort}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortableHead
                    label="Expected contract"
                    sortKey="expectedAnnualSalary"
                    sort={sort}
                    onSort={handleSort}
                    align="right"
                  />
                  <TableHead className="pr-3 text-right sm:pr-4">
                    Offer
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((row) => {
                  const selected = row.player.id === selectedPlayerId
                  return (
                    <TableRow
                      key={row.player.id}
                      data-state={selected ? "selected" : undefined}
                    >
                      <TableCell className="sticky left-0 z-10 bg-background pl-3 font-medium sm:pl-4">
                        <button
                          type="button"
                          onClick={() => onSelectPlayer(row.player.id)}
                          className="text-left hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          {fullName(row.player)}
                        </button>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.player.age}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.player.profile.role.primaryPosition}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {row.projection.overall}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {row.projection.potential}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className="font-medium">
                          {contractLabel(row.projection)}
                        </span>
                        <span className="ml-2 text-[10px] text-muted-foreground">
                          {formatMoney(row.projection.lowAnnualSalary)}–
                          {formatMoney(row.projection.highAnnualSalary)}
                        </span>
                      </TableCell>
                      <TableCell className="pr-3 text-right sm:pr-4">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <Button
                                type="button"
                                size="sm"
                                variant={canOffer ? "default" : "outline"}
                                disabled={!canOffer}
                                onClick={() => onOffer(row)}
                              >
                                Offer
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {!canOffer ? (
                            <TooltipContent>
                              {offerDisabledReason}
                            </TooltipContent>
                          ) : null}
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TooltipProvider>
        ) : (
          <div className="grid min-h-48 place-items-center px-5 text-center">
            <div>
              <p className="text-sm font-medium">
                {rows.length === 0
                  ? "No free agents are currently available."
                  : "No players match these filters."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {rows.length === 0
                  ? "The available player pool will update as the league changes."
                  : "Clear a filter or search for another player."}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-3 py-2.5 text-xs text-muted-foreground sm:px-4">
        <span>Market estimates are projected annual values.</span>
        <span className="hidden sm:inline">
          Select a name to inspect the player.
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

function FreeAgentPlayerSheet({
  row,
  onOpenChange,
}: {
  row?: FreeAgentRow
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={Boolean(row)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-md">
        {row ? (
          <>
            <SheetHeader className="border-b border-border px-5 py-5 pr-14 sm:px-6">
              <SheetTitle className="text-base font-semibold">
                {fullName(row.player)}
              </SheetTitle>
              <SheetDescription>
                {row.player.profile.role.primaryPosition} · current free agent
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col px-5 sm:px-6">
              <section
                className="border-b border-border py-5"
                aria-labelledby="free-agent-overview-heading"
              >
                <h2
                  id="free-agent-overview-heading"
                  className="text-xs font-semibold"
                >
                  Overview
                </h2>
                <dl className="mt-3 divide-y divide-border text-xs">
                  <DetailMetric
                    label="Overall"
                    value={row.projection.overall}
                  />
                  <DetailMetric
                    label="Potential"
                    value={row.projection.potential}
                  />
                  <DetailMetric label="Age" value={row.player.age} />
                  <DetailMetric
                    label="Position"
                    value={row.player.profile.role.primaryPosition}
                  />
                  <DetailMetric
                    label="Secondary"
                    value={row.player.profile.role.secondaryPosition ?? "—"}
                  />
                </dl>
              </section>
              <section
                className="border-b border-border py-5"
                aria-labelledby="free-agent-market-heading"
              >
                <h2
                  id="free-agent-market-heading"
                  className="text-xs font-semibold"
                >
                  Market estimate
                </h2>
                <dl className="mt-3 divide-y divide-border text-xs">
                  <DetailMetric
                    label="Expected annual value"
                    value={formatMoney(row.projection.expectedAnnualSalary)}
                  />
                  <DetailMetric
                    label="Expected length"
                    value={`${row.projection.expectedYears} years`}
                  />
                  <DetailMetric
                    label="Expected total value"
                    value={formatMoney(row.projection.expectedTotalValue)}
                  />
                  <DetailMetric
                    label="Estimated range"
                    value={`${formatMoney(row.projection.lowAnnualSalary)}–${formatMoney(row.projection.highAnnualSalary)}`}
                  />
                </dl>
              </section>
              <section
                className="py-5"
                aria-labelledby="free-agent-skills-heading"
              >
                <h2
                  id="free-agent-skills-heading"
                  className="text-xs font-semibold"
                >
                  Skill snapshot
                </h2>
                <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 text-xs">
                  {[
                    ["Shooting", row.player.profile.skills.shooting],
                    ["Finishing", row.player.profile.skills.finishing],
                    ["Passing", row.player.profile.skills.passing],
                    ["Handling", row.player.profile.skills.handling],
                    ["Rebounding", row.player.profile.skills.rebounding],
                    ["Defense", row.player.profile.skills.defense],
                    ["Basketball IQ", row.player.profile.skills.basketballIQ],
                    ["Stamina", row.player.profile.skills.stamina],
                  ].map(([label, value]) => (
                    <div
                      key={label as string}
                      className="flex items-center justify-between gap-3"
                    >
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-medium tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function OfferSheet({
  row,
  finance,
  onOpenChange,
}: {
  row?: FreeAgentRow
  finance: TeamFinanceProjection
  onOpenChange: (open: boolean) => void
}) {
  const [years, setYears] = React.useState(1)
  const [annualSalary, setAnnualSalary] = React.useState(0)

  React.useEffect(() => {
    if (!row) return
    setYears(row.projection.expectedYears)
    setAnnualSalary(row.projection.expectedAnnualSalary)
  }, [row])

  const annualSalaries = Array.from(
    { length: years },
    (_, index) => Math.round((annualSalary * 1.05 ** index) / 100_000) * 100_000
  )
  const totalValue = annualSalaries.reduce((sum, salary) => sum + salary, 0)
  const projectedPayroll =
    (finance.seasons[0]?.payroll ?? 0) + (annualSalaries[0] ?? 0)

  return (
    <Sheet open={Boolean(row)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-md">
        {row ? (
          <>
            <SheetHeader className="border-b border-border px-5 py-5 pr-14 sm:px-6">
              <SheetTitle className="text-base font-semibold">
                Offer contract
              </SheetTitle>
              <SheetDescription>
                {fullName(row.player)} ·{" "}
                {row.player.profile.role.primaryPosition} · OVR{" "}
                {row.projection.overall}
              </SheetDescription>
            </SheetHeader>
            <div className="px-5 sm:px-6">
              <section
                className="border-b border-border py-5"
                aria-labelledby="offer-terms-heading"
              >
                <h2 id="offer-terms-heading" className="text-xs font-semibold">
                  Offer terms
                </h2>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="grid gap-1.5 text-xs">
                    <span className="text-muted-foreground">Years</span>
                    <Input
                      type="number"
                      min={1}
                      max={4}
                      step={1}
                      value={years}
                      onChange={(event) =>
                        setYears(
                          Math.min(
                            4,
                            Math.max(1, Number(event.target.value) || 1)
                          )
                        )
                      }
                      inputMode="numeric"
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs">
                    <span className="text-muted-foreground">Annual salary</span>
                    <Input
                      type="number"
                      min={0}
                      step={100_000}
                      value={formatMoneyInput(annualSalary)}
                      onChange={(event) =>
                        setAnnualSalary(
                          Math.max(0, Number(event.target.value) || 0)
                        )
                      }
                      inputMode="decimal"
                    />
                  </label>
                </div>
              </section>
              <section
                className="border-b border-border py-5"
                aria-labelledby="offer-impact-heading"
              >
                <h2 id="offer-impact-heading" className="text-xs font-semibold">
                  Projected impact
                </h2>
                <dl className="mt-3 divide-y divide-border text-xs">
                  <DetailMetric
                    label="Expected annual value"
                    value={formatMoney(row.projection.expectedAnnualSalary)}
                  />
                  <DetailMetric
                    label="Total contract value"
                    value={formatMoney(totalValue)}
                  />
                  <DetailMetric
                    label="First-year payroll"
                    value={formatMoney(projectedPayroll)}
                  />
                  <DetailMetric
                    label="Cap room after offer"
                    value={formatMoney(
                      (finance.seasons[0]?.softCap ?? 0) - projectedPayroll
                    )}
                  />
                </dl>
              </section>
              <section
                className="py-5"
                aria-labelledby="offer-schedule-heading"
              >
                <h2
                  id="offer-schedule-heading"
                  className="text-xs font-semibold"
                >
                  Salary schedule
                </h2>
                <dl className="mt-3 divide-y divide-border text-xs">
                  {annualSalaries.map((salary, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <dt className="text-muted-foreground">
                        Season {index + 1}
                      </dt>
                      <dd className="font-medium tabular-nums">
                        {formatMoney(salary)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
              <p className="pb-5 text-xs text-muted-foreground">
                Cap room is informational. The roster must have an open spot
                before this offer can be submitted.
              </p>
            </div>
            <SheetFooter className="sticky bottom-0 border-t border-border bg-background/95 px-5 py-4 backdrop-blur-sm sm:px-6">
              <Button
                disabled
                title="Offer commands are not enabled in this V2 slice."
              >
                Make offer
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                Offer submission will be connected to the league command flow
                next.
              </p>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function TeamFreeAgentsPage() {
  const { playerId } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { league, teamId } = useLeagueShell()
  const [offerRow, setOfferRow] = React.useState<FreeAgentRow>()
  const finance = React.useMemo(
    () => projectTeamFinance(league, teamId, 5),
    [league, teamId]
  )
  const projectionByPlayerId = React.useMemo(
    () =>
      new Map(
        projectCurrentFreeAgents(league).map((projection) => [
          projection.playerId,
          projection,
        ])
      ),
    [league]
  )
  const rows = React.useMemo(
    () =>
      Object.values(league.entities.players)
        .filter((player) => player.leagueStatus.kind === "free-agent")
        .map((player) => {
          const projection = projectionByPlayerId.get(player.id)
          return projection ? { player, projection } : null
        })
        .filter((row): row is FreeAgentRow => Boolean(row)),
    [league.entities.players, projectionByPlayerId]
  )
  const selectedRow = playerId
    ? rows.find((row) => row.player.id === playerId)
    : undefined
  const rosterCount = league.entities.teams[teamId].rosterPlayerIds?.length ?? 0
  const rosterFull = rosterCount >= ROSTER_LIMIT
  const openSpots = Math.max(0, ROSTER_LIMIT - rosterCount)
  const window = getFreeAgencyWindowStatus(league)
  const canOffer = window.open && !rosterFull
  const offerDisabledReason = rosterFull
    ? "No open roster spots. Clear a roster spot before signing a player."
    : `${window.detail}. Offers are unavailable while the signing window is closed.`

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

  return (
    <>
      <div className="mx-auto flex min-h-0 w-full max-w-[96rem] flex-1 flex-col overflow-y-auto px-4 py-3 sm:px-6 lg:overflow-hidden lg:px-8">
        <FreeAgencySummary
          finance={finance}
          openSpots={openSpots}
          rosterFull={rosterFull}
          window={window}
        />
        <div className="flex min-h-0 flex-1 flex-col pt-3">
          <FreeAgentTable
            rows={rows}
            selectedPlayerId={selectedRow?.player.id}
            canOffer={canOffer}
            offerDisabledReason={offerDisabledReason}
            onSelectPlayer={selectPlayer}
            onOffer={(row) => setOfferRow(row)}
          />
        </div>
      </div>
      <FreeAgentPlayerSheet
        row={selectedRow}
        onOpenChange={(open) => {
          if (!open) closePlayer()
        }}
      />
      <OfferSheet
        row={offerRow}
        finance={finance}
        onOpenChange={(open) => {
          if (!open) setOfferRow(undefined)
        }}
      />
    </>
  )
}
