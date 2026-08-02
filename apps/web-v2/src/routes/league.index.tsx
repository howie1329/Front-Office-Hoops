import { createFileRoute, Link } from "@tanstack/react-router"
import * as React from "react"

import type { LeagueDocument } from "@workspace/domain-v2"
import { V2LeagueRepository } from "@workspace/db-v2"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { Separator } from "@workspace/ui/components/separator"

export const Route = createFileRoute("/league/")({
  component: LeagueShellPage,
})

const repository = new V2LeagueRepository()

function phaseLabel(phase: LeagueDocument["state"]["phase"]): string {
  return {
    foundation: "Foundation",
    preseason: "Preseason",
    "regular-season": "Regular season",
    playoffs: "Playoffs",
    offseason: "Offseason",
  }[phase]
}

function LeagueShellPage() {
  const { saveId } = Route.useSearch()
  const [league, setLeague] = React.useState<LeagueDocument | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true

    async function loadLeague() {
      try {
        const id = saveId ?? (await repository.list())[0]?.id
        const document = id ? await repository.load(id) : null

        if (!active) return
        if (!document) {
          setError("That league could not be found in this browser.")
        } else {
          setLeague(document)
        }
      } catch {
        if (active)
          setError("That league could not be loaded from this browser.")
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadLeague()
    return () => {
      active = false
    }
  }, [saveId])

  if (isLoading) {
    return (
      <main className="grid min-h-svh place-items-center bg-background px-5 text-sm text-muted-foreground">
        Loading league…
      </main>
    )
  }

  if (error || !league) {
    return (
      <main className="min-h-svh bg-background px-5 py-8 text-foreground sm:px-8 lg:px-12">
        <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-10">
          <Link
            to="/league/start"
            className="w-fit text-sm text-muted-foreground underline underline-offset-8 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Back to saves
          </Link>
          <Empty className="items-start rounded-none border-y border-border px-0 py-12 text-left">
            <EmptyHeader className="items-start text-left">
              <EmptyTitle>League unavailable.</EmptyTitle>
              <EmptyDescription>
                {error ?? "No league is selected."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </main>
    )
  }

  const userTeam = league.state.userTeamId
    ? league.entities.teams[league.state.userTeamId]
    : null
  const roster = userTeam?.rosterPlayerIds ?? []
  const division = userTeam?.divisionId
    ? league.state.structure?.divisions.find(
        (item) => item.id === userTeam.divisionId
      )
    : null
  const conference = division?.conferenceId
    ? league.state.structure?.conferences.find(
        (item) => item.id === division.conferenceId
      )
    : null

  return (
    <main className="min-h-svh bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <div className="mx-auto flex min-h-svh w-full max-w-[88rem] flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex shrink-0 items-center justify-between border-b border-border py-5">
          <Link
            to="/league/start"
            className="text-sm font-semibold tracking-[-0.02em] transition-colors hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Front Office Hoops{" "}
            <span className="text-muted-foreground">/ V2</span>
          </Link>
          <Button variant="ghost" asChild>
            <Link to="/league/start">Save manager</Link>
          </Button>
        </header>

        <section className="grid flex-1 content-center gap-12 py-14 lg:grid-cols-[minmax(0,0.7fr)_minmax(28rem,1.3fr)] lg:gap-24 lg:py-12">
          <div className="max-w-xl">
            <p className="mb-6 text-sm font-medium text-muted-foreground">
              {phaseLabel(league.state.phase)} · Season {league.state.season}
            </p>
            <h1 className="max-w-lg text-5xl leading-[0.98] font-semibold tracking-[-0.04em] text-balance sm:text-6xl">
              {userTeam?.name ?? league.metadata.name}
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-8 text-muted-foreground">
              Your league is saved locally and ready for the next V2 lifecycle
              surface.
            </p>
          </div>

          <section
            aria-labelledby="league-overview-heading"
            className="min-w-0"
          >
            <h2 id="league-overview-heading" className="text-sm font-semibold">
              League overview
            </h2>
            <Separator className="my-7" />
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="w-1/2 font-medium text-muted-foreground">
                    League
                  </TableCell>
                  <TableCell>{league.metadata.name}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-muted-foreground">
                    Team
                  </TableCell>
                  <TableCell>{userTeam?.name ?? "No team selected"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-muted-foreground">
                    Roster
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {roster.length} players
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-muted-foreground">
                    Conference
                  </TableCell>
                  <TableCell>{conference?.name ?? "—"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-muted-foreground">
                    Division
                  </TableCell>
                  <TableCell>{division?.name ?? "—"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-muted-foreground">
                    Current date
                  </TableCell>
                  <TableCell>{league.state.calendar.currentDate}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p className="mt-7 text-sm leading-6 text-muted-foreground">
              The calendar and schedule are now part of the authoritative league
              document. Simulation controls will attach to this shell next.
            </p>
          </section>
        </section>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-border py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{league.metadata.name}</p>
          <p>Saved locally in this browser.</p>
        </footer>
      </div>
    </main>
  )
}
