import { Link } from "@tanstack/react-router"

import type { SeasonState } from "@workspace/shared/types"
import { getCurrentCalendar } from "@workspace/sim"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import { teamName } from "./lib/teamFormat"

type SeasonPhaseCardProps = {
  state: SeasonState
  championTeamId: string | null
  canBeginRegularSeason: boolean
  canBeginPlayoffs: boolean
  canBeginOffseason: boolean
  canSimAiReSignings: boolean
  canProceedToDraft: boolean
  canPrepareDraft: boolean
  canProceedToFreeAgency: boolean
  canSimAiFreeAgency: boolean
  canStartNextSeason: boolean
  rosterOverLimit: boolean
  cutsNeeded: number
  error: string | null
  onBeginRegularSeason: () => void
  onSkipRemainingExhibitions: () => void
  onBeginPlayoffs: () => void
  onBeginOffseason: () => void
  onCompleteReSignings: () => void
  onAdvanceToDraft: () => void
  onPrepareDraft: () => void
  onAdvanceToFreeAgency: () => void
  onCompleteFreeAgency: () => void
  onStartNextSeason: () => void
}

function phaseLabel(phase: SeasonState["phase"]): string {
  if (phase === "preseason") {
    return "Preseason"
  }
  if (phase === "playoffs") {
    return "Playoffs"
  }
  if (phase === "complete") {
    return "Season complete"
  }
  if (phase === "offseason") {
    return "Offseason"
  }
  return "Regular season"
}

export function SeasonPhaseCard({
  state,
  championTeamId,
  canPrepareDraft,
  rosterOverLimit,
  cutsNeeded,
  error,
  onSkipRemainingExhibitions,
  onPrepareDraft,
}: SeasonPhaseCardProps) {
  const championName = championTeamId ? teamName(state, championTeamId) : null
  const calendar = getCurrentCalendar(state)

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Season {state.season} · {phaseLabel(state.phase)}
        </CardTitle>
        <CardDescription>
          {state.phase === "preseason"
            ? "Run exhibition games and cut camp invites to 15 before the regular season date."
            : state.phase === "regular"
              ? "Advance through the regular season calendar toward the playoffs."
              : state.phase === "playoffs"
                ? "Sim playoff games from the bracket page."
                : state.phase === "offseason" &&
                    (state.offseasonPhase ?? "re_signing") === "re_signing"
                  ? "Re-sign your own expiring players before the draft window opens."
                  : state.phase === "offseason" &&
                      state.offseasonPhase === "draft"
                    ? "Prepare and run the draft before free agency opens."
                    : state.phase === "offseason" &&
                        state.offseasonPhase === "free_agency"
                      ? "Sign free agents and trim your roster to 15 before the next preseason."
                      : championName
                        ? `${championName} won the championship.`
                        : "Champion crowned."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <SeasonMetric label="Date" value={calendar.date.label} />
          <SeasonMetric label="Day" value={String(state.currentDay)} />
          <SeasonMetric
            label="Trade deadline"
            value={
              getCurrentCalendar({
                ...state,
                currentDay: calendar.milestones.tradeDeadlineDay,
              }).date.label
            }
          />
        </div>

        {state.phase === "preseason" && rosterOverLimit ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Cut {cutsNeeded} camp invite{cutsNeeded === 1 ? "" : "s"} before
            starting the regular season.
          </p>
        ) : null}
        {state.phase !== "preseason" && rosterOverLimit ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Roster over limit — release {cutsNeeded} player
            {cutsNeeded === 1 ? "" : "s"} to start the next season.
          </p>
        ) : null}
        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {state.phase === "preseason" ? (
            <>
              <Button variant="secondary" onClick={onSkipRemainingExhibitions}>
                Skip remaining exhibitions
              </Button>
              <Button variant="outline" asChild>
                <Link to="/league/team">Manage roster</Link>
              </Button>
            </>
          ) : null}

          {state.phase === "playoffs" ? (
            <Button variant="secondary" asChild>
              <Link to="/league/playoffs">View playoff bracket</Link>
            </Button>
          ) : null}

          {canPrepareDraft ? (
            <Button onClick={onPrepareDraft}>Prepare draft</Button>
          ) : null}

          {state.phase === "offseason" &&
          state.draftState &&
          !state.draftState.completed ? (
            <Button variant="secondary" asChild>
              <Link to="/league/draft">Go to draft</Link>
            </Button>
          ) : null}

          {state.phase === "complete" || state.phase === "offseason" ? (
            <Button variant="outline" asChild>
              <Link to="/league/history">View history</Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function SeasonMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  )
}
