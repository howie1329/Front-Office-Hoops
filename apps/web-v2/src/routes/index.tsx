import { createFileRoute, Link } from "@tanstack/react-router"
import * as React from "react"

import { V2LeagueRepository } from "@workspace/db-v2"
import { createFoundationLeague } from "@workspace/domain-v2"
import type { WorkerResult } from "@workspace/sim-v2"

import { Button } from "@/components/ui/button"
import { runLeagueCommand } from "@/lib/leagueWorker"

export const Route = createFileRoute("/")({ component: V2HomePage })

const gamePillars = [
  {
    title: "Build the right roster",
    body: "Scout talent, manage contracts, and develop a team that fits your vision.",
  },
  {
    title: "Run the season",
    body: "Set a direction, respond to pressure, and watch your decisions meet the schedule.",
  },
  {
    title: "Create a history",
    body: "Stay for the years. Make the difficult calls and leave the franchise different.",
  },
] as const

function V2HomePage() {
  const [status, setStatus] = React.useState("")

  async function runFoundationRoundTrip() {
    const league = createFoundationLeague()
    const repository = new V2LeagueRepository()

    setStatus("Running the foundation check…")

    try {
      const result: WorkerResult = await runLeagueCommand({
        requestId: crypto.randomUUID(),
        command: { type: "NoOp", commandId: crypto.randomUUID() },
        league,
      })

      if (result.status !== "completed") {
        setStatus(
          result.reason?.message ??
            (result.status === "failed"
              ? "The foundation check failed."
              : "The foundation check was rejected.")
        )
        return
      }

      if (!result.league) {
        setStatus("The foundation check did not return a league document.")
        return
      }

      await repository.save(result.league)
      const loaded = await repository.load(result.league.metadata.id)

      if (!loaded) {
        setStatus("The document saved but could not be loaded again.")
        return
      }

      const exported = await repository.export(loaded.metadata.id)
      const imported = await repository.import(exported)
      const unchanged = JSON.stringify(imported) === JSON.stringify(league)

      setStatus(
        unchanged
          ? "Foundation check complete: worker, local save, and JSON export are connected."
          : "Foundation check complete, but the exported document changed."
      )
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "The foundation check could not be completed."
      )
    }
  }

  return (
    <main className="min-h-svh overflow-hidden bg-foreground text-background selection:bg-background selection:text-foreground">
      <header className="mx-auto flex w-full max-w-[92rem] items-center justify-between border-b border-background/20 px-5 py-5 sm:px-8 lg:px-12">
        <Link
          to="/"
          className="text-sm font-semibold tracking-[-0.02em] text-background transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-background"
        >
          Front Office Hoops <span className="text-background/55">V2</span>
        </Link>

        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-7 text-xs font-medium text-background/65 sm:flex"
        >
          <a
            href="#the-game"
            className="transition-colors hover:text-background focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-background"
          >
            The game
          </a>
          <a
            href="#the-loop"
            className="transition-colors hover:text-background focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-background"
          >
            The loop
          </a>
          <Link
            to="/developer-labs"
            className="transition-colors hover:text-background focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-background"
          >
            Developer labs
          </Link>
        </nav>
      </header>

      <div className="mx-auto w-full max-w-[92rem] px-5 sm:px-8 lg:px-12">
        <section
          id="the-game"
          className="grid gap-16 border-b border-background/20 py-24 sm:py-32 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.65fr)] lg:gap-20 lg:py-40"
        >
          <div className="max-w-5xl">
            <p className="mb-8 text-xs font-semibold tracking-[0.08em] text-background/55 uppercase sm:mb-10">
              The front-office game
            </p>
            <h1 className="max-w-5xl text-[clamp(3.75rem,11vw,10rem)] leading-[0.88] font-semibold tracking-[-0.045em] text-balance">
              Build a dynasty.
              <span className="mt-6 block text-background/48">
                Every decision shapes the future.
              </span>
            </h1>
            <p className="mt-10 max-w-2xl text-lg leading-8 text-background/72 sm:mt-12 sm:text-xl sm:leading-9">
              Front Office Hoops is a strategy game about building a roster,
              running a league, and making decisions that compound over time.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 sm:mt-12">
              <a
                href="#the-loop"
                className="inline-flex min-h-12 items-center bg-background px-5 text-sm font-semibold text-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-background"
              >
                See the game
                <span aria-hidden="true" className="ml-5 text-base">
                  ↓
                </span>
              </a>
              <Link
                to="/developer-labs"
                className="inline-flex min-h-12 items-center border-b border-background/55 text-sm font-semibold text-background transition-colors hover:border-background hover:text-background/75 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-background"
              >
                Explore the engine
                <span aria-hidden="true" className="ml-4 text-base">
                  ↗
                </span>
              </Link>
            </div>
          </div>

          <div className="flex items-end lg:pb-2">
            <div className="max-w-sm border-t border-background/40 pt-5">
              <p className="text-xs font-semibold tracking-[0.08em] text-background/55 uppercase">
                The premise
              </p>
              <p className="mt-5 text-2xl leading-[1.15] font-medium tracking-[-0.025em] text-background/88 sm:text-3xl">
                There is no perfect roster. Only the one you can build, explain,
                and live with.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-10 border-b border-background/20 py-20 sm:py-24 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-24 lg:py-32">
          <h2 className="max-w-md text-3xl leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-4xl">
            The work is the game.
          </h2>
          <p className="max-w-2xl text-xl leading-9 text-background/68 sm:text-2xl sm:leading-10">
            Scout with incomplete information. Balance ambition against the
            cap. Make a decision before you know exactly how it will turn out.
            Then keep going long enough to see what it changed.
          </p>
        </section>

        <section id="the-loop" className="border-b border-background/20">
          {gamePillars.map((pillar, index) => (
            <article
              key={pillar.title}
              className="grid gap-8 border-b border-background/20 py-14 last:border-b-0 sm:py-20 lg:grid-cols-[minmax(12rem,0.6fr)_minmax(0,1.4fr)] lg:items-start lg:gap-20"
            >
              <p className="text-xs font-semibold tracking-[0.08em] text-background/45 uppercase">
                {index === 0 ? "Start with the roster" : index === 1 ? "Stay for the season" : "Play for the years"}
              </p>
              <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.65fr)] sm:gap-12">
                <h3 className="max-w-xl text-3xl leading-[1.04] font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
                  {pillar.title}
                </h3>
                <p className="max-w-sm text-base leading-7 text-background/65">
                  {pillar.body}
                </p>
              </div>
            </article>
          ))}
        </section>

        <section className="grid gap-12 border-b border-background/20 py-20 sm:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)] lg:gap-24 lg:py-32">
          <div>
            <p className="text-xs font-semibold tracking-[0.08em] text-background/55 uppercase">
              Designed for consequence
            </p>
            <h2 className="mt-6 max-w-3xl text-4xl leading-[0.98] font-semibold tracking-[-0.04em] text-balance sm:text-6xl">
              A league that remembers what you chose.
            </h2>
          </div>
          <div className="max-w-md lg:pt-12">
            <p className="text-base leading-7 text-background/68 sm:text-lg sm:leading-8">
              Player value, injuries, contracts, development, and history are
              part of the same world. The goal is not to win one screen. It is
              to build an organization you still want to run ten seasons from
              now.
            </p>
          </div>
        </section>

        <section
          id="labs"
          className="-mx-5 grid gap-12 bg-background px-5 py-20 text-foreground sm:-mx-8 sm:px-8 sm:py-24 lg:-mx-12 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.65fr)] lg:gap-24 lg:px-12 lg:py-32"
        >
          <div>
            <p className="text-xs font-semibold tracking-[0.08em] text-foreground/52 uppercase">
              Current V2 build
            </p>
            <h2 className="mt-6 max-w-3xl text-4xl leading-[0.98] font-semibold tracking-[-0.04em] text-balance sm:text-6xl">
              The engine is being built in public.
            </h2>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-foreground/68">
              The full league loop is ahead. Today, V2 exposes the systems that
              will make it worth playing: player generation, game simulation,
              production, careers, markets, and draft decisions.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
              <Link
                to="/developer-labs"
                className="inline-flex min-h-12 items-center bg-foreground px-5 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
              >
                Open developer labs
                <span aria-hidden="true" className="ml-5 text-base">
                  ↗
                </span>
              </Link>
              <Button
                type="button"
                onClick={() => void runFoundationRoundTrip()}
                className="min-h-12 border-0 bg-transparent px-0 text-sm font-semibold text-foreground underline decoration-foreground/35 underline-offset-8 hover:bg-transparent hover:text-foreground hover:decoration-foreground"
              >
                Run foundation check
              </Button>
            </div>
            <p
              className="mt-6 max-w-2xl text-sm leading-6 text-foreground/58"
              aria-live="polite"
            >
              {status}
            </p>
          </div>
          <div className="border-t border-foreground/20 pt-5 lg:pt-0 lg:pl-8 lg:border-t-0 lg:border-l">
            <p className="text-sm leading-6 text-foreground/58">
              A focused place to inspect the model before it becomes gameplay.
            </p>
            <p className="mt-8 text-2xl leading-[1.15] font-medium tracking-[-0.025em] text-foreground sm:text-3xl">
              Calibrate the engine. Then build the league.
            </p>
          </div>
        </section>

        <footer className="flex flex-col gap-6 py-10 text-xs text-background/45 sm:flex-row sm:items-center sm:justify-between">
          <p>Front Office Hoops V2</p>
          <p>Local-first. Fictional league. Long-term decisions.</p>
        </footer>
      </div>
    </main>
  )
}
