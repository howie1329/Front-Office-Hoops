import { createFileRoute, Link } from "@tanstack/react-router"

export const Route = createFileRoute("/league/start")({
  component: LeagueStartPage,
})

const entryOptions = [
  {
    title: "Create a new league",
    body: "Set the rules, generate the league, and choose the organization you want to run.",
    status: "League creation is next",
  },
  {
    title: "Load an existing league",
    body: "Return to a saved league and continue from the last committed day.",
    status: "Save manager is next",
  },
] as const

function LeagueStartPage() {
  return (
    <main className="min-h-svh bg-foreground text-background">
      <header className="mx-auto flex w-full max-w-[92rem] items-center justify-between border-b border-background/20 px-5 py-5 sm:px-8 lg:px-12">
        <Link
          to="/"
          className="text-sm font-semibold tracking-[-0.02em] text-background transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-background"
        >
          Front Office Hoops <span className="text-background/55">V2</span>
        </Link>
        <Link
          to="/"
          className="text-xs font-medium text-background/60 transition-colors hover:text-background focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-background"
        >
          Back to the game
        </Link>
      </header>

      <div className="mx-auto w-full max-w-[92rem] px-5 sm:px-8 lg:px-12">
        <section className="max-w-4xl border-b border-background/20 py-24 sm:py-32 lg:py-40">
          <p className="text-xs font-semibold tracking-[0.08em] text-background/55 uppercase">
            Begin a league
          </p>
          <h1 className="mt-8 max-w-3xl text-[clamp(3rem,8vw,7rem)] leading-[0.92] font-semibold tracking-[-0.045em] text-balance">
            Where do you want to start?
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-background/68 sm:text-xl sm:leading-9">
            Every franchise begins with a decision. Create a new world or pick
            up one you already started.
          </p>
        </section>

        <section className="border-b border-background/20">
          {entryOptions.map((option) => (
            <article
              key={option.title}
              className="grid gap-8 border-b border-background/20 py-14 last:border-b-0 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.6fr)] lg:items-start lg:gap-24"
            >
              <div>
                <h2 className="max-w-2xl text-3xl leading-[1.04] font-semibold tracking-[-0.035em] sm:text-5xl">
                  {option.title}
                </h2>
                <p className="mt-5 max-w-xl text-base leading-7 text-background/65 sm:text-lg sm:leading-8">
                  {option.body}
                </p>
              </div>
              <div className="border-t border-background/30 pt-4 lg:mt-2">
                <p className="text-xs font-semibold tracking-[0.08em] text-background/45 uppercase">
                  Next step
                </p>
                <p className="mt-4 text-lg font-medium text-background/78">
                  {option.status}
                </p>
              </div>
            </article>
          ))}
        </section>

        <footer className="flex flex-col gap-6 py-10 text-xs text-background/45 sm:flex-row sm:items-center sm:justify-between">
          <p>Front Office Hoops V2</p>
          <p>The league loop starts here.</p>
        </footer>
      </div>
    </main>
  )
}
