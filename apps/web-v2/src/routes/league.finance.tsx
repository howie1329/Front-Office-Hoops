import { createFileRoute, useNavigate } from "@tanstack/react-router"
import * as React from "react"

import { FilterHorizontalIcon, Search02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { LeagueDocument, PlayerEntity } from "@workspace/domain-v2"
import { projectTeamFinance } from "@workspace/sim-v2"
import type {
  FinanceContractProjection,
  FinanceSeasonProjection,
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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useLeagueShell } from "@/components/league-shell"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/league/finance")({
  validateSearch: (
    search: Record<string, unknown>
  ): { saveId?: string; playerId?: string } => {
    const saveId = typeof search.saveId === "string" ? search.saveId : undefined
    const playerId =
      typeof search.playerId === "string" ? search.playerId : undefined

    return { saveId, playerId }
  },
  component: TeamFinancePage,
})

const FILTERS = ["all", "expiring", "long-term"] as const
const SORT_KEYS = [
  "name",
  "position",
  "years",
  "capPercent",
  "season0",
  "season1",
  "season2",
  "season3",
  "season4",
  "total",
] as const

type FinanceFilter = (typeof FILTERS)[number]
type FinanceSortKey = (typeof SORT_KEYS)[number]
type SortDirection = "asc" | "desc"
type SortState = { key: FinanceSortKey; direction: SortDirection }

