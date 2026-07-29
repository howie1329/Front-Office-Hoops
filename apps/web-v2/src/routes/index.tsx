import { createFileRoute, Link } from "@tanstack/react-router"
import * as React from "react"

import { V2LeagueRepository } from "@workspace/db-v2"
import { createFoundationLeague } from "@workspace/domain-v2"
import type { WorkerResult } from "@workspace/sim-v2"

import { Button } from "@/components/ui/button"
import { runLeagueCommand } from "@/lib/leagueWorker"

export const Route = createFileRoute("/")({ component: V2HomePage })

function V2HomePage() {
  const [status, setStatus] = React.useState(
    "Ready to run the foundation round trip."
  )

  async function runFoundationRoundTrip() {
    const league = createFoundationLeague()
    const repository = new V2LeagueRepository()

    setStatus("Sending NoOp command through the worker…")

    try {
      const result: WorkerResult = await runLeagueCommand({
        requestId: crypto.randomUUID(),
        command: { type: "NoOp", commandId: crypto.randomUUID() },
        league,
      })

      if (result.status !== "completed" || !result.league) {
        setStatus(result.reason?.message ?? "The worker rejected the command.")
        return
      }

      await repository.save(result.league)
      const loaded = await repository.load(result.league.metadata.id)

      if (!loaded) {
        setStatus("The document was saved but could not be loaded.")
        return
      }

      const exported = await repository.export(loaded.metadata.id)
      const imported = await repository.import(exported)
      const unchanged = JSON.stringify(imported) === JSON.stringify(league)

      setStatus(
        unchanged
          ? "Round trip complete: worker, Dexie, and JSON preserved the fixture."
          : "Round trip completed, but the fixture changed."
      )
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Round trip failed.")
    }
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm text-muted-foreground">
        Front Office Hoops v2 foundation
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">
        Document round trip
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Validate a fixture, send a no-op command through the worker, save it to
        Dexie, reload it, and verify the exported facts.
      </p>
      <Button onClick={() => void runFoundationRoundTrip()}>
        Run foundation round trip
      </Button>
      <Button variant="outline" asChild>
        <Link to="/developer-labs">Open developer labs</Link>
      </Button>
      <p className="max-w-xl text-sm" role="status" aria-live="polite">
        {status}
      </p>
    </main>
  )
}
