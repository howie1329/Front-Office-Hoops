import { createFileRoute, Link } from "@tanstack/react-router"

import { LeagueSavesPanel } from "@/components/league/LeagueSavesPanel"
import { useLeagueContext } from "@/contexts/LeagueContext"
import { ModeToggle } from "@/components/ModeToggle"
import { Button } from "@workspace/ui/components/button"

export const Route = createFileRoute("/league/saves")({
  component: LeagueSavesPage,
})

function LeagueSavesPage() {
  const {
    saves,
    activeLeagueId,
    switchLeague,
    deleteLeague,
    error,
  } = useLeagueContext()
  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
          <Link to="/" className="text-sm font-semibold underline-offset-4 hover:underline">
            Front Office Hoops
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">Home</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/league/create">Create league</Link>
            </Button>
            <ModeToggle />
          </div>
        </header>

        <section className="grid gap-6">
          <div className="flex max-w-3xl flex-col gap-2">
            <h1 className="text-2xl leading-tight font-semibold tracking-[-0.02em]">
              Saved leagues
            </h1>
            <p className="max-w-[68ch] text-sm leading-7 text-muted-foreground">
              Choose the league you want to run, finish setup for an incomplete
              save, or remove local saves you no longer need.
            </p>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </p>
          ) : null}

          <LeagueSavesPanel
            saves={saves}
            activeId={activeLeagueId}
            onSwitch={switchLeague}
            onDelete={deleteLeague}
          />
        </section>
      </div>
    </main>
  )
}
