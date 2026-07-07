import { ROSTER_MAX } from "@workspace/shared/constants"
import type { LeagueRecord, Rng, SeasonState } from "@workspace/shared/types"

import { getCurrentCalendar } from "../calendar"
import { derivePlayerSeasonStats } from "../derivePlayerSeasonStats"
import { deriveStandings } from "../deriveStandings"
import { assertPhaseEligibility } from "../phaseEligibility"
import { cutCampInviteFromTeam, releasePlayerFromTeam } from "../roster/ledger"
import { simulateDay } from "../simulateDay"
import { trimTeamsToRegularRoster } from "./campPlayers"
import { hasRemainingExhibitions } from "./isPreseasonComplete"

function applyCampRosterCuts(
  league: LeagueRecord,
  trimmedTeams: SeasonState["teams"],
): LeagueRecord {
  const keptIds = new Set(
    trimmedTeams.flatMap((team) => team.players.map((player) => player.id)),
  )
  let next = league

  for (const team of league.seasonState.teams) {
    for (const player of team.players) {
      if (keptIds.has(player.id)) {
        continue
      }

      next = player.tags?.includes("camp_invite")
        ? cutCampInviteFromTeam(next, {
            teamId: team.id,
            playerId: player.id,
          })
        : releasePlayerFromTeam(next, {
            teamId: team.id,
            playerId: player.id,
          })
    }
  }

  const livePlayers = new Map(
    next.seasonState.teams
      .flatMap((team) => team.players)
      .map((player) => [player.id, player]),
  )

  return {
    ...next,
    seasonState: {
      ...next.seasonState,
      teams: trimmedTeams.map((team) => ({
        ...team,
        players: team.players.map(
          (player) => livePlayers.get(player.id) ?? player,
        ),
      })),
    },
  }
}

export function beginRegularSeason(
  league: LeagueRecord,
  rng: Rng,
): LeagueRecord {
  assertPhaseEligibility(league, "beginRegularSeason")

  let state = league.seasonState

  while (hasRemainingExhibitions(state)) {
    state = simulateDay(state, state.currentDay, league.rngNonce)
  }

  const trimmedTeams = trimTeamsToRegularRoster(
    state.teams,
    ROSTER_MAX,
    rng,
    league.userTeamId,
  )

  const withCuts = applyCampRosterCuts(
    { ...league, seasonState: state },
    trimmedTeams,
  )

  const milestones = getCurrentCalendar(state).milestones
  const nextState: SeasonState = {
    ...withCuts.seasonState,
    phase: "regular",
    currentDay: Math.max(state.currentDay, milestones.regularSeasonStartDay),
    standings: [],
    playerSeasonStats: [],
  }

  return {
    ...withCuts,
    seasonState: {
      ...nextState,
      standings: deriveStandings(
        nextState.teams,
        nextState.games,
        nextState.season,
      ),
      playerSeasonStats: derivePlayerSeasonStats(
        nextState.teams,
        nextState.games,
        nextState.season,
      ),
    },
  }
}

export function skipRemainingExhibitions(
  league: LeagueRecord,
): SeasonState {
  let state = league.seasonState
  let safety = 0

  while (hasRemainingExhibitions(state) && safety < 100) {
    state = simulateDay(state, state.currentDay, league.rngNonce)
    safety += 1
  }

  return state
}
