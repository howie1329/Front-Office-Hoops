import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import * as React from "react"

import {
  ArrowRight01Icon,
  Calendar01Icon,
  ChartLineIcon,
  DashboardSquare01Icon,
  FilterHorizontalIcon,
  Search02Icon,
  SaveIcon,
  UserGroupIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type {
  JsonRecord,
  LeagueDocument,
  PlayerEntity,
  PlayerPosition,
} from "@workspace/domain-v2"
import { V2LeagueRepository } from "@workspace/db-v2"
import {
  getLifecycleActionState,
  getPlayerCurrentAbility,
} from "@workspace/sim-v2"

import { Alert, AlertDescription } from "@/components/ui/alert"
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
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
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { LeagueContextHeader } from "@/components/league-context-header"
import { useLeagueSimulation } from "@/lib/leagueLifecycle"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/league/roster")({
  validateSearch: (
    search: Record<string, unknown>
  ): { saveId?: string; playerId?: string } => {
    const saveId = typeof search.saveId === "string" ? search.saveId : undefined
    const playerId =
      typeof search.playerId === "string" ? search.playerId : undefined

    return { saveId, playerId }
  },
  component: TeamRosterPage,
})

const repository = new V2LeagueRepository()

const POSITION_ORDER: Array<PlayerPosition> = ["PG", "SG", "SF", "PF", "C"]
const POSITION_FILTERS = ["all", "guards", "wings", "bigs"] as const
const SORT_OPTIONS = ["overall", "name", "salary"] as const

type PositionFilter = (typeof POSITION_FILTERS)[number]
type SortOption = (typeof SORT_OPTIONS)[number]

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

