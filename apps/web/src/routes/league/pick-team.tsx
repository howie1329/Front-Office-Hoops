import {
  createFileRoute,
  Link,
  Navigate,
  useNavigate,
} from "@tanstack/react-router"
import {
  ArrowRight01Icon,
  Building01Icon,
  ChampionIcon,
  Money01Icon,
  RefreshIcon,
  Search01Icon,
  Target01Icon,
  Tick02Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMemo, useRef, useState } from "react"

import { teamName } from "@/components/league/lib/teamFormat"
import {
  formatMarketTier,
  formatMoney,
} from "@/components/league/lib/moneyFormat"
import { useLeagueContext } from "@/contexts/LeagueContext"
import {
  getCapSpace,
  getSeasonFinancials,
  getTeamPayroll,
} from "@workspace/sim"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

export const Route = createFileRoute("/league/pick-team")({
  component: LeaguePickTeamPage,
})

type ConferenceFilter = "all" | "east" | "west"
type ChallengeId =
  "all" | "win_now" | "build_youth" | "cap_flexibility" | "restore"
type SortKey = "name" | "talent" | "cap" | "market" | "direction"
type SortDirection = "asc" | "desc"

type TeamOption = {
  id: string
  name: string
  abbrev: string
  conferenceId: string | undefined
  divisionId: string | undefined
  overall: number
  payroll: number | null
  capSpace: number | null
  market: "large" | "mid" | "small" | null
  challenge: Exclude<ChallengeId, "all">
  youngCoreCount: number
  topPlayer: string | null
  topPlayerOverall: number | null
}

const challenges: {
  id: Exclude<ChallengeId, "all">
  label: string
  shortLabel: string
  description: string
  icon: typeof ChampionIcon
}[] = [
  {
    id: "win_now",
    label: "Win now",
    shortLabel: "Win now",
    description: "Push a contender through its current window.",
    icon: ChampionIcon,
  },
  {
    id: "build_youth",
    label: "Build around youth",
    shortLabel: "Build youth",
    description: "Develop a young core into a sustainable winner.",
    icon: UserGroupIcon,
  },
  {
    id: "cap_flexibility",
    label: "Create cap flexibility",
    shortLabel: "Create space",
    description: "Open room and reshape the roster on your terms.",
    icon: Money01Icon,
  },
  {
    id: "restore",
    label: "Restore a franchise",
    shortLabel: "Restore",
    description: "Take on a longer rebuild and reset the direction.",
    icon: Building01Icon,
  },
]

const challengeOrder = new Map(
  challenges.map((challenge, index) => [challenge.id, index])
)

