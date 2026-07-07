import {
  Link,
  createFileRoute,
  Navigate,
  Outlet,
  useRouterState,
} from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Analytics01Icon,
  AwardIcon,
  Basketball01Icon,
  Calendar03Icon,
  DashboardSquare01Icon,
  DraftingCompassIcon,
  HistoryIcon,
  Home01Icon,
  RankingIcon,
  SaveIcon,
  TradeUpIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"

import { winPct } from "@/components/league/lib/teamFormat"
import { LeagueProvider, useLeagueContext } from "@/contexts/LeagueContext"
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
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

export const Route = createFileRoute("/league")({
  component: LeagueLayoutRoute,
})

function LeagueLayoutRoute() {
  return (
    <LeagueProvider>
      <LeagueLayout />
    </LeagueProvider>
  )
}

function LeagueLayout() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const {
    status,
    needsCreate,
    needsPickTeam,
    league,
    seasonState,
    myTeam,
    phase,
    calendar,
  } = useLeagueContext()

  const isCreate = pathname === "/league/create"
  const isPickTeam = pathname === "/league/pick-team"
  const isSaves = pathname === "/league/saves"
  const isSetupRoute = isCreate || isPickTeam || (isSaves && needsPickTeam)

  if (status === "loading") {
    return (
      <div className="mx-auto flex min-h-svh max-w-5xl items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Loading league…</p>
      </div>
    )
  }

  if (needsCreate && !isCreate) {
    return <Navigate to="/league/create" />
  }

  if (needsPickTeam && !isPickTeam && !isCreate && !isSaves) {
    return <Navigate to="/league/pick-team" />
  }

  if (isSetupRoute) {
    if (isPickTeam) {
      return (
        <div className="flex min-h-svh w-full flex-col p-6">
          <Outlet />
        </div>
      )
    }

    return (
      <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-4 p-6">
        <Outlet />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <SidebarProvider className="h-svh min-h-0 overflow-hidden">
        <LeagueSidebar
          pathname={pathname}
          leagueName={league?.name}
          teamName={myTeam?.name}
          teamAbbrev={myTeam?.abbrev}
          teamOverall={myTeam?.overall}
          record={
            seasonState && myTeam
              ? (seasonState.standings.find(
                  (row) => row.teamId === myTeam.id
                ) ?? null)
              : null
          }
          phase={phase}
          dayLabel={calendar?.date.label ?? null}
          currentDay={seasonState?.currentDay ?? null}
        />
        <SidebarInset className="h-svh min-w-0 overflow-hidden">
          <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4 md:hidden">
            <SidebarTrigger />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {league?.name ?? "League"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {myTeam
                  ? `${myTeam.abbrev} · ${phaseLabel(phase)}`
                  : "Front Office Hoops"}
              </p>
            </div>
          </header>
          <div className="min-h-0 flex-1 p-4 sm:p-6">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

type SidebarNavItem = {
  to: string
  label: string
  exact?: boolean
  icon: typeof DashboardSquare01Icon
}

type SidebarNavGroup = {
  label: string
  items: SidebarNavItem[]
}

const sidebarNavGroups: SidebarNavGroup[] = [
  {
    label: "League",
    items: [
      {
        to: "/league",
        label: "Dashboard",
        exact: true,
        icon: DashboardSquare01Icon,
      },
      { to: "/league/standings", label: "Standings", icon: RankingIcon },
      { to: "/league/calendar", label: "Calendar", icon: Calendar03Icon },
      { to: "/league/playoffs", label: "Playoffs", icon: AwardIcon },
    ],
  },
  {
    label: "Team ops",
    items: [
      { to: "/league/team", label: "My Team", icon: UserGroupIcon },
      { to: "/league/trades", label: "Trades", icon: TradeUpIcon },
      { to: "/league/draft", label: "Draft", icon: DraftingCompassIcon },
      { to: "/league/stats", label: "Stats", icon: Analytics01Icon },
    ],
  },
  {
    label: "Office",
    items: [
      { to: "/league/history", label: "History", icon: HistoryIcon },
      { to: "/league/saves", label: "Saves", icon: SaveIcon },
    ],
  },
]

type LeagueSidebarProps = {
  pathname: string
  leagueName?: string
  teamName?: string
  teamAbbrev?: string
  teamOverall?: number
  record: { wins: number; losses: number } | null
  phase: "preseason" | "regular" | "playoffs" | "complete" | "offseason"
  dayLabel: string | null
  currentDay: number | null
}

function LeagueSidebar({
  pathname,
  leagueName,
  teamName,
  teamAbbrev,
  teamOverall,
  record,
  phase,
  dayLabel,
  currentDay,
}: LeagueSidebarProps) {
  const recordLabel = record
    ? `${record.wins}-${record.losses} (${winPct(record.wins, record.losses)})`
    : "-"
  const phaseName = phaseLabel(phase)
  const dateLabel =
    dayLabel && currentDay
      ? `${dayLabel} · Day ${currentDay}`
      : (dayLabel ?? "-")

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Front Office Hoops">
              <HugeiconsIcon icon={Basketball01Icon} strokeWidth={2} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">
                  {leagueName ?? "League"}
                </span>
                <span className="truncate text-muted-foreground">
                  {teamAbbrev
                    ? `${teamAbbrev} front office`
                    : "Front Office Hoops"}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="mx-2 rounded-lg border border-sidebar-border bg-background/70 p-2 text-xs group-data-[collapsible=icon]:hidden">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Record</span>
            <span className="font-medium tabular-nums">{recordLabel}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Phase</span>
            <span className="truncate text-right font-medium">{phaseName}</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {sidebarNavGroups.map((group, groupIndex) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = item.exact
                    ? pathname === item.to
                    : pathname.startsWith(item.to)

                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.label}
                        className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground"
                      >
                        <Link
                          to={item.to}
                          activeOptions={
                            item.exact ? { exact: true } : undefined
                          }
                        >
                          <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
            {groupIndex < sidebarNavGroups.length - 1 ? (
              <SidebarSeparator className="mt-2" />
            ) : null}
          </SidebarGroup>
        ))}

        <SidebarGroup>
          <SidebarGroupLabel>Context</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="flex flex-col gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-2 text-xs group-data-[collapsible=icon]:hidden">
              <SidebarContextRow
                label="Team"
                value={teamName ? `${teamName} · ${teamAbbrev}` : "-"}
              />
              <SidebarContextRow
                label="Overall"
                value={teamOverall === undefined ? "-" : String(teamOverall)}
              />
              <SidebarContextRow label="Date" value={dateLabel} />
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Home">
              <Link to="/">
                <HugeiconsIcon icon={Home01Icon} strokeWidth={2} />
                <span>Home</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function SidebarContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{value}</span>
    </div>
  )
}

function phaseLabel(phase: LeagueSidebarProps["phase"]): string {
  if (phase === "preseason") {
    return "Preseason"
  }
  if (phase === "playoffs") {
    return "Playoffs"
  }
  if (phase === "complete") {
    return "Season complete"
  }
  if (phase === "offseason") {
    return "Offseason"
  }
  return "Regular season"
}
