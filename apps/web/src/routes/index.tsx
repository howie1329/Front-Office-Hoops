import { createFileRoute, Link } from "@tanstack/react-router"

import { Button } from "@workspace/ui/components/button"

import { ModeToggle } from "@/components/ModeToggle"
import { useLeagueSaves } from "@/hooks/useLeagueSaves"

export const Route = createFileRoute("/")({ component: LandingPage })

const operatingLoop = [
  {
    title: "Build the league",
    body: "Generate a full 30-team save, pick your front office, and inherit the pressure of a real season.",
  },
  {
    title: "Work the roster",
    body: "Balance contracts, staff, trades, development, and rotation decisions without losing the league context.",
  },
  {
    title: "Advance the calendar",
    body: "Simulate from preseason through playoffs, draft, free agency, and history with every choice attached to the save.",
  },
]

const officeRows = [
  ["Cap room", "$18.4M", "2 open roster spots"],
  ["Deadline board", "6 targets", "3 protected picks"],
  ["Staff budget", "$7.2M", "Scouting priority"],
  ["Draft file", "58 prospects", "Lottery watch"],
]

const standings = [
  ["1", "Chicago", "48-22", "+6.1"],
  ["2", "New York", "45-25", "+4.8"],
  ["3", "Denver", "44-26", "+4.2"],
  ["4", "Seattle", "41-29", "+2.9"],
]

