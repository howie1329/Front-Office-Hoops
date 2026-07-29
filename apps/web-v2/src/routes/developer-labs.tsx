import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
} from "@tanstack/react-router"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

export const Route = createFileRoute("/developer-labs")({
  component: DeveloperLabsPage,
})

function DeveloperLabsPage() {
  const { pathname } = useLocation()

  if (pathname !== "/developer-labs" && pathname !== "/developer-labs/") {
    return <Outlet />
  }

  return (
    <main className="min-h-svh bg-background px-4 py-6 text-foreground sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              V2 / developer labs
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-balance">
              Calibration workbench
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Tune simulation assumptions against generated evidence before they
              become league behavior.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/">Back to foundation</Link>
          </Button>
        </header>

        <section
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          aria-label="Developer labs"
        >
          <Link
            to="/developer-labs/player-generation"
            className="group rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Card className="h-full transition-colors group-hover:bg-muted/40">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Player generation</CardTitle>
                  <Badge variant="default">Active</Badge>
                </div>
                <CardDescription>
                  Generate deterministic players, tune the profile config, and
                  inspect hidden talent diagnostics.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Single + batch modes</span>
                <span className="font-medium text-foreground transition-transform group-hover:translate-x-0.5">
                  Open lab →
                </span>
              </CardContent>
            </Card>
          </Link>

          <Link
            to="/developer-labs/team-assembly"
            className="group rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Card className="h-full transition-colors group-hover:bg-muted/40">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Team assembly</CardTitle>
                  <Badge variant="default">Active</Badge>
                </div>
                <CardDescription>
                  Build deterministic rosters, verify position coverage, and
                  inspect every seeded selection.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
                <span>30 teams + three populations</span>
                <span className="font-medium text-foreground transition-transform group-hover:translate-x-0.5">
                  Open lab →
                </span>
              </CardContent>
            </Card>
          </Link>

          {[
            ["Game calibration", "Possession model and box-score ranges"],
            ["Development cohorts", "Career curves, volatility, and aging"],
            ["Contract market", "Demand, supply, and offer continuity"],
            ["Draft scouting", "Scouting ranges and class strength"],
            ["League economy", "Payroll spread and tax pressure"],
          ].map(([title, description]) => (
            <Card key={title} className="h-full opacity-65">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>{title}</CardTitle>
                  <Badge variant="outline">Planned</Badge>
                </div>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                This lab will be added after the player-generation calibration
                gate.
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  )
}
