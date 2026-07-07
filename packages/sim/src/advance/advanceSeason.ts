import type { LeagueRecord, SeasonState } from "@workspace/shared/types"

import {
  getCurrentCalendar,
  getMonthEndDay,
  getTradeDeadlineAdvanceStopDay,
} from "../calendar"
import { isUserOnClock } from "../draft/prepareDraft"
import { getAllPhaseEligibility } from "../phaseEligibility"
import { isPreseasonComplete } from "../preseason/isPreseasonComplete"
import { simulateDay } from "../simulateDay"

export type AdvanceTarget =
  | "day"
  | "week"
  | "trade_deadline"
  | "playoffs"
  | "month_end"
  | "regular_season_end"
  | "next_stop"

export type AdvancePolicy = "stopAtUserGames" | "runThrough"

export type AdvanceStopReason =
  | "user_game"
  | "target_reached"
  | "roster_cuts"
  | "begin_playoffs"
  | "begin_regular_season"
  | "draft_pick"

export type AdvanceResult = {
  state: SeasonState
  daysSimmed: number
  gamesSimmed: number
  stoppedReason?: AdvanceStopReason
}

export type AdvanceOptions = {
  target: AdvanceTarget
  policy?: AdvancePolicy
  userTeamId?: string | null
  league?: LeagueRecord
  rngNonce?: number
}

function resolvePolicy(
  target: AdvanceTarget,
  policy?: AdvancePolicy,
): AdvancePolicy {
  if (policy) {
    return policy
  }

  if (
    target === "trade_deadline" ||
    target === "playoffs" ||
    target === "month_end" ||
    target === "regular_season_end"
  ) {
    return "runThrough"
  }

  return "stopAtUserGames"
}

function dayHasUserGame(
  state: SeasonState,
  day: number,
  userTeamId: string | null | undefined,
): boolean {
  if (!userTeamId) {
    return false
  }

  return state.schedule.some(
    (game) =>
      game.status === "scheduled" &&
      game.day === day &&
      (game.homeTeamId === userTeamId || game.awayTeamId === userTeamId),
  )
}

function getInterruptReason(
  league: LeagueRecord | undefined,
  state: SeasonState,
): AdvanceStopReason | null {
  if (!league) {
    return null
  }

  const eligibility = getAllPhaseEligibility({
    ...league,
    seasonState: state,
  })

  if (state.phase === "preseason") {
    if (isPreseasonComplete(state)) {
      const userTeam = league.userTeamId
        ? state.teams.find((team) => team.id === league.userTeamId)
        : null
      if (userTeam && userTeam.players.length > 15) {
        return "roster_cuts"
      }
      if (eligibility.beginRegularSeason?.allowed) {
        return "begin_regular_season"
      }
    }
  }

  if (eligibility.beginPlayoffs.allowed) {
    return "begin_playoffs"
  }

  if (
    state.phase === "offseason" &&
    state.offseasonPhase === "draft" &&
    isUserOnClock(state, league.userTeamId)
  ) {
    return "draft_pick"
  }

  return null
}

function resolveTargetDay(state: SeasonState, target: AdvanceTarget): number {
  const milestones = getCurrentCalendar(state).milestones

  switch (target) {
    case "day":
    case "next_stop":
      return state.currentDay
    case "week":
      return state.currentDay + 6
    case "trade_deadline":
      return getTradeDeadlineAdvanceStopDay(state)
    case "playoffs":
      return milestones.playoffsStartDay
    case "month_end":
      return getMonthEndDay(state.currentDay)
    case "regular_season_end":
      return milestones.regularSeasonEndDay
  }
}

function shouldStopForTarget(
  state: SeasonState,
  target: AdvanceTarget,
  targetDay: number,
): boolean {
  if (target === "day" || target === "next_stop") {
    return true
  }

  if (target === "week") {
    return false
  }

  return state.currentDay >= targetDay
}

export function advanceSeason(
  state: SeasonState,
  options: AdvanceOptions,
): AdvanceResult {
  const policy = resolvePolicy(options.target, options.policy)
  const userTeamId = options.userTeamId
  const rngNonce = options.rngNonce ?? 0
  const targetDay = resolveTargetDay(state, options.target)
  let nextState = state
  let daysSimmed = 0
  let gamesSimmed = 0
  const maxIterations = 500

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const currentDay = nextState.currentDay

    if (
      policy === "stopAtUserGames" &&
      dayHasUserGame(nextState, currentDay, userTeamId)
    ) {
      return {
        state: nextState,
        daysSimmed,
        gamesSimmed,
        stoppedReason: "user_game",
      }
    }

    if (policy === "runThrough") {
      const interrupt = getInterruptReason(options.league, nextState)
      if (interrupt) {
        return {
          state: nextState,
          daysSimmed,
          gamesSimmed,
          stoppedReason: interrupt,
        }
      }
    }

    const gamesBefore = nextState.games.length
    nextState = simulateDay(nextState, currentDay, rngNonce)
    daysSimmed += 1
    gamesSimmed += nextState.games.length - gamesBefore

    if (shouldStopForTarget(nextState, options.target, targetDay)) {
      if (options.target === "day" || options.target === "next_stop") {
        return { state: nextState, daysSimmed, gamesSimmed }
      }

      if (options.target === "week" && daysSimmed >= 7) {
        return { state: nextState, daysSimmed, gamesSimmed }
      }

      if (
        options.target !== "week" &&
        nextState.currentDay >= targetDay
      ) {
        return {
          state: nextState,
          daysSimmed,
          gamesSimmed,
          stoppedReason: "target_reached",
        }
      }
    }
  }

  return { state: nextState, daysSimmed, gamesSimmed }
}
