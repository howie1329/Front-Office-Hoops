import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
} from "@tanstack/react-router"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"

export const Route = createFileRoute("/developer-labs")({
  component: DeveloperLabsPage,
})

const availableLabs = [
  {
    title: "Player generation",
    description:
      "Generate deterministic players and inspect hidden talent diagnostics.",
    capability: "Single + batch",
    status: "Available",
    to: "/developer-labs/player-generation" as const,
  },
  {
    title: "Team assembly",
    description:
      "Build seeded rosters, verify position coverage, and inspect every selection.",
    capability: "30 teams · 3 populations",
    status: "Available",
    to: "/developer-labs/team-assembly" as const,
  },
  {
    title: "Game & matchup",
    description:
      "Run seeded possession games and reconcile complete box scores.",
    capability: "Single + batch",
    status: "Available",
    to: "/developer-labs/game-matchup" as const,
  },
  {
    title: "Development cohorts",
    description:
      "Compare career-shape assumptions across development contexts.",
    capability: "Fixture-backed",
    status: "Preview",
    to: "/developer-labs/development-cohorts" as const,
  },
]

const plannedLabs = [
  {
    title: "Contract market",
    description: "Demand, supply, and offer continuity.",
  },
  {
    title: "Draft scouting",
    description: "Scouting ranges and class strength.",
  },
  {
    title: "League economy",
    description: "Payroll spread and tax pressure.",
  },
]

function DeveloperLabsPage() {
  const { pathname } = useLocation()

  if (pathname !== "/developer-labs" && pathname !== "/developer-labs/") {
    return <Outlet />
  }

  return (
    <main className="min-h-svh bg-background px-4 py-6 text-foreground sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-6 border-b border-[#e5e7eb] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <p className="mb-2 text-sm font-medium text-[#5f6470]">
              V2 / Developer labs
            </p>
            <h1 className="text-3xl font-semibold tracking-[-0.025em] text-balance">
              Calibration workbench
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-pretty text-[#5f6470]">
              Tune simulation assumptions against generated evidence before they
              become league behavior.
            </p>
          </div>
          <Button
            variant="outline"
            asChild
            className="h-11 self-start px-4 text-sm sm:self-auto"
          >
            <Link to="/">Back to foundation</Link>
          </Button>
        </header>

        <section aria-labelledby="available-labs-heading">
          <div className="mb-5">
            <h2
              id="available-labs-heading"
              className="text-lg font-semibold tracking-tight"
            >
              Available labs
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#5f6470]">
              Reproducible workspaces for active simulation calibration.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {availableLabs.map((lab) => (
              <Link
                key={lab.title}
                to={lab.to}
                aria-label={`Open ${lab.title} lab`}
                className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#3157d5] focus-visible:ring-offset-2"
              >
                <Card className="h-full gap-0 rounded-xl ring-[#e5e7eb] transition-colors duration-200 group-hover:bg-[#f8faff] group-hover:ring-[#3157d5]/40 group-focus-visible:ring-[#3157d5]/40">
                  <CardHeader className="gap-2 px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
                    <h3 className="text-lg font-semibold tracking-tight">
                      {lab.title}
                    </h3>
                    <p className="max-w-[52ch] text-base leading-6 text-pretty text-[#5f6470]">
                      {lab.description}
                    </p>
                  </CardHeader>

                  <CardContent className="mt-auto flex min-h-14 items-center justify-between gap-4 border-t border-[#e5e7eb] px-5 sm:px-6">
                    <span className="text-sm font-medium text-[#5f6470]">
                      {lab.capability}
                    </span>
                    <span className="flex shrink-0 items-center gap-4">
                      <span
                        className={
                          lab.status === "Available"
                            ? "flex items-center gap-2 text-sm font-medium text-[#3157d5]"
                            : "flex items-center gap-2 text-sm font-medium text-[#5f6470]"
                        }
                      >
                        <span
                          aria-hidden="true"
                          className={
                            lab.status === "Available"
                              ? "size-2 rounded-full bg-[#3157d5]"
                              : "size-2 rounded-full bg-[#7b808c]"
                          }
                        />
                        {lab.status}
                      </span>
                      <span
                        aria-hidden="true"
                        className="text-xl leading-none text-[#18181b] transition-transform duration-200 group-hover:translate-x-0.5"
                      >
                        →
                      </span>
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="planned-labs-heading">
          <div className="mb-5">
            <h2
              id="planned-labs-heading"
              className="text-lg font-semibold tracking-tight"
            >
              Planned systems
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#5f6470]">
              These systems follow the current calibration gates.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plannedLabs.map((lab) => (
              <Card
                key={lab.title}
                size="sm"
                className="gap-0 rounded-xl bg-[#f6f7f9] ring-[#e5e7eb]"
              >
                <CardHeader className="gap-2 px-5 pt-5 pb-4">
                  <h3 className="text-base font-semibold">{lab.title}</h3>
                  <p className="text-sm leading-6 text-[#5f6470]">
                    {lab.description}
                  </p>
                </CardHeader>
                <CardContent className="mt-auto flex min-h-11 items-center border-t border-[#e5e7eb] px-5">
                  <span className="flex items-center gap-2 text-sm font-medium text-[#5f6470]">
                    <span
                      aria-hidden="true"
                      className="size-2 rounded-full bg-[#7b808c]"
                    />
                    Planned
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
