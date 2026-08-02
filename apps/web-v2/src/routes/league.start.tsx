import { createFileRoute, Link } from "@tanstack/react-router"

export const Route = createFileRoute("/league/start")({
  component: LeagueStartPage,
})

const entryOptions = [
  {
    title: "Create a new league",
    body: "Build a fictional basketball world from the recommended V2 settings, then choose the franchise you want to run.",
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
    <main className="min-h-svh bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <div className="mx-auto flex min-h-svh w-full max-w-[88rem] flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex shrink-0 items-center justify-between border-b border-border py-5">
          <Link
            to="/"
            className="text-sm font-semibold tracking-[-0.02em] transition-colors hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Front Office Hoops <span className="text-muted-foreground">/ V2</span>
          </Link>
          <Link
            to="/"
            className="text-sm font-medium text-muted-foreground underline decoration-border underline-offset-8 transition-colors hover:text-foreground hover:decoration-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Back to the game
          </Link>
        </header>

        <section
          aria-labelledby="start-heading"
          className="grid flex-1 content-center gap-12 py-14 sm:py-16 lg:grid-cols-[minmax(0,0.8fr)_minmax(22rem,1.2fr)] lg:gap-24 lg:py-12"
        >
          <div className="max-w-xl">
            <p className="mb-6 text-sm font-medium text-muted-foreground">
              Start a league
            </p>
            <h1
              id="start-heading"
              className="max-w-lg text-5xl leading-[0.98] font-semibold tracking-[-0.04em] text-balance sm:text-6xl"
            >
              Choose your starting point.
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-8 text-muted-foreground">
              The league loop is being built in order: create the world, choose
              a franchise, then make the decisions that shape its history.
            </p>
          </div>

          <section aria-labelledby="entry-options-heading" className="border-t border-border">
            <h2 id="entry-options-heading" className="sr-only">
              League entry options
            </h2>
            {entryOptions.map((option) => (
              <article
                key={option.title}
                className="grid gap-6 border-b border-border py-6 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-start sm:gap-10 sm:py-8"
              >
                <div>
                  <h3 className="text-2xl leading-tight font-semibold tracking-[-0.025em] sm:text-3xl">
                    {option.title}
                  </h3>
                  <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
                    {option.body}
                  </p>
                </div>
                <div className="border-t border-border pt-3 sm:mt-1">
                  <p className="text-sm font-semibold">Next in V2</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {option.status}
                  </p>
                </div>
              </article>
            ))}
          </section>
        </section>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-border py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Front Office Hoops V2</p>
          <p>The league loop starts here.</p>
        </footer>
      </div>
    </main>
  )
}
