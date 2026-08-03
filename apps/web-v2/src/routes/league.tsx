import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
} from "@tanstack/react-router"
import * as React from "react"

import type { LeagueDocument } from "@workspace/domain-v2"
import { V2LeagueRepository } from "@workspace/db-v2"
import { getLifecycleActionState } from "@workspace/sim-v2"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { LeagueContextHeader } from "@/components/league-context-header"
import {
  DEFAULT_SIDEBAR_WIDTH,
  LeagueSidebar,
  LeagueShellProvider,
  clampSidebarWidth,
} from "@/components/league-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { useLeagueSimulation } from "@/lib/leagueLifecycle"

export const Route = createFileRoute("/league")({
  validateSearch: (search: Record<string, unknown>): { saveId?: string } => {
    const saveId = typeof search.saveId === "string" ? search.saveId : undefined
    return saveId ? { saveId } : {}
  },
  component: LeagueLayout,
})

function LeagueLayout() {
  const { saveId } = Route.useSearch()
  const { pathname } = useLocation()
  const isStandaloneRoute = pathname === "/league/start"
  const [league, setLeague] = React.useState<LeagueDocument | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [sidebarWidth, setSidebarWidth] = React.useState(DEFAULT_SIDEBAR_WIDTH)
  const [isSidebarWidthHydrated, setIsSidebarWidthHydrated] =
    React.useState(false)
  const {
    handleAdvanceDay,
    handleReleasePlayer,
    handleSetRotation,
    isSimulating,
    simulationError,
  } = useLeagueSimulation({
    league,
    repository,
    setLeague,
  })

  React.useEffect(() => {
    try {
      const storedWidth = Number(
        window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)
      )
      if (Number.isFinite(storedWidth))
        setSidebarWidth(clampSidebarWidth(storedWidth))
    } catch {
      // Local storage is optional; the default width remains usable.
    }
    setIsSidebarWidthHydrated(true)
  }, [])

  React.useEffect(() => {
    if (!isSidebarWidthHydrated) return
    try {
      window.localStorage.setItem(
        SIDEBAR_WIDTH_STORAGE_KEY,
        String(sidebarWidth)
      )
    } catch {
      // Local storage is optional; resizing still works for this session.
    }
  }, [isSidebarWidthHydrated, sidebarWidth])

  React.useEffect(() => {
    if (isStandaloneRoute) {
      setIsLoading(false)
      return
    }

    let active = true

    async function loadLeague() {
      setIsLoading(true)
      setError(null)

      try {
        const id = saveId ?? (await repository.list())[0]?.id
        const document = id ? await repository.load(id) : null

        if (!active) return
        if (!document) {
          setError("That league could not be found in this browser.")
        } else {
          setLeague(document)
        }
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
  }, [isStandaloneRoute, saveId])

  if (isStandaloneRoute) return <Outlet />

  if (isLoading) {
    return (
      <main className="grid min-h-svh place-items-center bg-background px-5 text-sm text-muted-foreground">
        <div className="grid w-full max-w-sm gap-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </main>
    )
  }

  if (error || !league) {
    return (
      <main className="min-h-svh bg-background px-5 py-8 text-foreground sm:px-8 lg:px-12">
        <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-10">
          <Empty className="items-start rounded-none border-y border-border px-0 py-12 text-left">
            <EmptyHeader className="items-start text-left">
              <EmptyTitle>League unavailable.</EmptyTitle>
              <EmptyDescription>
                {error ?? "No league is selected."}
              </EmptyDescription>
            </EmptyHeader>
            {error ? (
              <Alert variant="destructive" className="mt-4 w-full max-w-xl">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
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
              <EmptyTitle>Select a team to open the league.</EmptyTitle>
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
  const pageLabel =
    pathname === "/league/roster"
      ? "Team / Roster"
      : pathname === "/league/finance"
        ? "Team / Finance"
        : pathname === "/league/free-agents"
          ? "Team / Free Agents"
          : "Dashboard"

  return (
    <LeagueShellProvider
      value={{
        league,
        teamId,
        advanceAction,
        isSimulating,
        simulationError,
        handleAdvanceDay,
        handleReleasePlayer: (playerId) =>
          handleReleasePlayer(teamId, playerId),
        handleSetRotation: (rotation) => handleSetRotation(teamId, rotation),
      }}
    >
      <main className="min-h-svh bg-background text-foreground selection:bg-primary selection:text-primary-foreground xl:h-dvh xl:overflow-hidden">
        <SidebarProvider
          className="min-h-svh xl:h-dvh"
          style={
            { "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties
          }
        >
          <LeagueSidebar
            league={league}
            teamId={teamId}
            width={sidebarWidth}
            onWidthChange={setSidebarWidth}
          />
          <SidebarInset className="min-h-0 xl:overflow-hidden">
            <LeagueContextHeader
              league={league}
              teamId={teamId}
              pageLabel={pageLabel}
              advanceAction={advanceAction}
              isSimulating={isSimulating}
              onAdvanceDay={() => void handleAdvanceDay()}
            />
            {simulationError ? (
              <div className="flex-none border-b border-border px-5 py-2 sm:px-8 lg:px-10">
                <Alert variant="destructive" className="py-2">
                  <AlertDescription>{simulationError}</AlertDescription>
                </Alert>
              </div>
            ) : null}
            <Outlet />
          </SidebarInset>
        </SidebarProvider>
      </main>
    </LeagueShellProvider>
  )
}

const repository = new V2LeagueRepository()
const SIDEBAR_WIDTH_STORAGE_KEY = "foh-v2-sidebar-width"
