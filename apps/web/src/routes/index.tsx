import { createFileRoute, Link } from "@tanstack/react-router"
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

function App() {
  const { saves, activeSave, loading, error } = useLeagueSaves()

  const hasSave = saves.length > 0
  const isReady = Boolean(activeSave?.userTeamId)
  const needsPickTeam = Boolean(activeSave && !activeSave.userTeamId)

  return (
    <div className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">Front Office Hoops</h1>
          <p>Simulation-first basketball GM prototype.</p>

          {loading ? (
            <p className="mt-2 text-xs text-muted-foreground">Checking for saved leagues…</p>
          ) : null}

          {error ? (
            <p className="mt-2 text-xs text-destructive">{error}</p>
          ) : null}

          {!loading && isReady && activeSave ? (
            <div className="mt-2 flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                Continue {activeSave.name} · last saved{" "}
                {formatUpdatedAt(activeSave.updatedAt)}
              </p>
              <Button asChild>
                <Link to="/league">Continue league</Link>
              </Button>
            </div>
          ) : null}

          {!loading && needsPickTeam && activeSave ? (
            <div className="mt-2 flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                Finish setup for {activeSave.name} · pick your team to play.
              </p>
              <Button asChild>
                <Link to="/league/pick-team">Finish setup</Link>
              </Button>
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant={hasSave ? "secondary" : "default"} asChild>
              <Link to="/league/create">Create league</Link>
            </Button>
            {hasSave ? (
              <Button variant="outline" asChild>
                <Link to="/league/saves">Manage saves</Link>
              </Button>
            ) : null}
          </div>

          {!loading && saves.length > 1 ? (
            <Card className="mt-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Saved leagues</CardTitle>
                <CardDescription>
                  {saves.length} saves on this device. The active save is used
                  when you continue.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-xs">
                {saves.map((save) => (
                  <div
                    key={save.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span>
                      {save.name}
                      {save.id === activeSave?.id ? " · Active" : ""}
                    </span>
                    <span className="text-muted-foreground">
                      {formatUpdatedAt(save.updatedAt)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
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
