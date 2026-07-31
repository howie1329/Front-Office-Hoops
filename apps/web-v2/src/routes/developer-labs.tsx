import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ChartHistogramIcon,
  ChartLineIcon,
  InformationCircleIcon,
  PieChartIcon,
  Target01Icon,
  TestTubeIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
} from "@tanstack/react-router"

import { Button } from "@workspace/ui/components/button"

export const Route = createFileRoute("/developer-labs")({
  component: DeveloperLabsPage,
})

const availableLabs = [
  {
    title: "Player generation",
    description:
      "Generate deterministic players and inspect hidden talent diagnostics.",
    metadata: ["Single + batch", "Deterministic seeds", "Talent diagnostics"],
    status: "Available",
    icon: UserGroupIcon,
    recommended: true,
    to: "/developer-labs/player-generation" as const,
  },
  {
    title: "Team assembly",
    description:
      "Build seeded rosters, verify position coverage, and inspect every selection.",
    metadata: ["30 teams", "3 populations", "Position coverage"],
    status: "Available",
    icon: UserGroupIcon,
    to: "/developer-labs/team-assembly" as const,
  },
  {
    title: "Game & matchup",
    description:
      "Run seeded possession games and reconcile complete box scores.",
    metadata: [
      "Single + batch",
      "Possession games",
      "Box score reconciliation",
    ],
    status: "Available",
    icon: TestTubeIcon,
    to: "/developer-labs/game-matchup" as const,
  },
  {
    title: "Development cohorts",
    description:
      "Compare career-shape assumptions across development contexts.",
    metadata: ["Fixture-backed", "Cross-context comparison"],
    status: "Preview",
    icon: ChartHistogramIcon,
    to: "/developer-labs/development-cohorts" as const,
  },
]

const plannedLabs = [
  {
    title: "Contract market",
    description:
      "Model demand, supply, and offer continuity across contract scenarios.",
    icon: ChartLineIcon,
  },
  {
    title: "Draft scouting",
    description:
      "Model scouting ranges and class strength across draft contexts.",
    icon: Target01Icon,
  },
  {
    title: "League economy",
    description:
      "Model payroll spread and tax pressure across league configurations.",
    icon: PieChartIcon,
  },
]

