import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"

import { useSavedLeagueSummary } from "@/hooks/useLeague"

export const Route = createFileRoute("/")({ component: App })

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString()
}

function App() {
  const { summary, loading } = useSavedLeagueSummary()

  return (
    <div className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">Front Office Hoops</h1>
          <p>Simulation-first basketball GM prototype.</p>

          {loading ? (
            <p className="mt-2 text-xs text-muted-foreground">Checking for saved league…</p>
          ) : summary ? (
            <div className="mt-2 flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                Continue {summary.name} · last saved {formatUpdatedAt(summary.updatedAt)}
              </p>
              <Button asChild>
                <Link to="/season-lab">Continue league</Link>
              </Button>
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant={summary ? "secondary" : "default"} asChild>
              <Link to="/sim-lab">Open Sim Lab</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/season-lab">Open Season Lab</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