function LeaguePickTeamPage() {
  const navigate = useNavigate()
  const { status, seasonState, userTeamId, setUserTeamId, error, league } =
    useLeagueContext()
  const [conference, setConference] = useState<ConferenceFilter>("all")
  const [challenge, setChallenge] = useState<ChallengeId>("all")
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<{
    key: SortKey
    direction: SortDirection
  }>({ key: "name", direction: "asc" })
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const seasonFinancials =
    league && seasonState
      ? getSeasonFinancials(league.leagueFinancials, seasonState.season)
      : null

  const teamOptions = useMemo<TeamOption[]>(() => {
    if (!seasonState) {
      return []
    }

    return seasonState.teams.map((team) => {
      const teamFinance = league?.teamFinancials.find(
        (entry) => entry.teamId === team.id
      )
      const payroll = league ? getTeamPayroll(team.id, league.contracts) : null
      const capSpace =
        payroll !== null && seasonFinancials
          ? getCapSpace(payroll, seasonFinancials.salaryCap)
          : null
      const youngCoreCount = team.players.filter(
        (player) => player.age <= 24 && player.ratings.overall >= 68
      ).length
      const topPlayer = team.players
        .slice()
        .sort((a, b) => b.ratings.overall - a.ratings.overall)[0]

      return {
        id: team.id,
        name: teamName(seasonState, team.id),
        abbrev: team.abbrev,
        conferenceId: team.conferenceId,
        divisionId: team.divisionId,
        overall: team.overall,
        payroll,
        capSpace,
        market: teamFinance?.spendingProfile.marketTier ?? null,
        challenge: getTeamChallenge({
          overall: team.overall,
          youngCoreCount,
          capSpace,
          mode: teamFinance?.strategy.mode ?? null,
        }),
        youngCoreCount,
        topPlayer: `${topPlayer.firstName} ${topPlayer.lastName}`,
        topPlayerOverall: topPlayer.ratings.overall,
      }
    })
  }, [league, seasonFinancials, seasonState])

  const visibleTeams = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const marketRank = { small: 0, mid: 1, large: 2 }

    return teamOptions
      .filter(
        (team) =>
          (conference === "all" || team.conferenceId === conference) &&
          (challenge === "all" || team.challenge === challenge) &&
          (!normalizedQuery ||
            team.name.toLowerCase().includes(normalizedQuery) ||
            team.abbrev.toLowerCase().includes(normalizedQuery))
      )
      .sort((a, b) => {
        let comparison = 0

        switch (sort.key) {
          case "name":
            comparison = a.name.localeCompare(b.name)
            break
          case "talent":
            comparison = a.overall - b.overall
            break
          case "cap":
            comparison = (a.capSpace ?? -Infinity) - (b.capSpace ?? -Infinity)
            break
          case "market":
            comparison =
              (a.market ? marketRank[a.market] : -1) -
              (b.market ? marketRank[b.market] : -1)
            break
          case "direction":
            comparison =
              (challengeOrder.get(a.challenge) ?? 0) -
              (challengeOrder.get(b.challenge) ?? 0)
            break
        }

        return sort.direction === "asc" ? comparison : -comparison
      })
  }, [challenge, conference, query, sort, teamOptions])

  const selectedTeam =
    teamOptions.find((team) => team.id === selectedTeamId) ?? null
  const selectedChallenge = selectedTeam
    ? challenges.find((entry) => entry.id === selectedTeam.challenge)
    : null

  if (status === "empty") {
    return <Navigate to="/league/create" />
  }

  if (userTeamId) {
    return <Navigate to="/league" />
  }

  if (!seasonState) {
    return null
  }

  function setSortKey(key: SortKey) {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }))
  }

  function clearFilters() {
    setConference("all")
    setChallenge("all")
    setQuery("")
  }

  function selectAdjacentTeam(currentIndex: number, offset: number) {
    const nextIndex = currentIndex + offset
    if (nextIndex < 0 || nextIndex >= visibleTeams.length) {
      return
    }

    const nextTeam = visibleTeams[nextIndex]
    setSelectedTeamId(nextTeam.id)
    rowRefs.current[nextTeam.id]?.focus()
  }

  async function handleConfirmTeam() {
    if (!selectedTeamId) {
      return
    }

    setSubmitting(true)

    try {
      await setUserTeamId(selectedTeamId)
      void navigate({ to: "/league" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 xl:h-[calc(100svh-3rem)] xl:overflow-hidden xl:px-px xl:pb-px">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-xl leading-tight font-medium">Pick your team</h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Choose the challenge that fits your style, then select a franchise.
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-11 md:h-6" asChild>
          <Link to="/">Home</Link>
        </Button>
      </header>

      <section aria-labelledby="challenge-heading" className="shrink-0">
        <h2 id="challenge-heading" className="mb-2 text-sm font-medium">
          What kind of job do you want?
        </h2>
        <div
          role="group"
          aria-label="Franchise challenge"
          className="grid overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-4"
        >
          {challenges.map((option) => {
            const isActive = challenge === option.id

            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isActive}
                className={cn(
                  "flex min-h-20 items-start gap-3 border-b p-3 text-left transition-colors duration-150 outline-none last:border-b-0 focus-visible:relative focus-visible:ring-2 focus-visible:ring-ring/50 lg:min-h-24 lg:border-r lg:border-b-0 lg:last:border-r-0 sm:[&:nth-child(3)]:border-b-0 sm:[&:nth-child(odd)]:border-r",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted/60"
                )}
                onClick={() =>
                  setChallenge((current) =>
                    current === option.id ? "all" : option.id
                  )
                }
              >
                <HugeiconsIcon
                  icon={option.icon}
                  strokeWidth={1.8}
                  className="mt-0.5 size-5 shrink-0"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {option.label}
                  </span>
                  <span
                    className={cn(
                      "mt-1 block text-xs leading-5",
                      isActive
                        ? "text-primary-foreground/75"
                        : "text-muted-foreground"
                    )}
                  >
                    {option.description}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="flex shrink-0 flex-col gap-3 border-b p-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-72">
            <label htmlFor="team-search" className="sr-only">
              Search teams
            </label>
            <HugeiconsIcon
              icon={Search01Icon}
              strokeWidth={2}
              className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="team-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search teams"
              className="h-11 bg-background pl-7 text-sm md:h-8 md:text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Conference"
              className="inline-flex overflow-hidden rounded-md border"
            >
              {(["all", "east", "west"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={conference === option}
                  className={cn(
                    "h-11 border-r px-3 text-xs font-medium transition-colors outline-none last:border-r-0 focus-visible:relative focus-visible:ring-2 focus-visible:ring-ring/50 md:h-8",
                    conference === option
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted"
                  )}
                  onClick={() => setConference(option)}
                >
                  {option === "all"
                    ? "All teams"
                    : option === "east"
                      ? "East"
                      : "West"}
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="h-11 md:h-8"
              onClick={clearFilters}
              disabled={
                conference === "all" && challenge === "all" && !query.trim()
              }
            >
              <HugeiconsIcon icon={RefreshIcon} data-icon="inline-start" />
              Clear filters
            </Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-h-0 overflow-auto">
            <table className="w-full min-w-[680px] border-collapse text-xs tabular-nums">
              <caption className="sr-only">
                Choose from {visibleTeams.length} available teams
              </caption>
              <thead className="sticky top-0 z-10 bg-background">
                <tr className="border-b">
                  <SortableHeader
                    label="Team"
                    sortKey="name"
                    currentSort={sort}
                    onSort={setSortKey}
                    className="w-[34%] min-w-52"
                  />
                  <SortableHeader
                    label="Talent"
                    sortKey="talent"
                    currentSort={sort}
                    onSort={setSortKey}
                    className="w-24"
                  />
                  <SortableHeader
                    label="Cap flexibility"
                    sortKey="cap"
                    currentSort={sort}
                    onSort={setSortKey}
                    className="w-32"
                  />
                  <SortableHeader
                    label="Market"
                    sortKey="market"
                    currentSort={sort}
                    onSort={setSortKey}
                    className="w-28"
                  />
                  <SortableHeader
                    label="Direction"
                    sortKey="direction"
                    currentSort={sort}
                    onSort={setSortKey}
                    className="w-36"
                  />
                </tr>
              </thead>
              <tbody>
                {visibleTeams.map((team, index) => {
                  const isSelected = selectedTeamId === team.id
                  const teamChallenge = challenges.find(
                    (entry) => entry.id === team.challenge
                  )

                  return (
                    <tr
                      key={team.id}
                      className={cn(
                        "group cursor-pointer border-b transition-colors duration-150 last:border-b-0 hover:bg-muted/60",
                        isSelected && "bg-muted"
                      )}
                      onClick={() => setSelectedTeamId(team.id)}
                    >
                      <td className="h-11 p-0 md:h-10">
                        <button
                          ref={(element) => {
                            rowRefs.current[team.id] = element
                          }}
                          type="button"
                          tabIndex={
                            isSelected || (!selectedTeamId && index === 0)
                              ? 0
                              : -1
                          }
                          aria-pressed={isSelected}
                          className="flex min-h-11 w-full min-w-0 items-center gap-2.5 px-3 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset md:min-h-10"
                          onClick={() => setSelectedTeamId(team.id)}
                          onKeyDown={(event) => {
                            if (event.key === "ArrowDown") {
                              event.preventDefault()
                              selectAdjacentTeam(index, 1)
                            } else if (event.key === "ArrowUp") {
                              event.preventDefault()
                              selectAdjacentTeam(index, -1)
                            }
                          }}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "flex size-4 shrink-0 items-center justify-center rounded-full border",
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background"
                            )}
                          >
                            {isSelected ? (
                              <HugeiconsIcon
                                icon={Tick02Icon}
                                strokeWidth={2.5}
                                className="size-2.5"
                              />
                            ) : null}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {team.name}
                            </span>
                            <span className="block truncate text-[0.6875rem] text-muted-foreground">
                              {team.abbrev}
                              {team.divisionId
                                ? ` · ${team.divisionId} division`
                                : ""}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-1.5 font-medium">
                        {team.overall} OVR
                      </td>
                      <td className="px-3 py-1.5">
                        {team.capSpace === null
                          ? "Unavailable"
                          : formatCapSpace(team.capSpace)}
                      </td>
                      <td className="px-3 py-1.5">
                        {team.market
                          ? formatMarketTier(team.market).replace(" market", "")
                          : "Unavailable"}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className="rounded-sm bg-muted px-1.5 py-1 text-[0.6875rem] font-medium text-foreground">
                          {teamChallenge?.shortLabel ?? "Unavailable"}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {visibleTeams.length === 0 ? (
              <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center">
                <div>
                  <p className="text-sm font-medium">No teams match</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try another challenge, conference, or search.
                  </p>
                </div>
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            ) : null}
          </div>

          <aside className="hidden min-h-0 border-l xl:flex xl:flex-col">
            <TeamDossier
              team={selectedTeam}
              challenge={selectedChallenge}
              error={error}
              submitting={submitting}
              onConfirm={() => void handleConfirmTeam()}
            />
          </aside>
        </div>
      </section>

      <details
        className="rounded-lg border xl:hidden"
        open={Boolean(selectedTeam)}
      >
        <summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
          {selectedTeam
            ? `Review ${selectedTeam.name}`
            : "Select a team to review its assignment"}
        </summary>
        <div className="border-t">
          <TeamDossier
            team={selectedTeam}
            challenge={selectedChallenge}
            error={error}
            submitting={submitting}
            onConfirm={() => void handleConfirmTeam()}
            hideAction
          />
        </div>
      </details>

      <div className="sticky bottom-0 z-20 flex items-center justify-between gap-3 border bg-background p-3 xl:hidden">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {selectedTeam?.name ?? "No team selected"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {selectedTeam
              ? `${selectedTeam.overall} OVR · ${selectedChallenge?.label ?? "Team assignment"}`
              : "Choose a franchise from the team board."}
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          className="h-11"
          disabled={!selectedTeam || submitting}
          onClick={() => void handleConfirmTeam()}
        >
          {submitting ? "Starting…" : "Start as GM"}
        </Button>
      </div>
    </main>
  )
}

function SortableHeader({
  label,
  sortKey,
  currentSort,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  currentSort: { key: SortKey; direction: SortDirection }
  onSort: (key: SortKey) => void
  className?: string
}) {
  const isActive = currentSort.key === sortKey

  return (
    <th scope="col" className={cn("px-3 py-2 text-left", className)}>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label={`${label}, sort ${isActive && currentSort.direction === "asc" ? "descending" : "ascending"}`}
        onClick={() => onSort(sortKey)}
      >
        {label}
        <span aria-hidden="true" className="w-2 text-center">
          {isActive ? (currentSort.direction === "asc" ? "↑" : "↓") : ""}
        </span>
      </button>
    </th>
  )
}

function TeamDossier({
  team,
  challenge,
  error,
  submitting,
  onConfirm,
  hideAction = false,
}: {
  team: TeamOption | null
  challenge:
    | {
        id: Exclude<ChallengeId, "all">
        label: string
        shortLabel: string
        description: string
        icon: typeof ChampionIcon
      }
    | undefined
    | null
  error: string | null
  submitting: boolean
  onConfirm: () => void
  hideAction?: boolean
}) {
  if (!team) {
    return (
      <div className="flex min-h-56 flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="flex size-8 items-center justify-center rounded-md bg-muted">
          <HugeiconsIcon
            icon={Target01Icon}
            strokeWidth={1.8}
            className="size-4"
          />
        </div>
        <p className="mt-3 text-sm font-medium">No team selected</p>
        <p className="mt-1 max-w-56 text-xs leading-5 text-muted-foreground">
          Select a franchise to review its challenge and front-office outlook.
        </p>
      </div>
    )
  }

  const challengeSummary = getChallengeSummary(team)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      <div className="border-b pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-medium">{team.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {team.abbrev}
              {team.conferenceId
                ? ` · ${capitalize(team.conferenceId)} conference`
                : ""}
              {team.divisionId ? ` · ${team.divisionId}` : ""}
            </p>
          </div>
          <span className="shrink-0 rounded-sm bg-muted px-2 py-1 text-xs font-medium">
            {team.overall} OVR
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-2 border-b py-4 text-xs">
        <Metric label="Roster talent" value={`${team.overall} OVR`} />
        <Metric
          label="Cap flexibility"
          value={
            team.capSpace === null
              ? "Unavailable"
              : formatCapSpace(team.capSpace)
          }
        />
        <Metric
          label="Market size"
          value={team.market ? formatMarketTier(team.market) : "Unavailable"}
        />
        <Metric label="Direction" value={challenge?.label ?? "Unavailable"} />
      </dl>

      <div className="border-b py-4">
        <h3 className="text-xs font-medium">The challenge</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {challengeSummary}
        </p>
      </div>

      <div className="py-4">
        <h3 className="text-xs font-medium">Key context</h3>
        <ul className="mt-2 space-y-2 text-xs leading-5 text-muted-foreground">
          <li className="flex gap-2">
            <span aria-hidden="true">·</span>
            <span>
              {team.youngCoreCount === 1
                ? "1 rotation-level player age 24 or younger"
                : `${team.youngCoreCount} rotation-level players age 24 or younger`}
            </span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true">·</span>
            <span>
              {team.topPlayer && team.topPlayerOverall
                ? `Top player: ${team.topPlayer}, ${team.topPlayerOverall} OVR`
                : "Top player data unavailable"}
            </span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true">·</span>
            <span>
              {team.payroll === null
                ? "Payroll data unavailable"
                : `${formatMoney(team.payroll)} committed payroll`}
            </span>
          </li>
        </ul>
      </div>

      {error ? (
        <p role="alert" className="mt-auto text-xs text-destructive">
          We couldn&apos;t start your assignment. {error} Try again.
        </p>
      ) : null}

      {!hideAction ? (
        <div className="mt-auto border-t pt-4">
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={submitting}
            onClick={onConfirm}
          >
            {submitting ? "Starting…" : "Start as GM"}
            {!submitting ? (
              <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
            ) : null}
          </Button>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            You&apos;ll enter the league office with this team selected.
          </p>
        </div>
      ) : null}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b p-3 odd:border-r [&:nth-child(n+3)]:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate font-medium">{value}</dd>
    </div>
  )
}

function getTeamChallenge({
  overall,
  youngCoreCount,
  capSpace,
  mode,
}: {
  overall: number
  youngCoreCount: number
  capSpace: number | null
  mode: "selling" | "buying" | "contending" | null
}): Exclude<ChallengeId, "all"> {
  if (mode === "contending" || overall >= 78) {
    return "win_now"
  }

  if (youngCoreCount >= 4 && mode !== "selling") {
    return "build_youth"
  }

  if (capSpace !== null && capSpace >= 8 && overall >= 68) {
    return "cap_flexibility"
  }

  if (mode === "selling" || overall < 68) {
    return "restore"
  }

  return "build_youth"
}

function getChallengeSummary(team: TeamOption): string {
  switch (team.challenge) {
    case "win_now":
      return `${team.name} has a ${team.overall} overall roster built to compete immediately. Maximize the current talent window while managing ${team.capSpace !== null && team.capSpace < 0 ? "limited financial flexibility" : "the expectations of a ready roster"}.`
    case "build_youth":
      return `${team.name} has ${team.youngCoreCount} rotation-level players age 24 or younger. Develop the core without sacrificing the flexibility needed to add the right veterans.`
    case "cap_flexibility":
      return `${team.name} can reshape its roster with ${team.capSpace === null ? "an unsettled cap outlook" : `${formatCapSpace(team.capSpace)} in current cap flexibility`}. Decide which contracts and players belong in the next competitive window.`
    case "restore":
      return `${team.name} offers a longer rebuild around a ${team.overall} overall roster${team.market ? ` in a ${formatMarketTier(team.market).toLowerCase()}` : ""}. Set a clear direction, develop dependable talent, and build a sustainable path back to contention.`
  }
}

function formatCapSpace(value: number): string {
  return value < 0 ? `-${formatMoney(Math.abs(value))}` : formatMoney(value)
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