function LandingPage() {
  const { activeSave, saves, loading } = useLeagueSaves()
  const hasSaves = saves.length > 0
  const continuePath = activeSave?.userTeamId ? "/league" : "/league/pick-team"

  return (
    <main className="min-h-svh overflow-hidden bg-background text-foreground">
      <section className="relative isolate border-b border-border">
        <div
          className="absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_18%_12%,color-mix(in_oklch,var(--foreground),transparent_86%),transparent_34rem)]"
          aria-hidden="true"
        />
        <div className="mx-auto flex min-h-svh w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between gap-4">
            <Link
              to="/"
              className="text-sm font-semibold tracking-[-0.01em] underline-offset-4 hover:underline"
            >
              Front Office Hoops
            </Link>
            <nav className="flex items-center gap-2" aria-label="Primary">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/league/saves">Saves</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/league/create">Create league</Link>
              </Button>
              <ModeToggle />
            </nav>
          </header>

          <div className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,1fr)] lg:py-10">
            <div className="flex max-w-3xl flex-col gap-7">
              <div className="flex flex-col gap-5">
                <p className="w-fit rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
                  Playable basketball GM simulation
                </p>
                <h1 className="max-w-[12ch] text-5xl leading-[0.98] font-semibold tracking-[-0.035em] text-balance sm:text-6xl lg:text-7xl">
                  Run the league office.
                </h1>
                <p className="max-w-[62ch] text-base leading-8 text-muted-foreground sm:text-lg sm:leading-8">
                  Create a league, choose your team, and manage the basketball
                  decisions that carry a season: roster construction, finances,
                  staff, schedule, playoffs, draft, free agency, and history.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button size="lg" asChild>
                  <Link to="/league/create">Create league</Link>
                </Button>
                {activeSave ? (
                  <Button variant="outline" size="lg" asChild>
                    <Link to={continuePath}>Continue {activeSave.name}</Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="lg" asChild>
                    <Link to="/league/saves">
                      {loading ? "Checking saves" : "View saves"}
                    </Link>
                  </Button>
                )}
              </div>

              <dl className="grid max-w-2xl grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border text-xs">
                <div className="bg-background p-3">
                  <dt className="text-muted-foreground">League size</dt>
                  <dd className="mt-1 font-medium">30 teams</dd>
                </div>
                <div className="bg-background p-3">
                  <dt className="text-muted-foreground">Season path</dt>
                  <dd className="mt-1 font-medium">Full calendar</dd>
                </div>
                <div className="bg-background p-3">
                  <dt className="text-muted-foreground">Saves</dt>
                  <dd className="mt-1 font-medium">
                    {loading ? "Local" : hasSaves ? `${saves.length} local` : "Local"}
                  </dd>
                </div>
              </dl>
            </div>

            <SimulationBoard />
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.75fr_1fr] lg:px-8 lg:py-20">
        <div className="max-w-xl">
          <h2 className="text-3xl leading-tight font-semibold tracking-[-0.025em] text-balance">
            A sim loop built for decisions, not decoration.
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Front Office Hoops keeps the whole league close: the standings, the
            cap sheet, the schedule, and the next transaction all stay connected
            so each advance has context.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {operatingLoop.map((item) => (
            <article
              key={item.title}
              className="rounded-lg border border-border bg-card p-4"
            >
              <h3 className="text-sm font-medium">{item.title}</h3>
              <p className="mt-3 text-xs leading-6 text-muted-foreground">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

function SimulationBoard() {
  return (
    <div
      className="relative mx-auto w-full max-w-[660px]"
      aria-label="Abstract front office simulation board"
    >
      <div
        className="absolute top-8 right-6 left-6 h-48 rounded-full bg-[color-mix(in_oklch,var(--foreground),transparent_92%)] blur-3xl"
        aria-hidden="true"
      />
      <div className="relative rounded-xl border border-border bg-card p-4 shadow-[0_8px_24px_color-mix(in_oklch,var(--foreground),transparent_92%)]">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              League office file
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.015em]">
              2027 Season Control
            </h2>
          </div>
          <div className="rounded-md border border-border px-2 py-1 text-xs font-medium">
            Day 118
          </div>
        </div>

        <div className="grid gap-4 pt-4 lg:grid-cols-[1fr_0.82fr]">
          <div className="flex flex-col gap-4">
            <div className="rounded-lg bg-muted/55 p-3">
              <div className="mb-3 flex items-center justify-between text-xs">
                <span className="font-medium">Operations ledger</span>
                <span className="text-muted-foreground">Live save</span>
              </div>
              <div className="divide-y divide-border rounded-md border border-border bg-background">
                {officeRows.map(([label, value, note]) => (
                  <div
                    key={label}
                    className="grid grid-cols-[0.9fr_0.7fr_1fr] gap-3 px-3 py-2 text-xs"
                  >
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value}</span>
                    <span className="truncate text-muted-foreground">{note}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 28 }).map((_, index) => (
                <div
                  key={index}
                  className={`h-7 rounded-sm border border-border ${
                    index % 5 === 0
                      ? "bg-foreground"
                      : index % 3 === 0
                        ? "bg-muted"
                        : "bg-background"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-border bg-background p-3">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium">Standings watch</span>
                <span className="text-muted-foreground">Net</span>
              </div>
              <div className="space-y-1">
                {standings.map(([rank, team, record, net]) => (
                  <div
                    key={team}
                    className="grid grid-cols-[1.5rem_1fr_3.3rem_2.5rem] gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted"
                  >
                    <span className="text-muted-foreground">{rank}</span>
                    <span className="font-medium">{team}</span>
                    <span className="text-muted-foreground">{record}</span>
                    <span>{net}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs font-medium">Playoff path</p>
              <div className="mt-3 grid grid-cols-[1fr_1px_1fr] gap-3">
                <div className="space-y-2">
                  <div className="h-7 rounded-md bg-muted" />
                  <div className="h-7 rounded-md bg-muted" />
                  <div className="h-7 rounded-md bg-foreground" />
                </div>
                <div className="bg-border" />
                <div className="space-y-5 pt-4">
                  <div className="h-7 rounded-md bg-muted" />
                  <div className="h-7 rounded-md border border-border bg-background" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-1">Draft board</span>
          <span className="rounded-full bg-muted px-2 py-1">Free agency</span>
          <span className="rounded-full bg-muted px-2 py-1">Trades</span>
          <span className="rounded-full bg-muted px-2 py-1">History</span>
        </div>
      </div>
    </div>
  )
}
