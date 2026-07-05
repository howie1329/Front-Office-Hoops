import { createFileRoute, Link } from "@tanstack/react-router"
import type { LeagueSummary } from "@workspace/shared/types"
import { LEAGUE_TEAM_COUNT } from "@workspace/shared/constants"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { useLeagueSaves } from "@/hooks/useLeagueSaves"

export const Route = createFileRoute("/")({ component: App })

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString()
}

function formatLeagueType(teamCount: number): string {
  return teamCount === LEAGUE_TEAM_COUNT
    ? "30-team league"
    : `${teamCount}-team lab`
}

function formatStatus(save: LeagueSummary): string {
  return save.userTeamId ? "Ready to continue" : "Needs team pick"
}

function App() {
  const { saves, activeSave, loading, error } = useLeagueSaves()

  const hasSave = saves.length > 0
  const isReady = Boolean(activeSave?.userTeamId)
  const needsPickTeam = Boolean(activeSave && !activeSave.userTeamId)
  const recentSaves = saves
    .filter((save) => save.id !== activeSave?.id)
    .sort(
      (first, second) =>
        new Date(second.updatedAt).getTime() -
        new Date(first.updatedAt).getTime()
    )
    .slice(0, 3)

  return (
    <main className="min-h-svh px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-6xl flex-col gap-6">
        <section className="grid flex-1 items-start gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)] lg:items-center">
          <div className="flex min-w-0 flex-col gap-6">
            <div className="flex max-w-2xl flex-col gap-3">
              <p className="text-xs font-medium text-muted-foreground">
                League Office Console
              </p>
              <div className="flex flex-col gap-2">
                <h1 className="text-2xl leading-tight font-medium tracking-normal sm:text-3xl">
                  Front Office Hoops
                </h1>
                <p className="max-w-prose text-sm leading-7 text-muted-foreground">
                  Simulation-first basketball GM. Create a league, pick your
                  team, and keep the season moving from one compact front-office
                  surface.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {!loading && isReady && activeSave ? (
                <Button size="lg" asChild>
                  <Link to="/league">Continue league</Link>
                </Button>
              ) : null}

              {!loading && needsPickTeam && activeSave ? (
                <Button size="lg" asChild>
                  <Link to="/league/pick-team">Finish setup</Link>
                </Button>
              ) : null}

              <Button
                size="lg"
                variant={hasSave ? "secondary" : "default"}
                asChild
              >
                <Link to="/league/create">Create league</Link>
              </Button>

              {hasSave ? (
                <Button size="lg" variant="outline" asChild>
                  <Link to="/league/saves">Manage saves</Link>
                </Button>
              ) : null}
            </div>

            <div className="grid max-w-2xl gap-2 text-xs text-muted-foreground sm:grid-cols-3">
              <div className="border-t pt-2">
                <span className="font-medium text-foreground">Sim seasons</span>
                <span className="block">
                  Advance days, weeks, playoffs, and drafts.
                </span>
              </div>
              <div className="border-t pt-2">
                <span className="font-medium text-foreground">Run a team</span>
                <span className="block">
                  Track roster, cap sheet, trades, and free agency.
                </span>
              </div>
              <div className="border-t pt-2">
                <span className="font-medium text-foreground">
                  Read the league
                </span>
                <span className="block">
                  Standings, schedule, stats, playoffs, and history.
                </span>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader className="gap-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Saved leagues</CardTitle>
                  <CardDescription>
                    Continue the active save or manage leagues on this device.
                  </CardDescription>
                </div>
                {!loading && hasSave ? (
                  <span className="rounded-sm bg-muted px-2 py-1 text-xs font-medium">
                    {saves.length} save{saves.length === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {loading ? (
                <p className="text-xs text-muted-foreground">
                  Checking saved leagues...
                </p>
              ) : null}

              {error ? (
                <p className="text-xs text-destructive">{error}</p>
              ) : null}

              {!loading && !hasSave ? (
                <div className="flex flex-col gap-3 rounded-md bg-muted/50 p-3">
                  <div>
                    <p className="text-sm font-medium">No leagues yet</p>
                    <p className="text-xs text-muted-foreground">
                      Create a league to start the GM flow.
                    </p>
                  </div>
                  <Button size="sm" asChild>
                    <Link to="/league/create">Create league</Link>
                  </Button>
                </div>
              ) : null}

              {!loading && activeSave ? (
                <div className="flex flex-col gap-3 rounded-md bg-muted/50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {activeSave.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Active · {formatLeagueType(activeSave.teamCount)} ·{" "}
                        {formatStatus(activeSave)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatUpdatedAt(activeSave.updatedAt)}
                    </span>
                  </div>
                  <Button size="sm" asChild>
                    <Link
                      to={
                        activeSave.userTeamId ? "/league" : "/league/pick-team"
                      }
                    >
                      {activeSave.userTeamId
                        ? "Continue league"
                        : "Finish setup"}
                    </Link>
                  </Button>
                </div>
              ) : null}

              {!loading && recentSaves.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium">Recent saves</p>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto px-0"
                      asChild
                    >
                      <Link to="/league/saves">Manage all</Link>
                    </Button>
                  </div>
                  <div className="divide-y rounded-md border">
                    {recentSaves.map((save) => (
                      <div
                        key={save.id}
                        className="flex items-center justify-between gap-3 p-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{save.name}</p>
                          <p className="text-muted-foreground">
                            {formatLeagueType(save.teamCount)} ·{" "}
                            {formatStatus(save)}
                          </p>
                        </div>
                        <span className="shrink-0 text-muted-foreground">
                          {formatUpdatedAt(save.updatedAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t py-3 text-xs text-muted-foreground">
          <span>Developer tools</span>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/sim-lab">Sim Lab</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/season-lab">Season Lab</Link>
            </Button>
          </div>
        </footer>
      </div>
    </main>
  )
}
