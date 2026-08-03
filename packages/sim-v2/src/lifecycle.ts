import type {
  GameCoachingProfile,
  GameMatchupFixture,
  LeagueCommand,
  LeagueDocument,
  LeagueEvent,
  LeagueGameRecord,
  LeagueScheduleEntry,
  LeagueStanding,
  PlayerAvailability,
  ValidationIssue,
} from "@workspace/domain-v2"
import { validateLeagueDocument } from "@workspace/league-schema"

import { createStandardGameSimulationConfig } from "./gameConfig"
import { simulateGameMatchup } from "./gameSimulation"
import { createDefaultRotation } from "./seasonFixture"

export type LifecycleActionId =
  | "advance-day"
  | "next-game"
  | "next-key-date"
  | "simulate-to-deadline"
  | "simulate-to-season-end"

export type LifecycleActionState = {
  id: LifecycleActionId
  label: string
  enabled: boolean
  reason?: string
}

export type LifecycleAdvanceResult = {
  league: LeagueDocument
  events: LeagueEvent[]
  progress: {
    completed: number
    total: number
    label: string
  }
}

export class LifecycleCommandError extends Error {
  readonly reason: ValidationIssue

  constructor(reason: ValidationIssue) {
    super(reason.message)
    this.name = "LifecycleCommandError"
    this.reason = reason
  }
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(dateKeyValue: string, days: number): string {
  const date = new Date(`${dateKeyValue}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return dateKey(date)
}

function createDefaultCoachingProfile(): GameCoachingProfile {
  return {
    pace: 50,
    offensiveStyle: 50,
    defensivePressure: 50,
    shotSelection: 50,
    rotationDepth: 50,
  }
}

function createAvailability(
  league: LeagueDocument
): Record<string, PlayerAvailability> {
  return Object.fromEntries(
    Object.keys(league.entities.players).map((playerId) => [
      playerId,
      { available: true, gamesRemaining: 0, restriction: "none" },
    ])
  )
}

function createGameFixture(
  league: LeagueDocument,
  scheduleEntry: LeagueScheduleEntry
): GameMatchupFixture {
  const homeTeam = league.entities.teams[scheduleEntry.homeTeamId]
  const awayTeam = league.entities.teams[scheduleEntry.awayTeamId]
  if (!homeTeam || !awayTeam) {
    throw new LifecycleCommandError({
      code: "schedule_team_missing",
      message: "A scheduled game references a team that is not in the league.",
      path: ["state", "calendar", "schedule", scheduleEntry.id],
    })
  }

  const homePlayers = (homeTeam.rosterPlayerIds ?? [])
    .map((playerId) => league.entities.players[playerId])
    .filter((player): player is NonNullable<typeof player> => Boolean(player))
  const awayPlayers = (awayTeam.rosterPlayerIds ?? [])
    .map((playerId) => league.entities.players[playerId])
    .filter((player): player is NonNullable<typeof player> => Boolean(player))

  if (homePlayers.length < 5 || awayPlayers.length < 5) {
    throw new LifecycleCommandError({
      code: "schedule_roster_incomplete",
      message:
        "A scheduled game references a team without five playable players.",
      path: ["state", "calendar", "schedule", scheduleEntry.id],
    })
  }

  return {
    version: 1,
    source: { kind: "league-document", id: league.metadata.id, version: 1 },
    seed: `${league.randomness.seed ?? league.metadata.id}:${league.state.season}:${scheduleEntry.id}`,
    homeTeamId: scheduleEntry.homeTeamId,
    awayTeamId: scheduleEntry.awayTeamId,
    teams: {
      [homeTeam.id]: { id: homeTeam.id, name: homeTeam.name },
      [awayTeam.id]: { id: awayTeam.id, name: awayTeam.name },
    },
    players: league.entities.players,
    rotations: {
      [homeTeam.id]:
        league.state.rotations?.[homeTeam.id] ??
        createDefaultRotation(homePlayers),
      [awayTeam.id]:
        league.state.rotations?.[awayTeam.id] ??
        createDefaultRotation(awayPlayers),
    },
    availability: createAvailability(league),
    coaching: {
      [homeTeam.id]: createDefaultCoachingProfile(),
      [awayTeam.id]: createDefaultCoachingProfile(),
    },
    config: createStandardGameSimulationConfig(),
  }
}

function getTeamPoints(
  result: ReturnType<typeof simulateGameMatchup>,
  teamId: string
): number {
  return result.teams[teamId]?.points ?? 0
}

function updateStandings(
  standings: LeagueStanding[],
  result: ReturnType<typeof simulateGameMatchup>
): LeagueStanding[] {
  const homePoints = getTeamPoints(result, result.homeTeamId)
  const awayPoints = getTeamPoints(result, result.awayTeamId)

  return standings.map((standing) => {
    if (
      standing.teamId !== result.homeTeamId &&
      standing.teamId !== result.awayTeamId
    ) {
      return standing
    }

    const isHome = standing.teamId === result.homeTeamId
    const points = isHome ? homePoints : awayPoints
    const opponentPoints = isHome ? awayPoints : homePoints
    const won = result.winnerTeamId === standing.teamId
    return {
      ...standing,
      wins: standing.wins + (won ? 1 : 0),
      losses: standing.losses + (won ? 0 : 1),
      gamesPlayed:
        (standing.gamesPlayed ?? standing.wins + standing.losses) + 1,
      pointDifferential:
        (standing.pointDifferential ?? 0) + points - opponentPoints,
    }
  })
}

function gameEvent(
  league: LeagueDocument,
  scheduleEntry: LeagueScheduleEntry,
  result: ReturnType<typeof simulateGameMatchup>
): LeagueEvent {
  const homeTeam = league.entities.teams[scheduleEntry.homeTeamId]!
  const awayTeam = league.entities.teams[scheduleEntry.awayTeamId]!
  const homePoints = getTeamPoints(result, scheduleEntry.homeTeamId)
  const awayPoints = getTeamPoints(result, scheduleEntry.awayTeamId)
  return {
    id: `event:game:${scheduleEntry.id}`,
    type: "game.completed",
    season: league.state.season,
    phase: league.state.phase,
    leagueDay: league.state.leagueDay,
    entityRefs: [
      { type: "team", id: scheduleEntry.homeTeamId },
      { type: "team", id: scheduleEntry.awayTeamId },
    ],
    payload: {
      scheduleId: scheduleEntry.id,
      date: scheduleEntry.date,
      homeTeamId: scheduleEntry.homeTeamId,
      awayTeamId: scheduleEntry.awayTeamId,
      homePoints,
      awayPoints,
      winnerTeamId: result.winnerTeamId,
    },
    summary: `${homeTeam.name} ${homePoints}, ${awayTeam.name} ${awayPoints}.`,
    importance: "routine",
    storyTags: ["regular-season", "game"],
    source: { kind: "simulation", id: scheduleEntry.id },
  }
}

function injuryEvents(
  league: LeagueDocument,
  scheduleEntry: LeagueScheduleEntry,
  result: ReturnType<typeof simulateGameMatchup>
): LeagueEvent[] {
  return result.events.map((event, index) => ({
    id: `event:injury:${scheduleEntry.id}:${String(index + 1)}`,
    type: "injury.recorded",
    season: league.state.season,
    phase: league.state.phase,
    leagueDay: league.state.leagueDay,
    entityRefs: [
      { type: "team", id: event.teamId },
      { type: "player", id: event.playerId },
    ],
    payload: {
      scheduleId: scheduleEntry.id,
      date: scheduleEntry.date,
      period: event.period,
      gamesRemaining: event.gamesRemaining,
    },
    summary: event.description,
    importance: "notable",
    storyTags: ["regular-season", "injury"],
    source: { kind: "simulation", id: scheduleEntry.id },
  }))
}

export function getLifecycleActionState(
  league: LeagueDocument,
  id: LifecycleActionId
): LifecycleActionState {
  const regularSeason = league.state.phase === "regular-season"
  const hasRemainingGames = league.state.calendar.schedule.some(
    (entry) =>
      entry.kind === "regular-season" &&
      entry.status === "scheduled" &&
      entry.date >= league.state.calendar.currentDate
  )
  const baseReason = regularSeason
    ? undefined
    : "This command is available during the regular season."

  switch (id) {
    case "advance-day":
      return {
        id,
        label: "Advance day",
        enabled: regularSeason && hasRemainingGames,
        reason:
          baseReason ??
          (hasRemainingGames ? undefined : "The regular season is complete."),
      }
    case "next-game":
      return {
        id,
        label: "Next game",
        enabled: false,
        reason:
          "Next game simulation will use the same lifecycle command path.",
      }
    case "next-key-date":
      return {
        id,
        label: "Next key date",
        enabled: false,
        reason: "Key-date simulation is not enabled yet.",
      }
    case "simulate-to-deadline":
      return {
        id,
        label: "Simulate to deadline",
        enabled: false,
        reason: "Target-date simulation is not enabled yet.",
      }
    case "simulate-to-season-end":
      return {
        id,
        label: "Simulate to season end",
        enabled: false,
        reason: "Target-date simulation is not enabled yet.",
      }
  }
}

export function advanceLeagueDay(
  league: LeagueDocument,
  command: Extract<LeagueCommand, { type: "AdvanceDay" }>
): LifecycleAdvanceResult {
  const action = getLifecycleActionState(league, "advance-day")
  if (!action.enabled) {
    throw new LifecycleCommandError({
      code: "phase_command_blocked",
      message: action.reason ?? "Advance day is not available.",
      path: ["state", "phase"],
    })
  }

  const currentDate = league.state.calendar.currentDate
  const scheduledGames = league.state.calendar.schedule.filter(
    (entry) =>
      entry.kind === "regular-season" &&
      entry.status === "scheduled" &&
      entry.date === currentDate
  )
  const nextLeague = structuredClone(league)
  const completedGames: LeagueGameRecord[] = []
  const events: LeagueEvent[] = []

  for (const scheduleEntry of scheduledGames) {
    const result = simulateGameMatchup(createGameFixture(league, scheduleEntry))
    if (result.status !== "completed" || !result.reconciliation.passed) {
      throw new LifecycleCommandError({
        code: "game_simulation_failed",
        message: `The game on ${scheduleEntry.date} could not be completed.`,
        path: ["state", "calendar", "schedule", scheduleEntry.id],
      })
    }

    const nextScheduleEntry = nextLeague.state.calendar.schedule.find(
      (entry) => entry.id === scheduleEntry.id
    )
    if (nextScheduleEntry) nextScheduleEntry.status = "completed"
    completedGames.push({
      scheduleId: scheduleEntry.id,
      season: league.state.season,
      date: scheduleEntry.date,
      kind: scheduleEntry.kind,
      result,
    })
    events.push(
      gameEvent(league, scheduleEntry, result),
      ...injuryEvents(league, scheduleEntry, result)
    )
    nextLeague.projections.standings = updateStandings(
      nextLeague.projections.standings,
      result
    )
  }

  const nextDate = addDays(currentDate, 1)
  const calendarEvent: LeagueEvent = {
    id: `event:calendar:${command.commandId}`,
    type: "calendar.advanced",
    season: league.state.season,
    phase: league.state.phase,
    leagueDay: league.state.leagueDay + 1,
    entityRefs: [],
    payload: {
      fromDate: currentDate,
      toDate: nextDate,
      gamesCompleted: completedGames.length,
    },
    summary:
      completedGames.length > 0
        ? `Completed ${completedGames.length} game${completedGames.length === 1 ? "" : "s"} on ${currentDate}.`
        : `Advanced to ${nextDate}.`,
    importance: "routine",
    storyTags: ["calendar", "regular-season"],
    source: { kind: "command", id: command.commandId },
  }

  nextLeague.state.leagueDay += 1
  nextLeague.state.calendar.currentDate = nextDate
  nextLeague.metadata.updatedAt = new Date().toISOString()
  nextLeague.history.events.push(...events, calendarEvent)
  nextLeague.optionalData ??= {}
  nextLeague.optionalData.games ??= []
  nextLeague.optionalData.games.push(...completedGames)

  const validation = validateLeagueDocument(nextLeague)
  if (!validation.valid) {
    throw new LifecycleCommandError({
      code: "invalid_lifecycle_snapshot",
      message:
        validation.issues[0]?.message ??
        "The lifecycle command produced an invalid league snapshot.",
      path: validation.issues[0]?.path,
    })
  }

  return {
    league: validation.data,
    events: [...events, calendarEvent],
    progress: {
      completed: completedGames.length,
      total: completedGames.length,
      label: calendarEvent.summary,
    },
  }
}
