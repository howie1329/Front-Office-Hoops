import {
  createFileRoute,
  Navigate,
  Outlet,
  useRouterState,
} from "@tanstack/react-router"

import { LeagueNav } from "@/components/league/LeagueNav"
import { LeagueProvider, useLeagueContext } from "@/contexts/LeagueContext"

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
  const { status, needsCreate, needsPickTeam, league } = useLeagueContext()

  const isCreate = pathname === "/league/create"
  const isPickTeam = pathname === "/league/pick-team"
  const isSaves = pathname === "/league/saves"
  const isSetupRoute = isCreate || isPickTeam || isSaves

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
    <div className="mx-auto flex min-h-svh max-w-5xl flex-col gap-4 p-6">
      <LeagueNav leagueName={league?.name} />
      <Outlet />
    </div>
  )
}
