import { useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import type { LeagueSummary, SeasonPhase } from "@workspace/shared/types"
import { LEAGUE_TEAM_COUNT } from "@workspace/shared/constants"
import { Button } from "@workspace/ui/components/button"

import { ModeToggle } from "@/components/ModeToggle"
import { useLeagueSaves } from "@/hooks/useLeagueSaves"

export const Route = createFileRoute("/")({ component: App })

const PHASE_LABELS: Record<SeasonPhase, string> = {
  preseason: "Preseason",
  regular: "Regular season",
  playoffs: "Playoffs",
  complete: "Season complete",
  offseason: "Offseason",
}

function formatLastPlayed(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })

  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)

  if (dayDiff === 0) {
    return `Today, ${time}`
  }

  if (dayDiff === 1) {
    return `Yesterday, ${time}`
  }

  const sameYear = date.getFullYear() === now.getFullYear()
  const day = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })

  return sameYear ? `${day}, ${time}` : day
}

function saveMetadata(save: LeagueSummary): string[] {
  const parts = [`Season ${save.season}`, PHASE_LABELS[save.phase]]

  if (save.teamCount !== LEAGUE_TEAM_COUNT) {
    parts.push(`${save.teamCount}-team lab`)
  }

  if (save.teamName) {
    parts.push(save.teamName)

    if (save.wins !== null && save.losses !== null) {
      parts.push(`${save.wins}-${save.losses}`)
    }
  } else {
    parts.push("No team selected")
  }

  return parts
}

function MetadataLine({ save }: { save: LeagueSummary }) {
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      {saveMetadata(save).map((part, index) => (
        <span key={part + String(index)}>
          {index > 0 ? <span aria-hidden="true"> · </span> : null}
          {part}
        </span>
      ))}
      <span aria-hidden="true"> · </span>
      <time dateTime={save.updatedAt}>
        Last played {formatLastPlayed(save.updatedAt)}
      </time>
    </p>
  )
}

function SkeletonBand({ tall }: { tall?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-lg ring-1 ring-foreground/10 ${
        tall ? "p-5" : "p-4"
      }`}
    >
      <div className="flex min-w-0 flex-1 animate-pulse flex-col gap-2 motion-reduce:animate-none">
        <div
          className={`rounded-sm bg-muted ${tall ? "h-5 w-48" : "h-4 w-40"}`}
        />
        <div className="h-3 w-72 max-w-full rounded-sm bg-muted/70" />
      </div>
      <div className="h-8 w-24 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
    </div>
  )
}

function App() {
  const { saves, activeSave, loading, error, retry, switchLeague } =
    useLeagueSaves()
  const navigate = useNavigate()
  const [pendingLoadId, setPendingLoadId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const hasSave = saves.length > 0
  const recentSaves = saves
    .filter((save) => save.id !== activeSave?.id)
    .slice(0, 3)

  async function handleLoad(save: LeagueSummary) {
    setLoadError(null)
    setPendingLoadId(save.id)

    try {
      await switchLeague(save.id)
      void navigate({
        to: save.userTeamId ? "/league" : "/league/pick-team",
      })
    } catch {
      setLoadError(`Couldn't load "${save.name}". Try again.`)
    } finally {
      setPendingLoadId(null)
    }
  }

  return (
    <main className="min-h-svh bg-background px-4 py-10 text-foreground sm:px-6">
      <div className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-[880px] flex-col">
        <header className="flex items-start justify-between gap-4 pb-6">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="text-sm font-semibold tracking-[0.08em] uppercase">
              Front Office Hoops
            </h1>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Basketball GM simulation. Your leagues live on this device.
            </p>
          </div>
          <ModeToggle />
        </header>

        <div className="border-t border-foreground/10" role="presentation" />

        <section
          aria-label="Your leagues"
          className="flex flex-1 flex-col justify-center gap-3 py-8"
        >
          {loading ? (
            <>
              <SkeletonBand tall />
              <SkeletonBand />
              <SkeletonBand />
            </>
          ) : null}

          {!loading && error ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg p-5 ring-1 ring-foreground/10">
              <div className="min-w-0">
                <p className="text-sm font-medium">Couldn't read your saves</p>
                <p className="text-xs leading-relaxed text-destructive">
                  {error}
                </p>
              </div>
              <Button size="lg" variant="outline" onClick={() => void retry()}>
                Try again
              </Button>
            </div>
          ) : null}

          {!loading && !error && !hasSave ? (
            <div className="flex flex-col gap-4 rounded-lg p-6 ring-1 ring-foreground/10">
              <div className="flex flex-col gap-1.5">
                <h2 className="text-lg font-medium text-balance">
                  Start your first league
                </h2>
                <p className="max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
                  Create a league, pick the team you'll run, and take over the
                  front office: roster, trades, draft, finances, and the
                  schedule from preseason to the title.
                </p>
              </div>
              <div>
                <Button size="lg" asChild>
                  <Link to="/league/create">Create your first league</Link>
                </Button>
              </div>
            </div>
          ) : null}

          {!loading && !error && activeSave ? (
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-lg bg-card p-5 ring-1 ring-foreground/15">
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="truncate text-xl font-medium tracking-[-0.01em]">
                  {activeSave.name}
                </h2>
                <MetadataLine save={activeSave} />
              </div>
              <Button size="lg" asChild>
                <Link
                  to={activeSave.userTeamId ? "/league" : "/league/pick-team"}
                >
                  {activeSave.userTeamId ? "Continue" : "Finish setup"}
                </Link>
              </Button>
            </div>
          ) : null}

          {!loading && !error && recentSaves.length > 0 ? (
            <ul className="flex flex-col gap-3" aria-label="Other saves">
              {recentSaves.map((save) => (
                <li
                  key={save.id}
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg p-4 ring-1 ring-foreground/10 transition-colors duration-150 hover:bg-card motion-reduce:transition-none"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <h3 className="truncate text-sm font-medium">
                      {save.name}
                    </h3>
                    <MetadataLine save={save} />
                  </div>
                  <Button
                    size="lg"
                    variant="outline"
                    disabled={pendingLoadId !== null}
                    onClick={() => void handleLoad(save)}
                  >
                    {pendingLoadId === save.id ? "Loading…" : "Load"}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          {loadError ? (
            <p role="alert" className="text-xs text-destructive">
              {loadError}
            </p>
          ) : null}

          {!loading && !error && hasSave ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="lg" variant="outline" asChild>
                <Link to="/league/create">Create new league</Link>
              </Button>
              <Button size="lg" variant="ghost" asChild>
                <Link to="/league/saves">
                  Manage saves
                  {saves.length > recentSaves.length + (activeSave ? 1 : 0)
                    ? ` (${saves.length})`
                    : ""}
                </Link>
              </Button>
            </div>
          ) : null}
        </section>

        <footer className="flex items-center justify-between gap-3 border-t border-foreground/10 pt-4 text-xs text-muted-foreground">
          <span>Developer tools</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/sim-lab">Sim Lab</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/season-lab">Season Lab</Link>
            </Button>
          </div>
        </footer>
      </div>
    </main>
  )
}
