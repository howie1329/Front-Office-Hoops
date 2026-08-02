import { createFileRoute, Link } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/")({ component: V2HomePage })

const roadmap = [
  {
    title: "The game",
    body: "A deterministic basketball simulation built around the decisions that shape a team.",
  },
  {
    title: "Player value",
    body: "Production, development, and market value that make every roster choice legible.",
  },
  {
    title: "The league",
    body: "A persistent world where seasons, contracts, and history compound over time.",
  },
] as const

function V2HomePage() {
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

          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-5 text-sm font-medium sm:gap-8"
          >
            <a
              href="#roadmap"
              className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              Roadmap
            </a>
            <a
              href="#game"
              className="hidden text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:inline"
            >
              The game
            </a>
            <Button asChild className="min-h-10 rounded-none px-4">
              <Link to="/league/start">
                Create league <span aria-hidden="true" className="ml-3">↗</span>
              </Link>
            </Button>
          </nav>
        </header>

        <section
          id="game"
          className="grid flex-1 content-center gap-14 py-14 sm:py-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] lg:gap-24 lg:py-8"
        >
          <div className="max-w-3xl">
            <p className="mb-6 text-sm font-medium text-muted-foreground">
              Front-office basketball, built for the long run.
            </p>
            <h1 className="max-w-3xl text-5xl leading-[0.98] font-semibold tracking-[-0.04em] text-balance sm:text-7xl lg:text-8xl">
              Build a franchise that lasts.
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl sm:leading-9">
              Front Office Hoops is a strategy game about roster construction,
              player development, and the choices that compound over time.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
              <Button asChild size="lg" className="rounded-none px-5">
                <Link to="/league/start">
                  Create your league <span aria-hidden="true" className="ml-5">↗</span>
                </Link>
              </Button>
              <Link
                to="/developer-labs"
                className="text-sm font-semibold text-foreground underline decoration-border underline-offset-8 transition-colors hover:text-muted-foreground hover:decoration-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                Explore the labs
              </Link>
            </div>
          </div>

          <section id="roadmap" aria-labelledby="roadmap-heading" className="lg:pt-3">
            <div className="border-t border-border pt-4">
              <h2 id="roadmap-heading" className="text-sm font-semibold">
                V2 roadmap
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                The order matters. Calibrate the engine, then build the world around it.
              </p>
            </div>

            <div className="mt-8">
              {roadmap.map((item) => (
                <article key={item.title} className="grid gap-2 border-b border-border py-4 sm:grid-cols-[8rem_1fr] sm:gap-6">
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{item.body}</p>
                </article>
              ))}
            </div>
          </section>
        </section>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-border py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Front Office Hoops V2</p>
          <p>Local-first. Fictional league. Long-term decisions.</p>
        </footer>
      </div>
    </main>
  )
}