function getPayroll(league: LeagueDocument, teamId: string): number | null {
  const payroll = league.projections.payroll.find(
    (row) => row.teamId === teamId
  )
  return numericField(payroll, "payroll")
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

function getPositionGroup(
  position: PlayerPosition
): Exclude<PositionFilter, "all"> {
  if (position === "PG" || position === "SG") return "guards"
  if (position === "SF" || position === "PF") return "wings"
  return "bigs"
}

function getProjectedRotation(players: Array<PlayerEntity>) {
  const sorted = [...players].sort(
    (left, right) =>
      getPlayerCurrentAbility(right) - getPlayerCurrentAbility(left)
  )
  const used = new Set<string>()

  return POSITION_ORDER.map((position) => {
    const player =
      sorted.find(
        (candidate) =>
          !used.has(candidate.id) &&
          (candidate.profile.role.primaryPosition === position ||
            candidate.profile.role.secondaryPosition === position)
      ) ?? sorted.find((candidate) => !used.has(candidate.id))

    if (player) used.add(player.id)
    return { position, player }
  })
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

function getTeamGroupNames(league: LeagueDocument, teamId: string) {
  const team = league.entities.teams[teamId]
  const division = team.divisionId
    ? league.state.structure?.divisions.find(
        (item) => item.id === team.divisionId
      )
    : undefined
  const conference = division?.conferenceId
    ? league.state.structure?.conferences.find(
        (item) => item.id === division.conferenceId
      )
    : undefined

  return { division, conference }
}

function SidebarNav({
  league,
  teamId,
}: {
  league: LeagueDocument
  teamId: string
}) {
  const team = league.entities.teams[teamId]
  const { conference, division } = getTeamGroupNames(league, teamId)
  const teamMark = team.name.slice(0, 2).toUpperCase()

  return (
    <Sidebar
      className="relative border-r border-border bg-muted/20"
      collapsible="offcanvas"
    >
      <SidebarHeader className="gap-0 border-b border-border px-4 py-3">
        <Link
          to="/"
          className="truncate text-[13px] font-semibold tracking-[-0.02em] transition-colors hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          Front Office Hoops <span className="text-muted-foreground">/ V2</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <div className="border-b border-border px-4 py-4">
          <p className="text-[11px] font-medium text-muted-foreground">
            League
          </p>
          <div className="mt-2 flex min-w-0 items-center gap-3">
            <div
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-[10px] font-semibold tracking-[0.04em] text-primary-foreground"
            >
              {teamMark}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {league.metadata.name}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {team.name} · {conference?.name ?? "Conference"}
              </p>
            </div>
          </div>
          <p className="mt-3 truncate text-[11px] text-muted-foreground">
            {division?.name ?? "Division not set"}
          </p>
        </div>

        <SidebarGroup className="px-2 py-3">
          <SidebarGroupLabel className="h-6 px-2 text-[11px] font-semibold text-sidebar-foreground/60">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild size="sm" className="h-8">
                  <Link to="/league" search={{ saveId: league.metadata.id }}>
                    <HugeiconsIcon
                      icon={DashboardSquare01Icon}
                      size={15}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    Dashboard
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="px-2 py-1">
          <SidebarGroupLabel className="h-6 px-2 text-[11px] font-semibold text-sidebar-foreground/60">
            Team
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive size="sm" className="h-8">
                  <Link
                    to="/league/roster"
                    search={{ saveId: league.metadata.id }}
                  >
                    <HugeiconsIcon
                      icon={UserGroupIcon}
                      size={15}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    Roster
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  disabled
                  size="sm"
                  className="h-8 justify-between"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <HugeiconsIcon
                      icon={Calendar01Icon}
                      size={15}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span className="truncate">Schedule</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-medium">Soon</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="px-2 py-1">
          <SidebarGroupLabel className="h-6 px-2 text-[11px] font-semibold text-sidebar-foreground/60">
            League
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  disabled
                  size="sm"
                  className="h-8 justify-between"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <HugeiconsIcon
                      icon={ChartLineIcon}
                      size={15}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span className="truncate">Standings</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-medium">Soon</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  disabled
                  size="sm"
                  className="h-8 justify-between"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <HugeiconsIcon
                      icon={Wallet01Icon}
                      size={15}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span className="truncate">Transactions</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-medium">Soon</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-3 border-t border-border px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-muted-foreground/50"
          />
          <span className="truncate">League saved locally</span>
        </div>
        <Link
          to="/league"
          search={{ saveId: league.metadata.id }}
          className="inline-flex min-h-7 items-center gap-2 text-xs font-medium text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            size={14}
            strokeWidth={2}
            aria-hidden="true"
          />
          Return to dashboard
        </Link>
        <Link
          to="/league/start"
          className="inline-flex min-h-7 items-center gap-2 text-xs font-medium text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <HugeiconsIcon
            icon={SaveIcon}
            size={14}
            strokeWidth={2}
            aria-hidden="true"
          />
          Manage saves
        </Link>
      </SidebarFooter>
    </Sidebar>
  )
}

function RosterSummary({
  league,
  teamId,
}: {
  league: LeagueDocument
  teamId: string
}) {
  const team = league.entities.teams[teamId]
  const roster = (team.rosterPlayerIds ?? [])
    .map((playerId) => league.entities.players[playerId])
    .filter((player): player is PlayerEntity => Boolean(player))
  const payroll = getPayroll(league, teamId)

  const metrics = [
    { label: "Payroll", value: formatMillions(payroll) },
    { label: "Roster spots", value: `${roster.length} / 15` },
    { label: "Two-way", value: "—" },
    { label: "Legality", value: "Legal" },
  ]

  return (
    <section aria-labelledby="roster-heading">
      <div className="border-b border-border pb-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            Team operations
          </p>
          <h1
            id="roster-heading"
            className="mt-1 text-2xl font-semibold tracking-[-0.03em]"
          >
            Roster
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Review the active roster, player context, and current team
            readiness.
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 divide-x divide-y divide-border border-b border-border sm:grid-cols-4 sm:divide-y-0">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="min-w-0 px-3 py-3 first:pl-0 sm:px-4 lg:first:pl-0"
          >
            <dt className="truncate text-[11px] text-muted-foreground">
              {metric.label}
            </dt>
            <dd
              className={cn(
                "mt-1 text-sm font-semibold tabular-nums",
                metric.label === "Legality" && "text-foreground"
              )}
            >
              {metric.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function RosterAlert({
  league,
  teamId,
}: {
  league: LeagueDocument
  teamId: string
}) {
  const rosterCount = league.entities.teams[teamId].rosterPlayerIds?.length ?? 0
  const message =
    rosterCount > 15
      ? "This roster exceeds the standard 15-player limit. Transactions are blocked until it is legal."
      : "The roster is legal. The rotation preview is projected from current players until rotation commands are enabled."

  return (
    <Alert className="mt-4 rounded-md border-border bg-muted/20 px-3 py-2.5">
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3 text-foreground">
        <span>{message}</span>
        <Badge variant="outline">
          {rosterCount > 15 ? "Action needed" : "Roster legal"}
        </Badge>
      </AlertDescription>
    </Alert>
  )
}

function TeamTabs() {
  return (
    <Tabs defaultValue="roster" className="mt-5">
      <TabsList
        variant="line"
        className="w-full justify-start overflow-x-auto sm:w-fit"
      >
        <TabsTrigger value="roster">Roster</TabsTrigger>
        <TabsTrigger value="rotation" disabled>
          Rotation
        </TabsTrigger>
        <TabsTrigger value="contracts" disabled>
          Contracts
        </TabsTrigger>
        <TabsTrigger value="staff" disabled>
          Staff
        </TabsTrigger>
        <TabsTrigger value="owner-goals" disabled>
          Owner Goals
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

function RosterTable({
  league,
  teamId,
  selectedPlayerId,
  onSelectPlayer,
}: {
  league: LeagueDocument
  teamId: string
  selectedPlayerId?: string
  onSelectPlayer: (playerId: string) => void
}) {
  const [query, setQuery] = React.useState("")
  const [positionFilter, setPositionFilter] =
    React.useState<PositionFilter>("all")
  const [sortBy, setSortBy] = React.useState<SortOption>("overall")
  const team = league.entities.teams[teamId]
  const players = (team.rosterPlayerIds ?? [])
    .map((playerId) => league.entities.players[playerId])
    .filter((player): player is PlayerEntity => Boolean(player))

  const visiblePlayers = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const filtered = players.filter((player) => {
      const name = fullName(player).toLowerCase()
      const position = player.profile.role.primaryPosition
      const matchesQuery = !normalizedQuery || name.includes(normalizedQuery)
      const matchesPosition =
        positionFilter === "all" ||
        getPositionGroup(position) === positionFilter
      return matchesQuery && matchesPosition
    })

    return filtered.sort((left, right) => {
      if (sortBy === "name")
        return fullName(left).localeCompare(fullName(right))
      if (sortBy === "salary") {
        const leftSalary =
          numericField(getPlayerContract(league, left.id), "salary") ?? 0
        const rightSalary =
          numericField(getPlayerContract(league, right.id), "salary") ?? 0
        return rightSalary - leftSalary
      }
      return getPlayerCurrentAbility(right) - getPlayerCurrentAbility(left)
    })
  }, [league, players, positionFilter, query, sortBy])

  return (
    <section
      aria-labelledby="roster-table-heading"
      className="mt-5 border-y border-border"
    >
      <div className="flex flex-col gap-3 border-b border-border px-0 py-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Current players
          </p>
          <h2
            id="roster-table-heading"
            className="mt-1 text-lg font-semibold tracking-[-0.02em]"
          >
            Standard roster
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1 sm:flex-none">
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
              className="h-8 pl-8 sm:w-52"
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
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Position group</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={positionFilter}
                onValueChange={(value) =>
                  setPositionFilter(value as PositionFilter)
                }
              >
                <DropdownMenuRadioItem value="all">
                  All players
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="guards">
                  Guards
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="wings">
                  Wings
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="bigs">Bigs</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={sortBy}
                onValueChange={(value) => setSortBy(value as SortOption)}
              >
                <DropdownMenuRadioItem value="overall">
                  Overall
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="salary">
                  Salary
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table className="min-w-[760px]">
          <TableCaption className="sr-only">
            Team roster. Select a player to open their detail sheet.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%]">Player</TableHead>
              <TableHead>Pos</TableHead>
              <TableHead className="text-right">Age</TableHead>
              <TableHead className="text-right">OVR</TableHead>
              <TableHead>Production</TableHead>
              <TableHead>Health</TableHead>
              <TableHead className="text-right">Salary</TableHead>
              <TableHead className="text-right">Years</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <tbody>
            {visiblePlayers.map((player) => {
              const contract = getPlayerContract(league, player.id)
              const health = getPlayerHealth(league, player.id)
              const selected = player.id === selectedPlayerId

              return (
                <tr
                  key={player.id}
                  tabIndex={0}
                  aria-selected={selected}
                  data-state={selected ? "selected" : undefined}
                  className={cn(
                    "cursor-pointer border-b transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
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
                  <td className="p-2 align-middle whitespace-nowrap">
                    <span className="font-medium">{fullName(player)}</span>
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      {player.profile.role.primaryArchetype.replaceAll(
                        "_",
                        " "
                      )}
                    </span>
                  </td>
                  <td className="p-2 align-middle whitespace-nowrap text-muted-foreground">
                    {player.profile.role.primaryPosition}
                  </td>
                  <td className="p-2 text-right align-middle whitespace-nowrap tabular-nums">
                    {player.age}
                  </td>
                  <td className="p-2 text-right align-middle font-medium whitespace-nowrap tabular-nums">
                    {Math.round(getPlayerCurrentAbility(player))}
                  </td>
                  <td
                    className="p-2 align-middle whitespace-nowrap text-muted-foreground"
                    title="Production data will populate after games are simulated"
                  >
                    —
                  </td>
                  <td className="p-2 align-middle whitespace-nowrap">
                    <Badge
                      variant="outline"
                      className={cn(health.unavailable && "text-destructive")}
                    >
                      {health.label}
                    </Badge>
                  </td>
                  <td className="p-2 text-right align-middle whitespace-nowrap tabular-nums">
                    {formatMoney(numericField(contract, "salary"))}
                  </td>
                  <td className="p-2 text-right align-middle whitespace-nowrap tabular-nums">
                    {numericField(contract, "yearsRemaining") ?? "—"}
                  </td>
                  <td className="p-2 align-middle whitespace-nowrap text-muted-foreground">
                    {getRoleLabel(player)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-0 py-3 text-xs text-muted-foreground">
        <span>
          {visiblePlayers.length} of {players.length} players shown
        </span>
        <span>Click a row or press Enter to inspect a player.</span>
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

function RotationPreview({
  league,
  teamId,
}: {
  league: LeagueDocument
  teamId: string
}) {
  const players = (league.entities.teams[teamId].rosterPlayerIds ?? [])
    .map((playerId) => league.entities.players[playerId])
    .filter((player): player is PlayerEntity => Boolean(player))
  const rotation = getProjectedRotation(players)

  return (
    <section
      aria-labelledby="rotation-preview-heading"
      className="mt-5 border-y border-border"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border py-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Projected from current roster
          </p>
          <h2
            id="rotation-preview-heading"
            className="mt-1 text-lg font-semibold tracking-[-0.02em]"
          >
            Rotation preview
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          No rotation command saved
        </p>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-5 sm:divide-y-0">
        {rotation.map(({ position, player }) => (
          <div key={position} className="min-h-24 px-3 py-3 sm:px-4">
            <p className="text-[11px] font-medium text-muted-foreground">
              {position}
            </p>
            {player ? (
              <>
                <p className="mt-3 truncate text-sm font-medium">
                  {fullName(player)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  OVR {Math.round(getPlayerCurrentAbility(player))}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No player</p>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-3 text-xs text-muted-foreground">
        <span>
          Minutes will be assigned when rotation management is enabled.
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled
          title="Rotation commands are not enabled in the current league slice."
        >
          Configure rotation
        </Button>
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
}: {
  league: LeagueDocument
  player?: PlayerEntity
  onOpenChange: (open: boolean) => void
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
                    value={formatMoney(numericField(contract, "salary"))}
                  />
                  <DetailMetric
                    label="Years remaining"
                    value={numericField(contract, "yearsRemaining") ?? "—"}
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
                <Button
                  disabled
                  title="Rotation commands are not enabled in the current league slice."
                >
                  Set rotation
                </Button>
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

function TeamRosterPage() {
  const { saveId, playerId } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [league, setLeague] = React.useState<LeagueDocument | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const { handleAdvanceDay, isSimulating, simulationError } =
    useLeagueSimulation({ league, repository, setLeague })

  React.useEffect(() => {
    let active = true

    async function loadLeague() {
      try {
        const id = saveId ?? (await repository.list())[0]?.id
        const document = id ? await repository.load(id) : null

        if (!active) return
        if (!document)
          setError("That league could not be found in this browser.")
        else setLeague(document)
      } catch {
        if (active)
          setError("That league could not be loaded from this browser.")
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadLeague()
    return () => {
      active = false
    }
  }, [saveId])

  if (isLoading) {
    return (
      <main className="grid min-h-svh place-items-center bg-background px-5 text-sm text-muted-foreground">
        <div className="grid w-full max-w-sm gap-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </main>
    )
  }

  if (error || !league) {
    return (
      <main className="min-h-svh bg-background px-5 py-8 text-foreground sm:px-8 lg:px-12">
        <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-10">
          <Link
            to="/league/start"
            className="w-fit text-sm text-muted-foreground underline underline-offset-8 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Back to saves
          </Link>
          <Empty className="items-start rounded-none border-y border-border px-0 py-12 text-left">
            <EmptyHeader className="items-start text-left">
              <EmptyTitle>Roster unavailable.</EmptyTitle>
              <EmptyDescription>
                {error ?? "No league is selected."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </main>
    )
  }

  const teamId = league.state.userTeamId
  if (!teamId) {
    return (
      <main className="min-h-svh bg-background px-5 py-8 text-foreground sm:px-8 lg:px-12">
        <div className="mx-auto flex min-h-[80vh] w-full max-w-[88rem] items-center">
          <Empty className="items-start rounded-none border-y border-border px-0 py-12 text-left">
            <EmptyHeader className="items-start text-left">
              <EmptyTitle>Select a team to open the roster.</EmptyTitle>
              <EmptyDescription>
                This league is generated, but it does not have an active team
                yet.
              </EmptyDescription>
            </EmptyHeader>
            <Button asChild className="mt-4">
              <Link to="/league/start">Back to saves</Link>
            </Button>
          </Empty>
        </div>
      </main>
    )
  }

  const advanceAction = getLifecycleActionState(league, "advance-day")

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

  return (
    <main className="min-h-svh bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <SidebarProvider className="min-h-svh">
        <SidebarNav league={league} teamId={teamId} />
        <SidebarInset className="min-h-0">
          <LeagueContextHeader
            league={league}
            teamId={teamId}
            pageLabel="Team / Roster"
            advanceAction={advanceAction}
            isSimulating={isSimulating}
            onAdvanceDay={() => void handleAdvanceDay()}
          />
          {simulationError ? (
            <div className="border-b border-border px-5 py-2 sm:px-8 lg:px-10">
              <Alert variant="destructive" className="py-2">
                <AlertDescription>{simulationError}</AlertDescription>
              </Alert>
            </div>
          ) : null}
          <div className="mx-auto w-full max-w-[96rem] px-4 py-5 sm:px-6 lg:px-8">
            <RosterSummary league={league} teamId={teamId} />
            <RosterAlert league={league} teamId={teamId} />
            <TeamTabs />
            <RosterTable
              league={league}
              teamId={teamId}
              selectedPlayerId={selectedPlayer?.id}
              onSelectPlayer={selectPlayer}
            />
            <RotationPreview league={league} teamId={teamId} />
          </div>
        </SidebarInset>
      </SidebarProvider>

      <PlayerSheet
        league={league}
        player={selectedPlayer}
        onOpenChange={(open) => {
          if (!open) closePlayer()
        }}
      />
    </main>
  )
}
