import type { Game, LeagueRecord, Rng, SeasonState } from "@workspace/shared/types"

import {
  getCurrentCalendar,
  getMonthEndDay,
  getTradeDeadlineAdvanceStopDay,
} from "../calendar"
import { beginPlayoffs } from "../beginPlayoffs"
import { beginRegularSeason } from "../preseason/beginRegularSeason"
import { isUserOnClock } from "../draft/prepareDraft"
import { getAllPhaseEligibility } from "../phaseEligibility"
import { isPreseasonComplete } from "../preseason/isPreseasonComplete"
import { simulateDay } from "../simulateDay"
import { simulateLeagueRegularDay } from "../simulateRegularDay"
import { completeReSigningPhase } from "../offseason/reSigning"
import {
  advanceToFreeAgencyPhase,
  completeFreeAgencyPhase,
} from "../offseason/phases"
import { ensureFaPoolMinimum, processOffseasonFinancials } from "../financials"
import { archivePlayerCareerSnapshots } from "../playerProfiles"
import { evaluateOwnerGoals } from "../owners"
import { assignSeasonAwards } from "../awards"
import { derivePlayerSeasonProfiles } from "../playerSeasonProfiles"
import { beginOffseason } from "../beginOffseason"
import { startNextSeason } from "../startNextSeason"
import { generateOwnerGoals } from "../owners"

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
  | "roster_under_limit"
  | "begin_playoffs"
  | "begin_regular_season"
  | "begin_offseason"
  | "draft_pick"
  | "draft_incomplete"

export type AdvanceEvent =
  | {
      type: "game_result"
      gameId: string
      won: boolean
      homeTeamId: string
      awayTeamId: string
      homeScore: number
      awayScore: number
    }
  | {
      type: "phase_started"
      phase:
        | "preseason"
        | "regular"
        | "playoffs"
        | "offseason"
        | "re_signing"
        | "draft"
        | "free_agency"
    }
  | { type: "trade_deadline_passed" }
  | { type: "champion_crowned"; teamId: string }

export type AdvanceResult = {
  state: SeasonState
  daysSimmed: number
  gamesSimmed: number
  stoppedReason?: AdvanceStopReason
  events?: AdvanceEvent[]
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

  if (state.phase === "preseason") {
    if (isPreseasonComplete(state)) {
      const userTeam = league.userTeamId
        ? state.teams.find((team) => team.id === league.userTeamId)
        : null
      if (userTeam && userTeam.players.length > 15) {
        return "roster_cuts"
      }
    }
  }

  if (
    state.phase === "offseason" &&
    state.offseasonPhase === "draft" &&
    isUserOnClock(state, league.userTeamId)
  ) {
    return "draft_pick"
  }

  if (
    state.phase === "offseason" &&
    state.offseasonPhase === "draft" &&
    state.currentDay >= getCurrentCalendar(state).milestones.freeAgencyStartDay &&
    !state.draftState?.completed
  ) {
    return "draft_incomplete"
  }

  return null
}

function userGameEvents(
  league: LeagueRecord,
  games: Game[],
): AdvanceEvent[] {
  if (!league.userTeamId) {
    return []
  }

  return games
    .filter(
      (game) =>
        game.homeTeamId === league.userTeamId ||
        game.awayTeamId === league.userTeamId,
    )
    .map((game) => {
      const userIsHome = game.homeTeamId === league.userTeamId
      const homeScore = game.result.homeScore
      const awayScore = game.result.awayScore
      const won = userIsHome ? homeScore > awayScore : awayScore > homeScore

      return {
        type: "game_result" as const,
        gameId: game.id,
        won,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
        homeScore,
        awayScore,
      }
    })
}

function crossedTradeDeadline(
  before: SeasonState,
  after: SeasonState,
): boolean {
  if (before.season !== after.season) {
    return false
  }

  const deadline = getCurrentCalendar(before).milestones.tradeDeadlineDay
  return before.currentDay <= deadline && after.currentDay > deadline
}

