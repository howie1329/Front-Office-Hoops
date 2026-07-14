import { createFileRoute, Link } from "@tanstack/react-router"

import { Button } from "@workspace/ui/components/button"

import { ModeToggle } from "@/components/ModeToggle"
import { useLeagueSaves } from "@/hooks/useLeagueSaves"

export const Route = createFileRoute("/")({ component: LandingPage })

const operatingLoop = [
  ["Build the league", "Start with 30 teams, set the rules, and take control of one front office."],
  ["Make the calls", "Keep contracts, staff, trades, and development in one working context."],
  ["See it through", "Advance from opening night to the draft with the full record of every decision."],
]

const standings = [
  ["01", "Chicago", "48–22", "+6.1"],
  ["02", "New York", "45–25", "+4.8"],
  ["03", "Denver", "44–26", "+4.2"],
  ["04", "Seattle", "41–29", "+2.9"],
]

const ledger = [
  ["Cap room", "$18.4M"],
  ["Open spots", "2"],
  ["Protected picks", "3"],
]

function LandingPage() {
  const { activeSave, saves, loading } = useLeagueSaves()
  const continuePath = activeSave?.userTeamId ? "/league" : "/league/pick-team"

  return (
    <main className="min-h-svh overflow-hidden bg-background text-foreground">
      <section className="mx-auto w-full max-w-[90rem] px-5 sm:px-8 lg:px-12">
        <header className="flex min-h-20 items-center justify-between border-b border-border">
          <Link
            to="/"
            className="text-sm font-semibold tracking-[-0.025em] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Front Office Hoops
          </Link>
          <nav className="flex items-center gap-1.5" aria-label="Primary">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/league/saves">Saves</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/league/create">Create league</Link>
            </Button>
            <ModeToggle />
          </nav>
        </header>

        <div className="grid items-end gap-12 pb-14 pt-18 sm:pb-20 sm:pt-24 lg:grid-cols-[minmax(0,0.78fr)_minmax(26rem,1fr)] lg:gap-20 lg:pb-24 lg:pt-32">
          <div className="max-w-2xl">
            <p className="mb-6 text-sm font-medium text-muted-foreground">
              Basketball simulation, without the spectacle.
            </p>
            <h1 className="max-w-[10ch] text-5xl font-semibold tracking-[-0.035em] text-balance sm:text-6xl lg:text-7xl lg:leading-[0.98]">
              Run the league.
            </h1>
            <p className="mt-7 max-w-[56ch] text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              A serious front-office simulator for the decisions that shape a season—rosters, cap sheets, staff, trades, and everything that follows.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button size="lg" className="h-10 px-4 text-sm" asChild>
                <Link to="/league/create">Create a league</Link>
              </Button>
              {activeSave ? (
                <Button variant="outline" size="lg" className="h-10 px-4 text-sm" asChild>
                  <Link to={continuePath}>Continue {activeSave.name}</Link>
                </Button>
              ) : (
                <Button variant="outline" size="lg" className="h-10 px-4 text-sm" asChild>
                  <Link to="/league/saves">{loading ? "Checking saves" : "View your saves"}</Link>
                </Button>
              )}
            </div>
          </div>
          <div className="border border-border bg-card p-3 sm:p-4">
            <ProductPreview />
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted/35">
        <div className="mx-auto grid w-full max-w-[90rem] divide-y divide-border px-5 sm:px-8 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-12">
          <Proof label="League format" value="30 teams, one shared history" />
          <Proof label="Season control" value="Preseason to free agency" />
          <Proof label="Your saves" value={loading ? "Stored locally" : saves.length ? `${saves.length} local save${saves.length === 1 ? "" : "s"}` : "Stored locally"} />
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[90rem] gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.75fr_1fr] lg:gap-24 lg:px-12 lg:py-36">
        <div className="max-w-xl">
          <p className="text-sm font-medium text-muted-foreground">One season. A complete record.</p>
          <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
            Every decision leaves a paper trail.
          </h2>
          <p className="mt-5 max-w-[52ch] text-base leading-7 text-muted-foreground">
            Front Office Hoops keeps the standings, finances, schedule, and next move connected—so advancing the calendar never means losing the context.
          </p>
        </div>
        <ol className="border-t border-border">
          {operatingLoop.map(([title, body], index) => (
            <li key={title} className="grid gap-4 border-b border-border py-6 sm:grid-cols-[3rem_1fr] sm:gap-7">
              <span className="text-sm tabular-nums text-muted-foreground">0{index + 1}</span>
              <div>
                <h3 className="text-lg font-semibold tracking-[-0.02em]">{title}</h3>
                <p className="mt-2 max-w-[52ch] text-sm leading-6 text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto grid w-full max-w-[90rem] gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_0.8fr] lg:items-end lg:gap-24 lg:px-12 lg:py-28">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Built for the long view.</p>
            <h2 className="mt-5 max-w-[14ch] text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
              The game is not the interface. The decisions are.
            </h2>
          </div>
          <div className="border-l border-border pl-6 sm:pl-8">
            <p className="text-base leading-7 text-muted-foreground">
              Set the rules, choose a team, make the calls, and live with the outcomes. Start a league when you’re ready.
            </p>
            <Button size="lg" className="mt-7 h-10 px-4 text-sm" asChild>
              <Link to="/league/create">Create a league</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}

function Proof({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-5 md:px-6 md:first:pl-0 md:last:pr-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-sm font-medium tracking-[-0.01em]">{value}</p>
    </div>
  )
}

function ProductPreview() {
  return (
    <div className="overflow-hidden bg-foreground text-background">
      <div className="flex items-center justify-between border-b border-background/15 px-4 py-3 text-[0.6875rem] sm:px-5">
        <span className="font-semibold tracking-[-0.01em]">North Division</span>
        <div className="flex items-center gap-3 text-background/60">
          <span>2027–28</span>
          <span className="hidden sm:inline">Day 118</span>
        </div>
      </div>
      <div className="grid lg:grid-cols-[10.5rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-background/15 px-3 py-4 lg:block">
          <p className="px-2 text-[0.625rem] font-medium tracking-[0.08em] text-background/45 uppercase">League office</p>
          <div className="mt-3 space-y-0.5 text-xs text-background/65">
            {["Overview", "Schedule", "Transactions", "Roster", "Cap sheet", "Draft", "History"].map((item, index) => (
              <div key={item} className={`rounded-sm px-2 py-1.5 ${index === 0 ? "bg-background/10 text-background" : ""}`}>{item}</div>
            ))}
          </div>
        </aside>
        <div className="p-4 sm:p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[0.6875rem] text-background/55">League snapshot</p>
              <h2 className="mt-1 text-base font-semibold tracking-[-0.02em]">The board before the deadline.</h2>
            </div>
            <span className="hidden border border-background/20 px-2 py-1 text-[0.625rem] font-medium sm:inline">Advance day</span>
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="border border-background/15">
              <div className="flex items-center justify-between border-b border-background/15 px-3 py-2.5 text-[0.625rem] text-background/60">
                <span className="font-medium text-background">Standings watch</span><span>NET RTG</span>
              </div>
              <div className="divide-y divide-background/10">
                {standings.map(([rank, team, record, net]) => (
                  <div key={team} className="grid grid-cols-[1.7rem_1fr_3.1rem_2.5rem] gap-2 px-3 py-2 text-[0.6875rem] tabular-nums">
                    <span className="text-background/50">{rank}</span><span className="font-medium">{team}</span><span className="text-background/60">{record}</span><span>{net}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="border border-background/15 p-3">
              <p className="text-[0.625rem] font-medium text-background/60">Club ledger</p>
              <div className="mt-4 space-y-3">
                {ledger.map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-3 text-[0.6875rem]"><span className="text-background/55">{label}</span><span className="font-medium tabular-nums">{value}</span></div>
                ))}
              </div>
              <div className="mt-6 border-t border-background/15 pt-3 text-[0.625rem] text-background/55">Next decision</div>
              <p className="mt-1 text-[0.6875rem] font-medium">Review trade offers</p>
            </section>
          </div>
          <section className="mt-4 border border-background/15 p-3">
            <div className="flex items-center justify-between text-[0.625rem]"><span className="font-medium">Schedule window</span><span className="text-background/55">JAN 12–18</span></div>
            <div className="mt-3 grid grid-cols-7 gap-1.5">
              {Array.from({ length: 21 }).map((_, index) => <div key={index} className={`h-5 sm:h-6 ${index === 4 || index === 13 ? "bg-background" : index % 3 === 0 ? "bg-background/30" : "bg-background/10"}`} />)}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
