import type {
  Game,
  ScheduleGame,
  SeasonState,
  SimulateGameContext,
  TeamFinancials,
  TeamWithRoster,
} from "@workspace/shared/types"

import { deriveCoachingPhilosophy } from "./gameSim/coachingPhilosophy"
import { updateTeamMomentumMap } from "./gameSim/momentum"
import {
  getFatigueEfficiencyPenalty,
  getFatigueInjuryMultiplier,
  getFatigueStarterMinuteReduction,
  getTeamScheduleFatigue,
} from "./schedule/fatigue"
import { createRng } from "./rng"
import { simulateTeamMatchup } from "./simulateTeamMatchup"

export type ExtendedSimulateGameContext = SimulateGameContext & {
  gameType?: ScheduleGame["gameType"]
  scheduleState?: SeasonState
  teamFinancials?: TeamFinancials[]
}

function getCoachingLevel(
  teamFinancials: TeamFinancials[] | undefined,
  teamId: string,
): number {
  return (
    teamFinancials?.find((entry) => entry.teamId === teamId)?.coachingLevel ?? 5
  )
}

function getTeamStreak(
  scheduleState: SeasonState | undefined,
  teamId: string,
): number {
  return (
    scheduleState?.standings.find((entry) => entry.teamId === teamId)?.streak ??
    0
  )
}

export function simulateGameWithContext(
  home: TeamWithRoster,
  away: TeamWithRoster,
  context: ExtendedSimulateGameContext,
): Game {
  const rngNonce = context.rngNonce ?? 0
  const rngSeed = `${context.baseSeed}:game:${context.season}:${context.gameId}:nonce:${rngNonce}`
  const rng = createRng(rngSeed)
  const gameType = context.gameType ?? "regular"
  const scheduleState = context.scheduleState

  const homeFatigue = scheduleState
    ? getTeamScheduleFatigue(home.id, scheduleState, context.day)
    : null
  const awayFatigue = scheduleState
    ? getTeamScheduleFatigue(away.id, scheduleState, context.day)
    : null

  const homeCoachingLevel = getCoachingLevel(context.teamFinancials, home.id)
  const awayCoachingLevel = getCoachingLevel(context.teamFinancials, away.id)

  const result = simulateTeamMatchup(
    {
      home,
      away,
      homeFatiguePenalty: homeFatigue
        ? getFatigueEfficiencyPenalty(homeFatigue, gameType)
        : 0,
      awayFatiguePenalty: awayFatigue
        ? getFatigueEfficiencyPenalty(awayFatigue, gameType)
        : 0,
      homeMinuteReduction: homeFatigue
        ? getFatigueStarterMinuteReduction(homeFatigue, gameType)
        : gameType === "exhibition"
          ? 8
          : 0,
      awayMinuteReduction: awayFatigue
        ? getFatigueStarterMinuteReduction(awayFatigue, gameType)
        : gameType === "exhibition"
          ? 8
          : 0,
      homePhilosophy: deriveCoachingPhilosophy(homeCoachingLevel),
      awayPhilosophy: deriveCoachingPhilosophy(awayCoachingLevel),
      homeMomentum: scheduleState?.teamMomentum?.[home.id],
      awayMomentum: scheduleState?.teamMomentum?.[away.id],
      homeStreak: getTeamStreak(scheduleState, home.id),
      awayStreak: getTeamStreak(scheduleState, away.id),
      gameType,
    },
    rng,
  )

  return {
    id: context.gameId,
    season: context.season,
    day: context.day,
    homeTeamId: home.id,
    awayTeamId: away.id,
    gameType,
    rngSeed,
    rngNonce,
    result,
  }
}

export function getInjuryRiskMultiplierForGame(
  teamId: string,
  scheduleState: SeasonState,
  day: number,
  gameType: ScheduleGame["gameType"],
): number {
  return getFatigueInjuryMultiplier(
    getTeamScheduleFatigue(teamId, scheduleState, day),
    gameType,
  )
}

export function updateMomentumAfterGame(
  state: SeasonState,
  game: Game,
): SeasonState {
  return {
    ...state,
    teamMomentum: updateTeamMomentumMap(
      state.teamMomentum,
      [game.homeTeamId, game.awayTeamId],
      state.games,
      state.season,
    ),
  }
}
