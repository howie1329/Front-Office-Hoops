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
  StrategyIcon,
  TradeUpIcon,
  UserGroupIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"
import type { CSSProperties } from "react"

import { winPct } from "@/components/league/lib/teamFormat"
import { ModeToggle } from "@/components/ModeToggle"
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
import { Skeleton } from "@workspace/ui/components/skeleton"
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
  const isSetupRoute = isCreate || isPickTeam || isSaves

  if (status === "loading") {
    if (isPickTeam) {
      return <PickTeamLoadingState />
    }

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
      <SidebarProvider
        className="h-svh min-h-0 overflow-hidden"
        style={{ "--sidebar-width": "14rem" } as CSSProperties}
      >
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
          pendingTradeOfferCount={
            league?.pendingTradeOffers.filter(
              (offer) =>
                offer.status === "pending" &&
                offer.toTeamId === league.userTeamId
            ).length ?? 0
          }
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
          <div className="min-h-0 flex-1 p-3 sm:p-4">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

function PickTeamLoadingState() {
  return (
    <div className="flex min-h-svh w-full flex-col gap-4 p-6" aria-busy="true">
      <span className="sr-only">Loading team selection</span>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-80 max-w-[70vw]" />
        </div>
        <Skeleton className="h-6 w-14" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-5 w-52" />
        <div className="grid overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="flex min-h-20 gap-3 border-b p-3 lg:min-h-24 lg:border-r lg:border-b-0 lg:last:border-r-0 sm:[&:nth-child(3)]:border-b-0 sm:[&:nth-child(odd)]:border-r"
            >
              <Skeleton className="size-5 shrink-0" />
              <div className="w-full space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between gap-3 border-b p-3">
          <Skeleton className="h-8 w-72 max-w-[45vw]" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-px p-3">
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
          <div className="hidden border-l p-4 xl:block">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="mt-2 h-3 w-1/2" />
            <div className="mt-4 grid grid-cols-2 gap-2 border-y py-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-11 w-full" />
              ))}
            </div>
            <Skeleton className="mt-4 h-20 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

type SidebarNavItem = {
  to: string
  label: string
  exact?: boolean
  icon: typeof DashboardSquare01Icon
  badgeKey?: "pendingTrades"
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
      { to: "/league/stats", label: "Stats", icon: Analytics01Icon },
    ],
  },
  {
    label: "Team ops",
    items: [
      { to: "/league/team", label: "My Team", icon: UserGroupIcon },
      { to: "/league/team-options", label: "Team Options", icon: StrategyIcon },
      { to: "/league/staff", label: "Staff", icon: StrategyIcon },
      {
        to: "/league/re-signing",
        label: "Re-signing",
        icon: UserMultiple02Icon,
      },
    ],
  },
  {
    label: "Market",
    items: [
      {
        to: "/league/free-agency",
        label: "Free Agency",
        icon: UserMultiple02Icon,
      },
      {
        to: "/league/trades",
        label: "Trades",
        icon: TradeUpIcon,
        badgeKey: "pendingTrades",
      },
      { to: "/league/draft", label: "Draft", icon: DraftingCompassIcon },
    ],
  },
  {
    label: "Records",
    items: [
      { to: "/league/history", label: "History", icon: HistoryIcon },
      { to: "/league/saves", label: "Saves", icon: Home01Icon },
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
  pendingTradeOfferCount: number
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
  pendingTradeOfferCount,
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
              <span className="truncate font-medium">Front Office Hoops</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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
                          {item.badgeKey === "pendingTrades" &&
                          pendingTradeOfferCount > 0 ? (
                            <span className="ml-auto rounded-full bg-sidebar-primary px-1.5 py-0.5 text-[0.625rem] leading-none text-sidebar-primary-foreground group-data-[collapsible=icon]:hidden">
                              {pendingTradeOfferCount}
                            </span>
                          ) : null}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
            {groupIndex < sidebarNavGroups.length - 1 ? (
              <SidebarSeparator />
            ) : null}
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="mx-2 border-b border-sidebar-border pb-2 text-xs group-data-[collapsible=icon]:hidden">
          <p className="truncate font-medium">
            {teamName ?? leagueName ?? "League"}
          </p>
          <p className="mt-0.5 truncate text-muted-foreground">
            {teamAbbrev ? `${teamAbbrev} · ${recordLabel}` : recordLabel}
          </p>
          <p className="mt-1 truncate text-muted-foreground">
            {phaseName} · {dateLabel}
          </p>
          {teamOverall !== undefined ? (
            <p className="mt-1 text-muted-foreground">Overall {teamOverall}</p>
          ) : null}
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
              <SidebarMenuButton asChild tooltip="Home" className="flex-1">
                <Link to="/">
                  <HugeiconsIcon icon={Home01Icon} strokeWidth={2} />
                  <span>Home</span>
                </Link>
              </SidebarMenuButton>
              <ModeToggle align="start" />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
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