type FinanceRow = {
  player: PlayerEntity
  name: string
  position: string
  contract: FinanceContractProjection
  salaries: Array<number>
  capPercent: number
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

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

function formatSeasonLabel(league: LeagueDocument, season: number): string {
  const currentYear = Number(league.state.calendar.currentDate.slice(0, 4))
  return String(currentYear + season - league.state.season)
}

function getRows(
  league: LeagueDocument,
  teamId: string,
  projection: TeamFinanceProjection
): Array<FinanceRow> {
  const contractByPlayerId = new Map(
    projection.contracts.map((contract) => [contract.playerId, contract])
  )
  const currentSoftCap = projection.seasons[0].softCap

  return (league.entities.teams[teamId].rosterPlayerIds ?? [])
    .map((playerId) => league.entities.players[playerId])
    .filter((player): player is PlayerEntity => Boolean(player))
    .map((player) => {
      const contract = contractByPlayerId.get(player.id) ?? {
        contractId: null,
        playerId: player.id,
        annualSalary: [],
        years: 0,
        startSeason: null,
        endSeason: null,
        totalValue: 0,
        source: null,
        expiringSeason: null,
      }
      const salaries = Array.from(
        { length: projection.horizon },
        (_, index) => {
          const season = projection.currentSeason + index
          if (
            contract.startSeason === null ||
            contract.endSeason === null ||
            season < contract.startSeason ||
            season > contract.endSeason
          ) {
            return 0
          }
          return contract.annualSalary[season - contract.startSeason] ?? 0
        }
      )

      return {
        player,
        name: fullName(player),
        position: player.profile.role.primaryPosition,
        contract,
        salaries,
        capPercent: currentSoftCap
          ? ((salaries[0] ?? 0) / currentSoftCap) * 100
          : 0,
      }
    })
}

function compareValues(left: string | number, right: string | number): number {
  if (typeof left === "string" && typeof right === "string") {
    return left.localeCompare(right)
  }
  return Number(left) - Number(right)
}

function getSortValue(row: FinanceRow, key: FinanceSortKey): string | number {
  switch (key) {
    case "name":
      return row.name
    case "position":
      return row.position
    case "years":
      return row.contract.years
    case "capPercent":
      return row.capPercent
    case "total":
      return row.contract.totalValue
    default:
      return row.salaries[Number(key.slice("season".length))] ?? 0
  }
}

function FinanceSummary({ projection }: { projection: TeamFinanceProjection }) {
  const current = projection.seasons[0]
  const next = projection.seasons[1] ?? current
  const metrics = [
    ["Current payroll", current.payroll],
    ["Projected next season", next.payroll],
    ["Cap room", current.capRoom],
    ["Tax room", current.taxRoom],
    ["Dead money", current.deadMoney],
  ] as const

  return (
    <section
      className="shrink-0 border-b border-border"
      aria-label="Finance summary"
    >
      <dl className="grid grid-cols-2 divide-x divide-border sm:grid-cols-5">
        {metrics.map(([label, value], index) => (
          <div
            key={label}
            className={cn(
              "py-2.5 pr-4",
              index > 0 && "pl-4",
              index === 4 && "col-span-2 sm:col-span-1"
            )}
          >
            <dt className="text-[11px] text-muted-foreground">{label}</dt>
            <dd
              className={cn(
                "mt-0.5 text-sm font-semibold tabular-nums",
                (label === "Cap room" || label === "Tax room") &&
                  value < 0 &&
                  "text-destructive"
              )}
            >
              {formatMoney(value)}
            </dd>
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
  sortKey: FinanceSortKey
  sort: SortState
  onSort: (key: FinanceSortKey) => void
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

function SalaryMatrix({
  league,
  projection,
  rows,
  selectedPlayerId,
  onSelectPlayer,
}: {
  league: LeagueDocument
  projection: TeamFinanceProjection
  rows: Array<FinanceRow>
  selectedPlayerId?: string
  onSelectPlayer: (playerId: string) => void
}) {
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<FinanceFilter>("all")
  const [sort, setSort] = React.useState<SortState>({
    key: "season0",
    direction: "desc",
  })

  const filteredRows = rows
    .filter((row) => {
      const normalizedQuery = query.trim().toLowerCase()
      const matchesQuery = normalizedQuery
        ? row.name.toLowerCase().includes(normalizedQuery) ||
          row.position.toLowerCase().includes(normalizedQuery)
        : true
      const matchesFilter =
        filter === "all" ||
        (filter === "expiring" && row.contract.expiringSeason !== null) ||
        (filter === "long-term" && row.contract.years >= 3)
      return matchesQuery && matchesFilter
    })
    .sort((left, right) => {
      const comparison = compareValues(
        getSortValue(left, sort.key),
        getSortValue(right, sort.key)
      )
      return sort.direction === "asc" ? comparison : -comparison
    })

  function handleSort(key: FinanceSortKey) {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }))
  }

  const totals = projection.seasons.map((season) =>
    rows.reduce(
      (sum, row) =>
        sum + (row.salaries[season.season - projection.currentSeason] ?? 0),
      0
    )
  )
  const totalContractValue = rows.reduce(
    (sum, row) => sum + row.contract.totalValue,
    0
  )

  return (
    <section
      className="flex min-h-0 flex-col border-y border-border"
      aria-labelledby="salary-commitments-heading"
    >
      <div className="shrink-0 border-b border-border px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[11px] text-muted-foreground">
              Projected commitments
            </p>
            <h2
              id="salary-commitments-heading"
              className="text-sm font-semibold"
            >
              Salary matrix
            </h2>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-48">
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
                aria-label="Search salary commitments"
                className="h-8 pl-7"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 gap-1.5"
                >
                  <HugeiconsIcon
                    icon={FilterHorizontalIcon}
                    size={14}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Show contracts</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={filter}
                  onValueChange={(value) => {
                    if (FILTERS.includes(value as FinanceFilter)) {
                      setFilter(value as FinanceFilter)
                    }
                  }}
                >
                  <DropdownMenuRadioItem value="all">
                    All players
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="expiring">
                    Expiring in horizon
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="long-term">
                    Three years or more
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Five-season projection · {filteredRows.length} of {rows.length}{" "}
          players
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {filteredRows.length > 0 ? (
          <Table className="min-w-[940px]">
            <TableCaption className="sr-only">
              Projected team salary commitments by player and season.
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
                  label="Pos"
                  sortKey="position"
                  sort={sort}
                  onSort={handleSort}
                />
                <SortableHead
                  label="Years"
                  sortKey="years"
                  sort={sort}
                  onSort={handleSort}
                  align="right"
                />
                <SortableHead
                  label="Cap %"
                  sortKey="capPercent"
                  sort={sort}
                  onSort={handleSort}
                  align="right"
                />
                {projection.seasons.map((season, index) => (
                  <SortableHead
                    key={season.season}
                    label={
                      index === 0
                        ? `${formatSeasonLabel(league, season.season)} · Now`
                        : formatSeasonLabel(league, season.season)
                    }
                    sortKey={`season${index}` as FinanceSortKey}
                    sort={sort}
                    onSort={handleSort}
                    align="right"
                    className={cn(index === 0 && "bg-muted/50")}
                  />
                ))}
                <SortableHead
                  label="Total"
                  sortKey="total"
                  sort={sort}
                  onSort={handleSort}
                  align="right"
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow
                  key={row.player.id}
                  data-state={
                    selectedPlayerId === row.player.id ? "selected" : undefined
                  }
                >
                  <TableCell className="sticky left-0 z-10 bg-background pl-3 font-medium sm:pl-4">
                    <button
                      type="button"
                      onClick={() => onSelectPlayer(row.player.id)}
                      className="text-left hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {row.name}
                    </button>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.position}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.contract.years || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPercent(row.capPercent)}
                  </TableCell>
                  {row.salaries.map((salary, index) => (
                    <TableCell
                      key={`${row.player.id}-${index}`}
                      className={cn(
                        "text-right tabular-nums",
                        index === 0 && "bg-muted/50 font-medium"
                      )}
                    >
                      {salary ? formatMoney(salary) : "—"}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-medium tabular-nums">
                    {row.contract.totalValue
                      ? formatMoney(row.contract.totalValue)
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="sticky bottom-0 z-20 bg-muted/95 backdrop-blur-sm">
              <TableRow>
                <TableCell className="sticky left-0 z-30 bg-muted/95 pl-3 font-semibold sm:pl-4">
                  Total
                </TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums">
                  {rows.length}
                </TableCell>
                <TableCell />
                {totals.map((total, index) => (
                  <TableCell
                    key={`total-${index}`}
                    className={cn(
                      "text-right font-semibold tabular-nums",
                      index === 0 && "bg-muted"
                    )}
                  >
                    {formatMoney(total)}
                  </TableCell>
                ))}
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatMoney(totalContractValue)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        ) : (
          <div className="grid min-h-48 place-items-center px-5 text-center">
            <div>
              <p className="text-sm font-medium">
                No commitments match this view.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Clear the search or filter to see the full salary matrix.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function linePoints(
  values: Array<number>,
  maxValue: number,
  width: number,
  height: number
): string {
  const left = 12
  const right = width - 12
  const top = 10
  const bottom = height - 24
  const step = values.length > 1 ? (right - left) / (values.length - 1) : 0

  return values
    .map((value, index) => {
      const x = left + step * index
      const y = bottom - (value / maxValue) * (bottom - top)
      return `${x},${y}`
    })
    .join(" ")
}

function CapOutlook({
  league,
  seasons,
}: {
  league: LeagueDocument
  seasons: Array<FinanceSeasonProjection>
}) {
  const maxValue =
    Math.max(
      ...seasons.flatMap((season) => [
        season.softCap,
        season.taxLine,
        season.payroll,
        season.deadMoney,
      ]),
      1
    ) * 1.08
  const width = 520
  const height = 190
  const series = [
    {
      label: "Payroll",
      color: "var(--foreground)",
      values: seasons.map((season) => season.payroll),
    },
    {
      label: "Soft cap",
      color: "var(--chart-2)",
      values: seasons.map((season) => season.softCap),
    },
    {
      label: "Tax line",
      color: "var(--chart-3)",
      values: seasons.map((season) => season.taxLine),
    },
    {
      label: "Dead money",
      color: "var(--destructive)",
      values: seasons.map((season) => season.deadMoney),
    },
  ]

  return (
    <section
      className="flex min-h-0 flex-col border-y border-border"
      aria-labelledby="cap-outlook-heading"
    >
      <div className="shrink-0 border-b border-border px-3 py-2.5 sm:px-4">
        <p className="text-[11px] text-muted-foreground">Five-season outlook</p>
        <h2 id="cap-outlook-heading" className="text-sm font-semibold">
          Cap outlook
        </h2>
      </div>
      <div className="min-h-0 flex-1 px-3 py-2.5 sm:px-4">
        <div
          className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground"
          aria-hidden="true"
        >
          {series.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5">
              <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </span>
          ))}
        </div>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Projected payroll compared with the soft cap, tax line, and dead money over five seasons"
          className="mt-1 h-36 w-full overflow-visible"
        >
          {[0, 0.5, 1].map((ratio) => {
            const y = 10 + (height - 34) * ratio
            return (
              <line
                key={ratio}
                x1="12"
                x2={width - 12}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeDasharray="2 4"
              />
            )
          })}
          {series.map((item) => (
            <polyline
              key={item.label}
              points={linePoints(item.values, maxValue, width, height)}
              fill="none"
              stroke={item.color}
              strokeWidth={item.label === "Payroll" ? 2.5 : 1.5}
              strokeDasharray={item.label === "Dead money" ? "3 3" : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {seasons.map((season, index) => {
            const x =
              12 +
              (seasons.length > 1 ? (width - 24) / (seasons.length - 1) : 0) *
                index
            return (
              <text
                key={season.season}
                x={x}
                y={height - 7}
                textAnchor={
                  index === 0
                    ? "start"
                    : index === seasons.length - 1
                      ? "end"
                      : "middle"
                }
                fill="var(--muted-foreground)"
                fontSize="10"
              >
                {formatSeasonLabel(league, season.season)}
              </text>
            )
          })}
        </svg>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-2 text-[10px] sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Current payroll</p>
            <p className="mt-0.5 font-medium tabular-nums">
              {formatMoney(seasons[0]?.payroll ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Dead money</p>
            <p
              className={cn(
                "mt-0.5 font-medium tabular-nums",
                (seasons[0]?.deadMoney ?? 0) > 0 && "text-destructive"
              )}
            >
              {formatMoney(seasons[0]?.deadMoney ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Soft cap</p>
            <p className="mt-0.5 font-medium tabular-nums">
              {formatMoney(seasons[0]?.softCap ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Tax line</p>
            <p className="mt-0.5 font-medium tabular-nums">
              {formatMoney(seasons[0]?.taxLine ?? 0)}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function FinanceAttention({
  league,
  projection,
  rows,
}: {
  league: LeagueDocument
  projection: TeamFinanceProjection
  rows: Array<FinanceRow>
}) {
  const expiring = rows
    .filter((row) => row.contract.expiringSeason !== null)
    .sort(
      (left, right) =>
        (left.contract.expiringSeason ?? 99) -
        (right.contract.expiringSeason ?? 99)
    )
    .slice(0, 3)
  const largest = [...rows]
    .sort((left, right) => (right.salaries[0] ?? 0) - (left.salaries[0] ?? 0))
    .slice(0, 3)
  const deadMoneySeasons = projection.seasons.filter(
    (season) => season.deadMoney > 0
  )

  return (
    <section
      className="flex min-h-0 flex-col border-y border-border"
      aria-labelledby="finance-attention-heading"
    >
      <div className="shrink-0 border-b border-border px-3 py-2.5 sm:px-4">
        <p className="text-[11px] text-muted-foreground">Planning queue</p>
        <h2 id="finance-attention-heading" className="text-sm font-semibold">
          Finance attention
        </h2>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 sm:px-4">
        <div className="border-b border-border py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium">Largest commitments</p>
            <Badge variant="outline">
              {formatSeasonLabel(league, projection.currentSeason)}
            </Badge>
          </div>
          <ul className="mt-1.5 divide-y divide-border text-xs">
            {largest.map((row) => (
              <li
                key={row.player.id}
                className="flex items-center justify-between gap-3 py-1.5"
              >
                <span className="truncate">{row.name}</span>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatMoney(row.salaries[0] ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-b border-border py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium">Expiring in horizon</p>
            <Badge variant="outline">{expiring.length}</Badge>
          </div>
          {expiring.length > 0 ? (
            <ul className="mt-1.5 divide-y divide-border text-xs">
              {expiring.map((row) => (
                <li
                  key={row.player.id}
                  className="flex items-center justify-between gap-3 py-1.5"
                >
                  <span className="truncate">{row.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {formatSeasonLabel(
                      league,
                      row.contract.expiringSeason ?? projection.currentSeason
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">
              No contract expirations are recorded in the current view.
            </p>
          )}
        </div>
        <div className="py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium">Dead money</p>
            <Badge variant={deadMoneySeasons.length > 0 ? "secondary" : "outline"}>
              {formatMoney(projection.seasons[0]?.deadMoney ?? 0)} now
            </Badge>
          </div>
          {deadMoneySeasons.length > 0 ? (
            <ul className="mt-1.5 divide-y divide-border text-xs">
              {deadMoneySeasons.map((season) => (
                <li
                  key={season.season}
                  className="flex items-center justify-between gap-3 py-1.5"
                >
                  <span className="text-muted-foreground">
                    {formatSeasonLabel(league, season.season)}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatMoney(season.deadMoney)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">
              No dead-money obligations are recorded in the current projection.
            </p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Option years are not modeled yet.
          </p>
        </div>
      </div>
    </section>
  )
}

function ContractSheet({
  league,
  row,
  projection,
  onOpenChange,
}: {
  league: LeagueDocument
  row?: FinanceRow
  projection: TeamFinanceProjection
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={Boolean(row)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {row ? (
          <>
            <SheetHeader className="border-b border-border px-5 py-5 sm:px-6">
              <SheetTitle>{row.name}</SheetTitle>
              <SheetDescription>
                {row.position} · projected contract commitments
              </SheetDescription>
            </SheetHeader>
            <div className="px-5 sm:px-6">
              <section className="border-b border-border py-4">
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Current cap share</dt>
                    <dd className="mt-0.5 font-medium tabular-nums">
                      {formatPercent(row.capPercent)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Total value</dt>
                    <dd className="mt-0.5 font-medium tabular-nums">
                      {formatMoney(row.contract.totalValue)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Years</dt>
                    <dd className="mt-0.5 font-medium tabular-nums">
                      {row.contract.years || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Source</dt>
                    <dd className="mt-0.5 font-medium">
                      {row.contract.source ?? "—"}
                    </dd>
                  </div>
                </dl>
              </section>
              <section
                className="py-4"
                aria-labelledby="contract-schedule-heading"
              >
                <h2
                  id="contract-schedule-heading"
                  className="text-xs font-semibold"
                >
                  Salary schedule
                </h2>
                <dl className="mt-3 divide-y divide-border text-xs">
                  {projection.seasons.map((season, index) => (
                    <div
                      key={season.season}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <dt className="text-muted-foreground">
                        {formatSeasonLabel(league, season.season)}
                      </dt>
                      <dd className="font-medium tabular-nums">
                        {row.salaries[index]
                          ? formatMoney(row.salaries[index] ?? 0)
                          : "—"}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
              <p className="pb-5 text-xs text-muted-foreground">
                Salary figures are projected from the current league contract
                data. Contract actions are not enabled yet.
              </p>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function TeamFinancePage() {
  const { playerId } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { league, teamId } = useLeagueShell()
  const projection = React.useMemo(
    () => projectTeamFinance(league, teamId, 5),
    [league, teamId]
  )
  const rows = React.useMemo(
    () => getRows(league, teamId, projection),
    [league, projection, teamId]
  )
  const selectedRow = playerId
    ? rows.find((row) => row.player.id === playerId)
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

  return (
    <>
      <div className="mx-auto flex min-h-0 w-full max-w-[96rem] flex-1 flex-col overflow-y-auto px-4 py-3 sm:px-6 lg:overflow-hidden lg:px-8">
        <FinanceSummary projection={projection} />
        <div className="grid min-h-0 flex-1 gap-3 pt-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.75fr)]">
          <SalaryMatrix
            league={league}
            projection={projection}
            rows={rows}
            selectedPlayerId={selectedRow?.player.id}
            onSelectPlayer={selectPlayer}
          />
          <div className="grid min-h-0 gap-3 lg:grid-rows-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
            <CapOutlook league={league} seasons={projection.seasons} />
            <FinanceAttention
              league={league}
              projection={projection}
              rows={rows}
            />
          </div>
        </div>
      </div>
      <ContractSheet
        league={league}
        row={selectedRow}
        projection={projection}
        onOpenChange={(open) => {
          if (!open) closePlayer()
        }}
      />
    </>
  )
}
