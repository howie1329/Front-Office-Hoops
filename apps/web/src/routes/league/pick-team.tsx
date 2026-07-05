import {
  createFileRoute,
  Link,
  Navigate,
  useNavigate,
} from "@tanstack/react-router"
import { useState } from "react"

import { teamName } from "@/components/league/lib/teamFormat"
import {
  formatMarketTier,
  formatMoney,
  formatTeamMode,
  formatTolerance,
} from "@/components/league/lib/moneyFormat"
import { useLeagueContext } from "@/contexts/LeagueContext"
import { getSeasonFinancials, getTeamPayroll } from "@workspace/sim"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

export const Route = createFileRoute("/league/pick-team")({
  component: LeaguePickTeamPage,
})

type TeamFilter = "all" | "east" | "west"

function LeaguePickTeamPage() {
  const navigate = useNavigate()
  const { status, seasonState, userTeamId, setUserTeamId, error, league } =
    useLeagueContext()
  const [filter, setFilter] = useState<TeamFilter>("all")
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === "empty") {
    return <Navigate to="/league/create" />
  }

  if (userTeamId) {
    return <Navigate to="/league" />
  }

  if (!seasonState) {
    return null
  }

  const seasonFinancials = league
    ? getSeasonFinancials(league.leagueFinancials, seasonState.season)
    : null
  const teams = seasonState.teams
    .filter((team) => filter === "all" || team.conferenceId === filter)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
  const selectedTeam =
    seasonState.teams.find((team) => team.id === selectedTeamId) ?? null
  const selectedTeamFinance = selectedTeam
    ? (league?.teamFinancials.find(
        (entry) => entry.teamId === selectedTeam.id
      ) ?? null)
    : null

  function handleFilterChange(nextFilter: TeamFilter) {
    setFilter(nextFilter)
    setSelectedTeamId(null)
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-2xl flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Team selection
          </p>
          <div>
            <h1 className="text-xl leading-tight font-medium">
              Pick your team
            </h1>
            <p className="text-sm leading-7 text-muted-foreground">
              Choose the franchise you will run as GM. Compare basketball
              strength and front-office situation before you commit.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/">Home</Link>
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <Card>
          <CardHeader className="gap-3">
            <div>
              <CardTitle>30 teams</CardTitle>
              <CardDescription>
                Conference and division assignments are set. Select a team, then
                confirm when you are ready.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "east", "west"] as const).map((option) => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={filter === option ? "secondary" : "outline"}
                  onClick={() => handleFilterChange(option)}
                >
                  {option === "all"
                    ? "All"
                    : option === "east"
                      ? "East"
                      : "West"}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
            {teams.map((team) => {
              const payroll = league
                ? getTeamPayroll(team.id, league.contracts)
                : 0
              const taxOutlook =
                seasonFinancials && payroll > seasonFinancials.luxuryTaxLine
                  ? "Over tax line"
                  : seasonFinancials && payroll > seasonFinancials.salaryCap
                    ? "Over cap"
                    : "Under cap"
              const teamFinance = league?.teamFinancials.find(
                (entry) => entry.teamId === team.id
              )
              const isSelected = selectedTeamId === team.id

              return (
                <button
                  key={team.id}
                  type="button"
                  aria-pressed={isSelected}
                  className={[
                    "flex min-h-32 flex-col items-start gap-2 rounded-md border p-3 text-left text-xs transition-colors outline-none",
                    "hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
                    isSelected ? "border-foreground bg-muted" : "border-border",
                  ].join(" ")}
                  onClick={() => setSelectedTeamId(team.id)}
                >
                  <span className="flex w-full items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {teamName(seasonState, team.id)}
                      </span>
                      <span className="text-muted-foreground">
                        {team.abbrev} · {team.overall} OVR
                      </span>
                    </span>
                    <span className="rounded-sm bg-background px-2 py-1 font-medium">
                      {team.conferenceId
                        ? team.conferenceId.toUpperCase()
                        : "—"}
                    </span>
                  </span>

                  <span className="text-muted-foreground">
                    {team.divisionId
                      ? `${team.divisionId} division`
                      : "No division"}
                  </span>

                  {teamFinance && seasonFinancials ? (
                    <span className="text-muted-foreground">
                      {formatMarketTier(teamFinance.spendingProfile.marketTier)}{" "}
                      ·{" "}
                      {formatTolerance(
                        teamFinance.spendingProfile.taxTolerance
                      )}{" "}
                      · {formatTeamMode(teamFinance.strategy.mode)}
                    </span>
                  ) : null}

                  {teamFinance && seasonFinancials ? (
                    <span className="text-muted-foreground">
                      Payroll {formatMoney(payroll)} · {taxOutlook}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>GM assignment</CardTitle>
            <CardDescription>
              Review the selected franchise before entering the league office.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {selectedTeam ? (
              <div className="flex flex-col gap-3 rounded-md bg-muted/50 p-3">
                <div>
                  <p className="text-sm font-medium">
                    {teamName(seasonState, selectedTeam.id)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedTeam.abbrev} · {selectedTeam.overall} OVR
                    {selectedTeam.conferenceId
                      ? ` · ${selectedTeam.conferenceId}`
                      : ""}
                    {selectedTeam.divisionId
                      ? ` · ${selectedTeam.divisionId}`
                      : ""}
                  </p>
                </div>
                {selectedTeamFinance ? (
                  <div className="grid gap-2 text-xs">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Market</span>
                      <span>
                        {formatMarketTier(
                          selectedTeamFinance.spendingProfile.marketTier
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        Tax tolerance
                      </span>
                      <span>
                        {formatTolerance(
                          selectedTeamFinance.spendingProfile.taxTolerance
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Mode</span>
                      <span>
                        {formatTeamMode(selectedTeamFinance.strategy.mode)}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-sm font-medium">No team selected</p>
                <p className="text-xs text-muted-foreground">
                  Select a franchise from the board to enable confirmation.
                </p>
              </div>
            )}

            {error ? <p className="text-xs text-destructive">{error}</p> : null}

            <div className="flex flex-col gap-2 border-t pt-4">
              <Button
                type="button"
                disabled={!selectedTeamId || submitting}
                onClick={() => void handleConfirmTeam()}
              >
                {submitting ? "Starting..." : "Start as GM"}
              </Button>
              <p className="text-xs text-muted-foreground">
                You will manage this team&apos;s roster, cap sheet, trades, and
                season decisions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
