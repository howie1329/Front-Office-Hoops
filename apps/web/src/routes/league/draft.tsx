import { createFileRoute } from "@tanstack/react-router"

import { useLeagueContext } from "@/contexts/LeagueContext"
import { teamName } from "@/components/league/lib/teamFormat"
import {
  getTeamScoutingLevel,
  getViewRatings,
  prospectTypeLabel,
} from "@/components/league/lib/scouting"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

export const Route = createFileRoute("/league/draft")({
  component: LeagueDraftPage,
})

function LeagueDraftPage() {
  const {
    league,
    seasonState,
    userTeamId,
    isUserOnClock,
    makeDraftPick,
    simAiPick,
    simToUserPick,
    rosterOverLimit,
    cutsNeeded,
  } = useLeagueContext()

  if (!seasonState?.draftState) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Draft</CardTitle>
          <CardDescription>
            Prepare the draft from the dashboard during the offseason.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { draftState } = seasonState
  const currentPick = draftState.order[draftState.currentPickIndex]
  const availableProspects = draftState.prospects
  const teamFinance = userTeamId
    ? league?.teamFinancials.find((entry) => entry.teamId === userTeamId)
    : undefined
  const scoutingLevel = getTeamScoutingLevel(teamFinance)

  if (draftState.completed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Draft complete</CardTitle>
          <CardDescription>
            {draftState.selections.length} players drafted. Undrafted prospects
            were added to the free agent pool.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {draftState.year} Draft · Pick {currentPick?.overallPick ?? "—"}
          </CardTitle>
          <CardDescription>
            {currentPick
              ? `On the clock: ${teamName(seasonState, currentPick.teamId)}`
              : "Draft complete"}
            {isUserOnClock ? " — your pick." : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {!isUserOnClock ? (
            <>
              <Button onClick={simAiPick}>Sim AI pick</Button>
              {userTeamId ? (
                <Button variant="secondary" onClick={simToUserPick}>
                  Sim to my pick
                </Button>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      {rosterOverLimit ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Roster over limit by {cutsNeeded}. You can still draft, then release
          players on the My Team page before starting the next season.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Available prospects</CardTitle>
          <CardDescription>
            {isUserOnClock
              ? "Select a prospect to draft."
              : "Sim picks until it is your turn."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Pos</TableHead>
                <TableHead>Archetype</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>OVR</TableHead>
                <TableHead>POT</TableHead>
                {isUserOnClock ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {availableProspects.map((prospect) => {
                const viewRatings = getViewRatings(prospect.ratings, {
                  isDraftProspect: true,
                  teamScoutingLevel: scoutingLevel,
                })

                return (
                <TableRow key={prospect.id}>
                  <TableCell>
                    {prospect.firstName} {prospect.lastName}
                  </TableCell>
                  <TableCell>{prospect.position}</TableCell>
                  <TableCell>{prospect.archetype.replaceAll("_", " ")}</TableCell>
                  <TableCell>{prospectTypeLabel(prospect.prospectType)}</TableCell>
                  <TableCell>{prospect.age}</TableCell>
                  <TableCell>
                    {formatHeight(prospect.heightInches)} ·{" "}
                    {prospect.wingspanInches ?? prospect.heightInches + 2}" ws
                  </TableCell>
                  <TableCell>{viewRatings.overall}</TableCell>
                  <TableCell>{viewRatings.potential}</TableCell>
                  {isUserOnClock ? (
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => makeDraftPick(prospect.id)}
                      >
                        Draft
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              )})}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {draftState.selections.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent picks</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pick</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Player</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...draftState.selections]
                  .slice(-8)
                  .reverse()
                  .map((selection) => {
                    const player = seasonState.teams
                      .flatMap((team) => team.players)
                      .find((entry) => entry.id === selection.playerId)

                    return (
                      <TableRow key={selection.overallPick}>
                        <TableCell>{selection.overallPick}</TableCell>
                        <TableCell>
                          {teamName(seasonState, selection.teamId)}
                        </TableCell>
                        <TableCell>
                          {player
                            ? `${player.firstName} ${player.lastName}`
                            : selection.playerId}
                        </TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function formatHeight(inches: number): string {
  const feet = Math.floor(inches / 12)
  const remainder = inches % 12
  return `${feet}'${remainder}"`
}