function DeveloperLabsPage() {
  const { pathname } = useLocation()

  if (pathname !== "/developer-labs" && pathname !== "/developer-labs/") {
    return <Outlet />
  }

  return (
    <main className="min-h-svh bg-background px-4 py-8 text-foreground sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto w-full max-w-6xl">
        <header className="grid items-end gap-8 border-b border-border pb-10 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm leading-5 text-muted-foreground [&>span:first-child]:font-semibold [&>span:first-child]:text-foreground">
              <span>V2</span>
              <span aria-hidden="true">/</span>
              <span>Developer labs</span>
            </p>
            <h1 className="mt-3 text-[2.25rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-[2.75rem]">
              Calibration workbench
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-6 text-pretty text-muted-foreground">
              Tune simulation assumptions against generated evidence before they
              become league behavior.
            </p>
          </div>

          <Button
            variant="outline"
            asChild
            className="min-h-11 gap-2 justify-self-start px-4 text-sm lg:justify-self-end"
          >
            <Link to="/">
              <HugeiconsIcon
                icon={ArrowLeft01Icon}
                strokeWidth={2}
                aria-hidden="true"
              />
              Back to foundation
            </Link>
          </Button>
        </header>

        <div className="flex flex-col gap-16 pt-12">
          <section aria-labelledby="available-labs-heading">
            <div className="mb-5 flex flex-col gap-1.5">
              <h2
                id="available-labs-heading"
                className="text-lg leading-6 font-semibold tracking-[-0.02em]"
              >
                Available labs
              </h2>
              <p className="text-sm leading-[1.375rem] text-muted-foreground">
                Reproducible workspaces for active simulation calibration.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {availableLabs.map((lab) => (
                <Link
                  key={lab.title}
                  to={lab.to}
                  aria-label={`Open ${lab.title} lab`}
                  className={`group flex min-h-60 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground no-underline transition-[border-color,background-color] duration-200 hover:border-foreground hover:bg-muted focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring motion-reduce:transition-none ${lab.recommended ? "border-foreground" : ""}`}
                >
                  <div className="flex gap-4 p-5 pb-4 sm:p-6 sm:pb-5">
                    <div
                      className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground [&>svg]:size-[1.375rem]"
                      aria-hidden="true"
                    >
                      <HugeiconsIcon icon={lab.icon} strokeWidth={1.8} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <h3 className="text-xl leading-6 font-semibold tracking-[-0.025em] text-balance">
                          {lab.title}
                        </h3>
                        {lab.recommended ? (
                          <span className="inline-flex min-h-6 items-center rounded-md border border-border bg-background px-2 py-0.5 text-[0.6875rem] leading-4 font-semibold tracking-[0.02em] text-foreground uppercase">
                            Start here
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 max-w-[46ch] text-sm leading-[1.375rem] text-pretty text-muted-foreground">
                        {lab.description}
                      </p>
                    </div>
                  </div>

                  <ul
                    className="mt-auto flex list-none flex-wrap gap-x-5 gap-y-1.5 border-t border-border px-5 py-3.5 text-xs leading-5 text-muted-foreground sm:px-6"
                    aria-label="Lab capabilities"
                  >
                    {lab.metadata.map((item, index) => (
                      <li key={item} className="flex items-center gap-5">
                        {index > 0 ? <span aria-hidden="true">·</span> : null}
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex min-h-14 items-center justify-between gap-4 border-t border-border px-5 sm:px-6">
                    <span
                      className={`inline-flex items-center gap-2 text-[0.8125rem] leading-5 font-semibold ${lab.status === "Preview" ? "text-muted-foreground" : "text-foreground"}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`size-2 rounded-full ${lab.status === "Preview" ? "bg-muted-foreground" : "bg-foreground"}`}
                      />
                      {lab.status}
                    </span>
                    <span className="inline-flex items-center gap-2.5 text-[0.8125rem] leading-5 font-semibold text-foreground">
                      Open lab
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        strokeWidth={2}
                        className="size-[1.125rem] transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section aria-labelledby="coming-soon-heading">
            <div className="mb-5 flex flex-col gap-1.5">
              <h2
                id="coming-soon-heading"
                className="text-lg leading-6 font-semibold tracking-[-0.02em]"
              >
                Coming soon
              </h2>
              <p className="text-sm leading-[1.375rem] text-muted-foreground">
                Calibration workspaces in planning and preparation.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {plannedLabs.map((lab) => (
                <article
                  key={lab.title}
                  className="grid min-h-36 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-4 rounded-xl border border-border bg-muted p-5 text-card-foreground sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-6"
                >
                  <HugeiconsIcon
                    icon={lab.icon}
                    strokeWidth={1.8}
                    className="mt-0.5 size-6 text-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <h3 className="text-base leading-[1.375rem] font-semibold tracking-[-0.015em]">
                      {lab.title}
                    </h3>
                    <p className="mt-1.5 text-[0.8125rem] leading-5 text-pretty text-muted-foreground">
                      {lab.description}
                    </p>
                  </div>
                  <span className="col-start-2 inline-flex min-h-6 justify-self-start rounded-md border border-border bg-card px-2 py-0.5 text-xs leading-5 font-semibold text-muted-foreground sm:col-auto sm:justify-self-auto">
                    Planned
                  </span>
                </article>
              ))}
            </div>
          </section>

          <footer className="flex items-start gap-2.5 border-t border-border pt-4 text-muted-foreground">
            <HugeiconsIcon
              icon={InformationCircleIcon}
              strokeWidth={1.8}
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <p className="flex flex-wrap gap-x-2.5 gap-y-1 text-xs leading-5 text-muted-foreground">
              All workspaces use deterministic seeds and visible assumptions.
              <span aria-hidden="true">|</span>
              Results are reproducible for auditing and comparison.
            </p>
          </footer>
        </div>
      </div>
    </main>
  )
}
