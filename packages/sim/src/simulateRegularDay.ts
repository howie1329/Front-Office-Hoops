import type { LeagueRecord, Rng, ScheduleGame, SeasonState, TeamFinancials } from "@workspace/shared/types"

import { getCurrentCalendar } from "./calendar"
import { derivePlayerSeasonStats } from "./derivePlayerSeasonStats"
import { deriveStandings } from "./deriveStandings"
import { expirePendingTradeOffers, runAiTradeMarket } from "./trades"
import { advanceInjuriesForDay, applyPostGameInjuries } from "./injuries"
import { isRegularSeasonComplete } from "./isRegularSeasonComplete"
import { createRng } from "./rng"
import { getFatigueInjuryMultiplier, getTeamScheduleFatigue } from "./schedule/fatigue"
import { applyCampDevelopmentForDay } from "./preseason/campDevelopment"
import { simulateDay } from "./simulateDay"
import { simulateGameWithContext, updateMomentumAfterGame } from "./simulateGameWithContext"

function gameTypeForEntry(game: ScheduleGame): ScheduleGame["gameType"] {
  return game.gameType ?? "regular"
}

function matchesCurrentPhase(
  game: ScheduleGame,
  phase: SeasonState["phase"],
): boolean {
  const gameType = gameTypeForEntry(game)
  if (phase === "preseason") {
    return gameType === "exhibition"
  }
  if (phase === "regular") {
    return gameType === "regular"
  }
  return false
}

function snapDayAfterRegularSeason(state: SeasonState): number {
  if (!isRegularSeasonComplete(state)) {
    return state.currentDay
  }

  const milestones = getCurrentCalendar(state).milestones
  return Math.max(state.currentDay, milestones.playoffsStartDay)
}

export function simulateRegularDay(
  state: SeasonState,
  day: number = state.currentDay,
  rngNonce = 0,
  options?: { teamFinancials?: TeamFinancials[]; staff?: LeagueRecord["staff"] },
): SeasonState {
  const teamsAfterRecovery = advanceInjuriesForDay(state.teams)
  const stateWithRecoveredPlayers = {
    ...state,
    teams: teamsAfterRecovery,
  }
  const scheduledGames = state.schedule.filter(
    (game) =>
      !game.seriesId &&
      game.day === day &&
      game.status === "scheduled" &&
      matchesCurrentPhase(game, state.phase),
  )

  if (scheduledGames.length === 0) {
    const emptyState = {
      ...stateWithRecoveredPlayers,
      currentDay: day + 1,
      standings: deriveStandings(
        stateWithRecoveredPlayers.teams,
        stateWithRecoveredPlayers.games,
        state.season,
      ),
      playerSeasonStats: derivePlayerSeasonStats(
        stateWithRecoveredPlayers.teams,
        stateWithRecoveredPlayers.games,
        state.season,
      ),
    }

    return {
      ...emptyState,
      currentDay: snapDayAfterRegularSeason(emptyState),
    }
  }

  const newGames = [...state.games]
  const newSchedule = state.schedule.map((entry) => ({ ...entry }))
  let teams = stateWithRecoveredPlayers.teams

  for (const scheduledGame of scheduledGames) {
    const home = teams.find((team) => team.id === scheduledGame.homeTeamId)
    const away = teams.find((team) => team.id === scheduledGame.awayTeamId)

    if (!home || !away) {
      continue
    }

    const gameId = `g_${state.season}_${scheduledGame.id}`
    const game = simulateGameWithContext(home, away, {
      season: state.season,
      day: scheduledGame.day,
      gameId,
      baseSeed: state.baseSeed,
      rngNonce,
      gameType: scheduledGame.gameType,
      scheduleState: stateWithRecoveredPlayers,
      teamFinancials: options?.teamFinancials,
      staff: options?.staff,
    })

    newGames.push(game)
    const homeRiskMultiplier = getFatigueInjuryMultiplier(
      getTeamScheduleFatigue(home.id, stateWithRecoveredPlayers, scheduledGame.day),
      scheduledGame.gameType,
    )
    const awayRiskMultiplier = getFatigueInjuryMultiplier(
      getTeamScheduleFatigue(away.id, stateWithRecoveredPlayers, scheduledGame.day),
      scheduledGame.gameType,
    )
    teams = applyPostGameInjuries(
      teams,
      {
        homeTeamId: home.id,
        awayTeamId: away.id,
        homePlayerStats: game.result.homePlayerStats,
        awayPlayerStats: game.result.awayPlayerStats,
      },
      createRng(`${state.baseSeed}:injuries:${game.id}:nonce:${rngNonce}`),
      {
        homeRiskMultiplier,
        awayRiskMultiplier,
      },
    )

    const scheduleIndex = newSchedule.findIndex(
      (entry) => entry.id === scheduledGame.id,
    )
    if (scheduleIndex >= 0) {
      newSchedule[scheduleIndex] = {
        ...newSchedule[scheduleIndex]!,
        status: "final",
        gameId: game.id,
      }
    }
  }

  let nextState: SeasonState = {
    ...stateWithRecoveredPlayers,
    teams,
    schedule: newSchedule,
    games: newGames,
    currentDay: day + 1,
    standings: [],
    playerSeasonStats: [],
    teamMomentum: stateWithRecoveredPlayers.teamMomentum ?? {},
  }

  for (const game of newGames.slice(state.games.length)) {
    nextState = updateMomentumAfterGame(nextState, game)
  }

  const withDerived = {
    ...nextState,
    standings: deriveStandings(nextState.teams, nextState.games, nextState.season),
    playerSeasonStats: derivePlayerSeasonStats(
      nextState.teams,
      nextState.games,
      nextState.season,
    ),
  }

  const withCampDevelopment =
    state.phase === "preseason"
      ? {
          ...withDerived,
          teams: applyCampDevelopmentForDay(
            withDerived.teams,
            createRng(`${state.baseSeed}:camp-dev:${day}:nonce:${rngNonce}`),
          ),
        }
      : withDerived

  return {
    ...withCampDevelopment,
    currentDay: snapDayAfterRegularSeason(withCampDevelopment),
  }
}

export function simulateLeagueRegularDay(
  league: LeagueRecord,
  rng: Rng,
  day: number = league.seasonState.currentDay,
): LeagueRecord {
  const seasonState = simulateDay(league.seasonState, day, league.rngNonce, {
    teamFinancials: league.teamFinancials,
    staff: league.staff,
  })

  let updated: LeagueRecord = {
    ...league,
    seasonState,
  }

  updated = expirePendingTradeOffers(updated)
  updated = runAiTradeMarket(updated, rng)

  return updated
}