function beginOffseasonForLeague(league: LeagueRecord, rng: Rng): LeagueRecord {
  const completedLeague = archivePlayerCareerSnapshots(
    evaluateOwnerGoals(assignSeasonAwards(league))
  )
  const profiles = derivePlayerSeasonProfiles(
    completedLeague.seasonState.teams,
    completedLeague.seasonState.playerSeasonStats,
    completedLeague.seasonState.games.length,
    completedLeague.seasonState.season
  )
  const nextState = beginOffseason(completedLeague.seasonState, profiles)

  return processOffseasonFinancials(
    {
      ...completedLeague,
      seasonState: nextState,
      playerSeasonProfiles: [
        ...completedLeague.playerSeasonProfiles.filter(
          (entry) => entry.season !== completedLeague.seasonState.season
        ),
        ...profiles,
      ],
    },
    rng
  )
}

function startNextSeasonForLeague(league: LeagueRecord, rng: Rng): LeagueRecord {
  const result = startNextSeason({
    seasonState: league.seasonState,
    userTeamId: league.userTeamId,
    freeAgentPool: league.freeAgentPool,
    rng,
    playerSeasonStats: league.seasonState.playerSeasonStats,
    playerSeasonProfiles: league.playerSeasonProfiles,
    seasonHistory: league.seasonHistory,
    league: {
      contracts: league.contracts,
      leagueFinancials: league.leagueFinancials,
      teamFinancials: league.teamFinancials,
      spendingProfileEvents: league.spendingProfileEvents,
      draftPickAssets: league.draftPickAssets,
    },
  })

  const updated = {
    ...league,
    seasonState: result.seasonState,
    seasonHistory: [...league.seasonHistory, result.historyEntry],
    freeAgentPool: result.freeAgentPool,
    contracts: result.contracts,
    leagueFinancials: result.leagueFinancials,
    teamFinancials: result.teamFinancials,
    draftPickAssets: result.draftPickAssets,
    playerDevelopmentRecords: [
      ...league.playerDevelopmentRecords,
      ...result.playerDevelopmentRecords,
    ],
    developmentReports: [...league.developmentReports, result.developmentReport],
    retiredPlayers: [...league.retiredPlayers, ...result.retiredPlayers],
  }

  return {
    ...updated,
    ownerGoals: [
      ...updated.ownerGoals.filter(
        (goal) => goal.season !== updated.seasonState.season
      ),
      ...generateOwnerGoals(updated),
    ],
  }
}

