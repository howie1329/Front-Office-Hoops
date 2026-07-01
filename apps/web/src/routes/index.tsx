import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"

import { useSavedLeagueSummary } from "@/hooks/useLeague"

export const Route = createFileRoute("/")({ component: App })

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString()
}

function App() {
  const { summary, loading } = useSavedLeagueSummary()

  const hasSave = Boolean(summary)
  const isReady = Boolean(summary?.userTeamId)
  const needsPickTeam = hasSave && !summary?.userTeamId

  return (
    <div className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">Front Office Hoops</h1>
          <p>Simulation-first basketball GM prototype.</p>

          {loading ? (
            <p className="mt-2 text-xs text-muted-foreground">Checking for saved league…</p>
          ) : null}

          {!loading && isReady ? (
            <div className="mt-2 flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                Continue {summary!.name} · last saved{" "}
                {formatUpdatedAt(summary!.updatedAt)}
              </p>
              <Button asChild>
                <Link to="/league">Continue league</Link>
              </Button>
            </div>
          ) : null}

          {!loading && needsPickTeam ? (
            <div className="mt-2 flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                Finish setup for {summary!.name} · pick your team to play.
              </p>
              <Button asChild>
                <Link to="/league/pick-team">Finish setup</Link>
              </Button>
            </div>
          ) : null}

          {!loading && !hasSave ? (
            <div className="mt-2 flex flex-col gap-2">
              <Button asChild>
                <Link to="/league/create">Create league</Link>
              </Button>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Developer</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" asChild>
                <Link to="/sim-lab">Sim Lab</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link to="/season-lab">Season Lab</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