function reconcileCalendarPhase(
  league: LeagueRecord,
  rng: Rng,
): { league: LeagueRecord; events: AdvanceEvent[]; stoppedReason?: AdvanceStopReason } {
  let current = league
  const events: AdvanceEvent[] = []

  for (let i = 0; i < 5; i++) {
    const state = current.seasonState
    const milestones = getCurrentCalendar(state).milestones
    const eligibility = getAllPhaseEligibility(current)

    if (state.phase === "preseason" && state.currentDay >= milestones.regularSeasonStartDay) {
      if (eligibility.beginRegularSeason.allowed) {
        current = beginRegularSeason(current, rng)
        events.push({ type: "phase_started", phase: "regular" })
        continue
      }

      const userTeam = current.userTeamId
        ? state.teams.find((team) => team.id === current.userTeamId)
        : null
      if (userTeam && userTeam.players.length > 15) {
        return { league: current, events, stoppedReason: "roster_cuts" }
      }
      return { league: current, events, stoppedReason: "roster_under_limit" }
    }

    if (state.phase === "regular" && eligibility.beginPlayoffs.allowed) {
      current = {
        ...current,
        seasonState: beginPlayoffs(state),
      }
      events.push({ type: "phase_started", phase: "playoffs" })
      continue
    }

    if (state.phase === "complete" && state.playoffBracket?.championTeamId) {
      events.push({
        type: "champion_crowned",
        teamId: state.playoffBracket.championTeamId,
      })

      if (eligibility.beginOffseason.allowed) {
        current = beginOffseasonForLeague(current, rng)
        events.push(
          { type: "phase_started", phase: "offseason" },
          { type: "phase_started", phase: "re_signing" },
        )
        continue
      }
    }

    if (state.phase === "offseason") {
      const offseasonPhase = state.offseasonPhase ?? "re_signing"

      if (
        offseasonPhase === "re_signing" &&
        state.currentDay >= milestones.draftDay
      ) {
        current = completeReSigningPhase(current, rng)
        events.push({ type: "phase_started", phase: "draft" })
        continue
      }

      if (
        offseasonPhase === "draft" &&
        state.currentDay >= milestones.freeAgencyStartDay
      ) {
        if (!state.draftState?.completed) {
          return { league: current, events, stoppedReason: "draft_incomplete" }
        }

        current = ensureFaPoolMinimum(
          {
            ...current,
            seasonState: advanceToFreeAgencyPhase(state),
          },
          rng,
        )
        events.push({ type: "phase_started", phase: "free_agency" })
        continue
      }

      if (
        offseasonPhase === "free_agency" &&
        state.currentDay >= milestones.nextSeasonStartDay
      ) {
        current = completeFreeAgencyPhase(current, rng)
        if (eligibility.startNextSeason.allowed) {
          current = startNextSeasonForLeague(current, rng)
          events.push({ type: "phase_started", phase: "preseason" })
          continue
        }

        const userTeam = current.userTeamId
          ? state.teams.find((team) => team.id === current.userTeamId)
          : null
        if (userTeam && userTeam.players.length > 15) {
          return { league: current, events, stoppedReason: "roster_cuts" }
        }
        return { league: current, events, stoppedReason: "roster_under_limit" }
      }
    }

    break
  }

  return { league: current, events }
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

export function advanceLeague(
  league: LeagueRecord,
  options: AdvanceOptions,
  rng: Rng,
): { league: LeagueRecord; result: AdvanceResult } {
  const policy = resolvePolicy(options.target, options.policy)
  const userTeamId = options.userTeamId ?? league.userTeamId
  const targetDay = resolveTargetDay(league.seasonState, options.target)
  let current = league
  let daysSimmed = 0
  let gamesSimmed = 0
  const events: AdvanceEvent[] = []
  const maxIterations = 500

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const startReconciled = reconcileCalendarPhase(current, rng)
    current = startReconciled.league
    events.push(...startReconciled.events)
    if (startReconciled.stoppedReason) {
      return {
        league: current,
        result: {
          state: current.seasonState,
          daysSimmed,
          gamesSimmed,
          stoppedReason: startReconciled.stoppedReason,
          events,
        },
      }
    }

    const currentDay = current.seasonState.currentDay

    if (
      policy === "stopAtUserGames" &&
      dayHasUserGame(current.seasonState, currentDay, userTeamId)
    ) {
      return {
        league: current,
        result: {
          state: current.seasonState,
          daysSimmed,
          gamesSimmed,
          stoppedReason: "user_game",
          events,
        },
      }
    }

    if (policy === "runThrough") {
      const interrupt = getInterruptReason(current, current.seasonState)
      if (interrupt) {
        return {
          league: current,
          result: {
            state: current.seasonState,
            daysSimmed,
            gamesSimmed,
            stoppedReason: interrupt,
            events,
          },
        }
      }
    }

    const gamesBefore = current.seasonState.games.length
    const stateBefore = current.seasonState
    current = simulateLeagueRegularDay(current, rng, currentDay)
    const newGames = current.seasonState.games.slice(gamesBefore)
    daysSimmed += 1
    gamesSimmed += newGames.length
    events.push(...userGameEvents(current, newGames))
    if (crossedTradeDeadline(stateBefore, current.seasonState)) {
      events.push({ type: "trade_deadline_passed" })
    }

    const reconciled = reconcileCalendarPhase(current, rng)
    current = reconciled.league
    events.push(...reconciled.events)
    if (reconciled.stoppedReason) {
      return {
        league: current,
        result: {
          state: current.seasonState,
          daysSimmed,
          gamesSimmed,
          stoppedReason: reconciled.stoppedReason,
          events,
        },
      }
    }

    if (
      shouldStopForTarget(current.seasonState, options.target, targetDay)
    ) {
      if (options.target === "day" || options.target === "next_stop") {
        return {
          league: current,
          result: {
            state: current.seasonState,
            daysSimmed,
            gamesSimmed,
            events,
          },
        }
      }

      if (options.target === "week" && daysSimmed >= 7) {
        return {
          league: current,
          result: {
            state: current.seasonState,
            daysSimmed,
            gamesSimmed,
            events,
          },
        }
      }

      if (
        options.target !== "week" &&
        current.seasonState.currentDay >= targetDay
      ) {
        return {
          league: current,
          result: {
            state: current.seasonState,
            daysSimmed,
            gamesSimmed,
            stoppedReason: "target_reached",
            events,
          },
        }
      }
    }
  }

  return {
    league: current,
    result: {
      state: current.seasonState,
      daysSimmed,
      gamesSimmed,
      events,
    },
  }
}
