import type {
  GameCoachingProfile,
  GameMatchupFixture,
  GameResult,
  GameRotationInput,
  GameSimulationConfig,
  LeagueCommand,
  LeagueDocument,
  LeagueEvent,
  LeagueGameRecord,
  LeaguePlayerAvailability,
  LeagueScheduleEntry,
  LeagueStanding,
  LeagueSeasonArchive,
  PlayerRatingSnapshot,
  LifecycleTarget,
  PlayerAvailability,
  SeasonCheckpointReport,
  SeasonFixture,
  SeasonProductionConfig,
  ValidationIssue,
} from "@workspace/domain-v2"
import {
  gameSimulationConfigSchema,
  validateLeagueDocument,
} from "@workspace/league-schema"

import { aggregateSeasonProduction } from "./production"
import {
  createStandardGameSimulationConfig,
  resolveGameSimulationConfig,
} from "./gameConfig"
import { simulateGameMatchup } from "./gameSimulation"
import { createDefaultRotation } from "./seasonFixture"
import {
  createStandardSeasonProductionConfig,
  resolveSeasonProductionConfig,
} from "./seasonConfig"
import { calculateUniversalPlayerValues } from "./playerValue"
import { advancePlayerCareerYear, getCareerPhase } from "./careerDevelopment"
import { createDeterministicRandom } from "./randomness"
import { getPlayerCurrentAbility } from "./playerGeneration"
import { createLeagueCalendar } from "./leagueSchedule"

export type LifecycleActionId =
  | "advance-day"
  | "next-game"
  | "next-key-date"
  | "simulate-to-date"
  | "simulate-to-deadline"
  | "simulate-to-season-end"
  | "next-phase"

export type LifecycleActionState = {
  id: LifecycleActionId
  label: string
  enabled: boolean
  reason?: string
  target?: LifecycleTarget
  expectedDates?: number
  expectedGames?: number
}

export type LifecycleAdvanceResult = {
  league: LeagueDocument
  events: LeagueEvent[]
  progress: {
    completed: number
    total: number
    label: string
    datesProcessed: number
    gamesCompleted: number
    currentDate: string
  }
  target?: LifecycleTarget
}

export type LifecycleProgressUpdate = {
  progress: LifecycleAdvanceResult["progress"]
  checkpoint: {
    currentDate: string
    completedGames: number
    league: LeagueDocument
  }
}

export type LifecycleProgressCallback = (
  update: LifecycleProgressUpdate
) => void

export type LeagueDateSimulationResult = {
  league: LeagueDocument
  events: LeagueEvent[]
  games: LeagueGameRecord[]
  currentDate: string
}

export class LifecycleCommandError extends Error {
  readonly reason: ValidationIssue

  constructor(reason: ValidationIssue) {
    super(reason.message)
    this.name = "LifecycleCommandError"
    this.reason = reason
  }
}

function fail(
  code: string,
  message: string,
  path?: Array<string | number>
): never {
  throw new LifecycleCommandError({ code, message, path })
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(dateValue: string, days: number): string {
  const date = new Date(`${dateValue}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return dateKey(date)
}

function compareDates(left: string, right: string): number {
  return left.localeCompare(right)
}

function dateDistance(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`).getTime()
  const end = new Date(`${to}T00:00:00Z`).getTime()
  return Math.max(0, Math.round((end - start) / 86_400_000))
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

function defaultAvailability(): LeaguePlayerAvailability {
  return {
    available: true,
    gamesRemaining: 0,
    restriction: "none",
    gamesMissed: 0,
  }
}

function getAvailability(
  league: LeagueDocument,
  playerId: string
): LeaguePlayerAvailability {
  return league.state.availability?.[playerId] ?? defaultAvailability()
}

function ensureAvailability(league: LeagueDocument): void {
  league.state.availability ??= {}
  for (const playerId of Object.keys(league.entities.players)) {
    league.state.availability[playerId] ??= defaultAvailability()
  }
}

function getTeamRotation(
  league: LeagueDocument,
  teamId: string,
  playerIds: string[]
): GameRotationInput {
  const plan = league.state.gamePlans?.[teamId]?.rotation
  const rotation = plan ?? league.state.rotations?.[teamId]
  if (rotation) return structuredClone(rotation)

  const players = playerIds
    .map((playerId) => league.entities.players[playerId])
    .filter((player): player is NonNullable<typeof player> => Boolean(player))
  return createDefaultRotation(players)
}

function getTeamCoaching(
  league: LeagueDocument,
  teamId: string
): GameCoachingProfile {
  return structuredClone(
    league.state.gamePlans?.[teamId]?.coaching ?? createDefaultCoachingProfile()
  )
}

function isPositionEligible(
  player: NonNullable<LeagueDocument["entities"]["players"][string]>,
  position: string
): boolean {
  return (
    player.profile.role.primaryPosition === position ||
    player.profile.role.secondaryPosition === position
  )
}

function createAvailableRotation(
  league: LeagueDocument,
  teamId: string,
  rotation: GameRotationInput
): GameRotationInput {
  const availableIds = rotation.depthOrder.filter(
    (playerId) => getAvailability(league, playerId).available !== false
  )
  const positions = ["PG", "SG", "SF", "PF", "C"]
  const starters: string[] = []

  function findStarters(positionIndex: number): boolean {
    if (positionIndex === positions.length) return true
    const position = positions[positionIndex]!
    for (const playerId of availableIds) {
      const player = league.entities.players[playerId]
      if (
        !player ||
        starters.includes(playerId) ||
        !isPositionEligible(player, position)
      ) {
        continue
      }
      starters.push(playerId)
      if (findStarters(positionIndex + 1)) return true
      starters.pop()
    }
    return false
  }

  findStarters(0)
  for (const playerId of availableIds) {
    if (starters.length >= 5) break
    if (!starters.includes(playerId)) starters.push(playerId)
  }

  if (starters.length < 5) {
    fail(
      "schedule_roster_unavailable",
      `The ${league.entities.teams[teamId]?.name ?? teamId} does not have five available players for its next game.`,
      ["state", "availability", teamId]
    )
  }

  return {
    ...structuredClone(rotation),
    starters,
    depthOrder: [
      ...starters,
      ...rotation.depthOrder.filter((playerId) => !starters.includes(playerId)),
    ],
  }
}

function reconcileSavedPlansForAvailability(league: LeagueDocument): void {
  if (!league.state.gamePlans) return

  for (const [teamId, plan] of Object.entries(league.state.gamePlans)) {
    const rotation = plan.rotation
    if (
      !rotation.starters.some(
        (playerId) => !getAvailability(league, playerId).available
      )
    ) {
      continue
    }

    const repairedRotation = createAvailableRotation(league, teamId, rotation)
    league.state.gamePlans[teamId] = {
      ...plan,
      rotation: repairedRotation,
    }
    if (league.state.rotations) {
      league.state.rotations[teamId] = structuredClone(repairedRotation)
    }
  }
}

function getGameConfig(league: LeagueDocument): GameSimulationConfig {
  if (league.settings.gameConfig) {
    return resolveGameSimulationConfig(
      structuredClone(league.settings.gameConfig)
    )
  }

  const override = league.settings.advancedOverrides.gameConfig
  const parsed = gameSimulationConfigSchema.safeParse(override)
  return parsed.success
    ? resolveGameSimulationConfig(parsed.data)
    : createStandardGameSimulationConfig()
}

function createGameFixture(
  league: LeagueDocument,
  scheduleEntry: LeagueScheduleEntry
): GameMatchupFixture {
  const homeTeam = league.entities.teams[scheduleEntry.homeTeamId]
  const awayTeam = league.entities.teams[scheduleEntry.awayTeamId]
  if (!homeTeam || !awayTeam) {
    fail(
      "schedule_team_missing",
      "A scheduled game references a team that is not in the league.",
      ["state", "calendar", "schedule", scheduleEntry.id]
    )
  }

  const homeRoster = homeTeam.rosterPlayerIds ?? []
  const awayRoster = awayTeam.rosterPlayerIds ?? []
  const homePlayers = homeRoster
    .map((playerId) => league.entities.players[playerId])
    .filter((player): player is NonNullable<typeof player> => Boolean(player))
  const awayPlayers = awayRoster
    .map((playerId) => league.entities.players[playerId])
    .filter((player): player is NonNullable<typeof player> => Boolean(player))
  if (homePlayers.length < 5 || awayPlayers.length < 5) {
    fail(
      "schedule_roster_incomplete",
      "A scheduled game references a team without five rostered players.",
      ["state", "calendar", "schedule", scheduleEntry.id]
    )
  }

  ensureAvailability(league)
  const players: GameMatchupFixture["players"] = {}
  for (const playerId of [...homeRoster, ...awayRoster]) {
    const player = league.entities.players[playerId]
    if (player) players[playerId] = player
  }

  const fixture = {
    version: 1,
    source: {
      kind: "league-document" as const,
      id: league.metadata.id,
      version: 1,
    },
    seed: `${league.randomness.seed ?? league.metadata.id}:game:${league.state.season}:${scheduleEntry.id}:v2`,
    homeTeamId: scheduleEntry.homeTeamId,
    awayTeamId: scheduleEntry.awayTeamId,
    teams: {
      [homeTeam.id]: { id: homeTeam.id, name: homeTeam.name },
      [awayTeam.id]: { id: awayTeam.id, name: awayTeam.name },
    },
    players,
    rotations: {
      [homeTeam.id]: createAvailableRotation(
        league,
        homeTeam.id,
        getTeamRotation(league, homeTeam.id, homeRoster)
      ),
      [awayTeam.id]: createAvailableRotation(
        league,
        awayTeam.id,
        getTeamRotation(league, awayTeam.id, awayRoster)
      ),
    },
    availability: Object.fromEntries(
      [...homeRoster, ...awayRoster].map((playerId) => [
        playerId,
        structuredClone(
          getAvailability(league, playerId)
        ) as PlayerAvailability,
      ])
    ),
    coaching: {
      [homeTeam.id]: getTeamCoaching(league, homeTeam.id),
      [awayTeam.id]: getTeamCoaching(league, awayTeam.id),
    },
    config: getGameConfig(league),
  } satisfies GameMatchupFixture

  // The matchup adapter intentionally consumes the same available-rotation
  // helper used by the season runner. This keeps saved plans and injury state
  // on one path.
  return fixture
}

function getTeamPoints(result: GameResult, teamId: string): number {
  return result.teams[teamId]?.points ?? 0
}

function updateStandings(
  standings: LeagueStanding[],
  result: GameResult
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
  result: GameResult
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
  result: GameResult
): LeagueEvent[] {
  return result.events.map((event, index) => ({
    id: `event:injury:${scheduleEntry.id}:${String(index + 1)}`,
    type: "injury.recorded" as const,
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
    importance: "notable" as const,
    storyTags: ["regular-season", "injury"],
    source: { kind: "simulation" as const, id: scheduleEntry.id },
  }))
}

function applyAvailabilityAfterGame(
  league: LeagueDocument,
  scheduleEntry: LeagueScheduleEntry,
  result: GameResult
): void {
  ensureAvailability(league)
  league.history.injuries ??= []
  const injuredIds = new Set(result.events.map((event) => event.playerId))
  const activeIds = [
    ...(league.entities.teams[scheduleEntry.homeTeamId]?.rosterPlayerIds ?? []),
    ...(league.entities.teams[scheduleEntry.awayTeamId]?.rosterPlayerIds ?? []),
  ]

  for (const playerId of activeIds) {
    const availability = league.state.availability![playerId]!
    if (availability.available || injuredIds.has(playerId)) continue
    availability.gamesRemaining = Math.max(0, availability.gamesRemaining - 1)
    availability.gamesMissed += 1
    const injury = league.history.injuries.find(
      (entry) =>
        entry.playerId === playerId &&
        entry.id === `injury:${entry.sourceScheduleId}:${playerId}` &&
        !entry.returnDate
    )
    if (injury) injury.gamesMissed += 1
    if (availability.gamesRemaining === 0) {
      availability.available = true
      availability.restriction = "none"
      delete availability.minutesLimit
      delete availability.injury
      if (injury) injury.returnDate = scheduleEntry.date
    }
  }

  for (const event of result.events) {
    const current = league.state.availability![event.playerId]!
    current.available = false
    current.gamesRemaining = Math.max(1, event.gamesRemaining)
    current.restriction = "none"
    delete current.minutesLimit
    current.injury = {
      startedDate: scheduleEntry.date,
      expectedReturnDate: addDays(scheduleEntry.date, event.gamesRemaining),
      sourceScheduleId: scheduleEntry.id,
      description: event.description,
    }
    const id = `injury:${scheduleEntry.id}:${event.playerId}`
    if (!league.history.injuries.some((injury) => injury.id === id)) {
      league.history.injuries.push({
        id,
        playerId: event.playerId,
        season: league.state.season,
        startDate: scheduleEntry.date,
        expectedReturnDate: addDays(scheduleEntry.date, event.gamesRemaining),
        description: event.description,
        gamesMissed: 0,
        sourceScheduleId: scheduleEntry.id,
      })
    }
  }
}

function createLeagueSeasonFixture(
  league: LeagueDocument,
  availability: Record<string, LeaguePlayerAvailability>
): SeasonFixture {
  const standard = createStandardSeasonProductionConfig("full")
  const productionConfig: SeasonProductionConfig =
    resolveSeasonProductionConfig(
      league.settings.productionConfig ?? {
        ...standard,
        schedule: {
          ...standard.schedule,
          teamCount: Object.keys(league.entities.teams).length,
          scheduleSeed: `${league.randomness.seed ?? league.metadata.id}:production`,
        },
      }
    )
  const teamIds = Object.keys(league.entities.teams)
  const rosters = Object.fromEntries(
    teamIds.map((teamId) => [
      teamId,
      [...(league.entities.teams[teamId]?.rosterPlayerIds ?? [])],
    ])
  )
  const playerIds = Object.values(rosters).flat()
  const players = structuredClone(league.entities.players)
  const rotations = Object.fromEntries(
    teamIds.map((teamId) => [
      teamId,
      getTeamRotation(league, teamId, rosters[teamId] ?? []),
    ])
  )
  return {
    version: 1,
    source: { kind: "league-document", id: league.metadata.id, version: 1 },
    seed: `${league.randomness.seed ?? league.metadata.id}:season:${league.state.season}`,
    season: league.state.season,
    teams: Object.fromEntries(
      teamIds.map((teamId) => [
        teamId,
        { id: teamId, name: league.entities.teams[teamId]!.name },
      ])
    ),
    players,
    rosters,
    populations: {
      rostered: playerIds,
      freeAgents: Object.values(players)
        .filter((player) => player.leagueStatus.kind === "free-agent")
        .map((player) => player.id),
      draftProspects: Object.values(players)
        .filter((player) => player.leagueStatus.kind === "draft-prospect")
        .map((player) => player.id),
    },
    schedule: [],
    rotations,
    coaching: Object.fromEntries(
      teamIds.map((teamId) => [teamId, getTeamCoaching(league, teamId)])
    ),
    availability: Object.fromEntries(
      Object.entries(availability).map(([playerId, value]) => [
        playerId,
        {
          available: value.available,
          gamesRemaining: value.gamesRemaining,
          restriction: value.restriction,
          ...(value.minutesLimit === undefined
            ? {}
            : { minutesLimit: value.minutesLimit }),
        } satisfies PlayerAvailability,
      ])
    ),
    gameConfig: getGameConfig(league),
    config: {
      ...productionConfig,
      schedule: {
        ...productionConfig.schedule,
        teamCount: teamIds.length,
      },
    },
  }
}

function getGamesPerTeam(
  league: LeagueDocument,
  games: LeagueGameRecord[]
): number {
  const counts = Object.fromEntries(
    Object.keys(league.entities.teams).map((teamId) => [teamId, 0])
  )
  for (const game of games) {
    if (game.result.status !== "completed") continue
    counts[game.result.homeTeamId] = (counts[game.result.homeTeamId] ?? 0) + 1
    counts[game.result.awayTeamId] = (counts[game.result.awayTeamId] ?? 0) + 1
  }
  const values = Object.values(counts)
  return values.length ? Math.min(...values) : 0
}

function updateCurrentSeason(
  league: LeagueDocument,
  games: LeagueGameRecord[]
): SeasonCheckpointReport {
  const currentSeasonGames = games
    .filter((game) => game.season === league.state.season)
    .sort((left, right) => left.date.localeCompare(right.date))
  const availability = league.state.availability ?? {}
  const fixture = createLeagueSeasonFixture(league, availability)
  const gamesPerTeam = getGamesPerTeam(league, currentSeasonGames)
  const aggregation = aggregateSeasonProduction(
    fixture,
    currentSeasonGames.map((game) => game.result),
    gamesPerTeam
  )
  return {
    season: league.state.season,
    throughDate:
      currentSeasonGames.at(-1)?.date ?? league.state.calendar.currentDate,
    gamesPerTeam,
    gamesCompleted: aggregation.league.gamesCompleted,
    playerProduction: aggregation.players,
    teamProduction: aggregation.teams,
    leagueSummary: aggregation.league,
    values: calculateUniversalPlayerValues(
      fixture,
      aggregation,
      fixture.config.value,
      gamesPerTeam,
      gamesPerTeam === 0 ? "preseason" : "checkpoint"
    ),
  }
}

function getStoredGames(league: LeagueDocument): LeagueGameRecord[] {
  return league.optionalData?.games ?? []
}

function createRatingSnapshot(
  league: LeagueDocument,
  playerId: string,
  season: number
): PlayerRatingSnapshot | null {
  const player = league.entities.players[playerId]
  if (!player || player.leagueStatus.kind === "retired") return null
  return {
    season,
    age: player.age,
    overall: getPlayerCurrentAbility(player),
    skills: structuredClone(player.profile.skills),
    phase: getCareerPhase(
      player.age,
      player.profile.development.peakAge,
      player.profile.development.declineStartAge
    ),
  }
}

function createSeasonArchive(
  league: LeagueDocument,
  report: SeasonCheckpointReport,
  games: LeagueGameRecord[]
): LeagueSeasonArchive {
  const ratingSnapshots = Object.fromEntries(
    Object.keys(league.entities.players).flatMap((playerId) => {
      const snapshot = createRatingSnapshot(
        league,
        playerId,
        league.state.season
      )
      return snapshot ? [[playerId, snapshot] as const] : []
    })
  )
  const playerProduction = Object.fromEntries(
    Object.entries(report.playerProduction).map(([playerId, production]) => [
      playerId,
      {
        ...production,
        season: league.state.season,
        throughDate: report.throughDate,
      },
    ])
  )
  return {
    season: league.state.season,
    completedAt: `${league.state.calendar.regularSeasonEnd}T23:59:59.999Z`,
    games: structuredClone(games),
    playerProduction,
    teamProduction: structuredClone(report.teamProduction),
    leagueSummary: structuredClone(report.leagueSummary),
    playerValues: structuredClone(report.values),
    ratingSnapshots,
    injuries: structuredClone(
      (league.history.injuries ?? []).filter(
        (injury) => injury.season === league.state.season
      )
    ),
    modelVersions: {
      game: 1,
      production: 1,
      value: 1,
      development: 1,
    },
  }
}

function resetSeasonAvailability(league: LeagueDocument): void {
  league.state.availability = Object.fromEntries(
    Object.keys(league.entities.players).map((playerId) => [
      playerId,
      defaultAvailability(),
    ])
  )
}

export function advanceToNextSeason(
  league: LeagueDocument,
  command: Extract<LeagueCommand, { type: "AdvanceToNextSeason" }>
): {
  league: LeagueDocument
  events: LeagueEvent[]
  archive: LeagueSeasonArchive
} {
  if (league.state.phase !== "regular-season") {
    fail(
      "phase_command_blocked",
      "A season can only be closed from the regular season.",
      ["state", "phase"]
    )
  }
  if (hasRemainingRegularSeasonGames(league)) {
    fail(
      "season_not_complete",
      "Complete every regular-season game before advancing to the next season.",
      ["state", "calendar", "schedule"]
    )
  }
  const currentSeason = league.state.season
  if (
    league.history.seasonArchives.some(
      (archive) => archive.season === currentSeason
    )
  ) {
    fail(
      "season_already_archived",
      `Season ${currentSeason} has already been archived.`,
      ["history", "seasonArchives"]
    )
  }

  const currentGames = getStoredGames(league).filter(
    (game) => game.season === currentSeason
  )
  const report =
    league.projections.currentSeason ??
    updateCurrentSeason(league, currentGames)
  const archive = createSeasonArchive(league, report, currentGames)
  const nextLeague = structuredClone(league)
  nextLeague.history.seasonArchives.push(archive)
  nextLeague.history.injuries ??= []
  const developmentEvents: LeagueEvent[] = []

  for (const player of Object.values(league.entities.players)) {
    if (player.leagueStatus.kind === "retired") continue
    const production = report.playerProduction[player.id]
    const gamesScheduled = Math.max(1, production?.gamesScheduled ?? 0)
    const gamesPlayed = Math.min(gamesScheduled, production?.gamesPlayed ?? 0)
    const gamesMissed = archive.injuries
      .filter((injury) => injury.playerId === player.id)
      .reduce((sum, injury) => sum + injury.gamesMissed, 0)
    const context = {
      season: currentSeason,
      minutes: production?.minutes ?? 0,
      gamesPlayed,
      gamesScheduled,
      injuryDevelopmentPenalty: Math.min(1, gamesMissed / gamesScheduled),
      coachingDevelopmentEmphasis: 50,
    }
    const transition = advancePlayerCareerYear({
      player,
      context,
      random: createDeterministicRandom(
        `${league.randomness.seed ?? league.metadata.id}:development:${currentSeason}:${player.id}`
      ),
    })
    nextLeague.entities.players[player.id] = transition.player
    developmentEvents.push({
      id: `event:development:${currentSeason}:${player.id}`,
      type: "development.updated",
      season: currentSeason,
      phase: league.state.phase,
      leagueDay: league.state.leagueDay,
      entityRefs: [{ type: "player", id: player.id }],
      payload: {
        phase: transition.phase,
        skillDeltas: transition.skillDeltas,
        gamesPlayed,
        gamesScheduled,
        injuryDevelopmentPenalty: context.injuryDevelopmentPenalty,
      },
      summary: `Applied ${transition.phase} development for ${player.identity.firstName ?? "Player"} ${player.identity.lastName ?? player.id}.`,
      importance: "routine",
      storyTags: ["development", transition.phase],
      source: { kind: "simulation", id: command.commandId },
    })
  }

  const nextSeason = currentSeason + 1
  const teamIds = Object.keys(nextLeague.entities.teams).sort()
  nextLeague.state.season = nextSeason
  nextLeague.state.phase = "regular-season"
  delete nextLeague.state.offseasonPhase
  delete nextLeague.state.lifecycleBoundary
  nextLeague.state.leagueDay = 0
  nextLeague.state.calendar = createLeagueCalendar(
    teamIds,
    nextLeague.state.structure!,
    `${nextLeague.randomness.seed ?? nextLeague.metadata.id}:season:${nextSeason}`,
    new Date(
      `${league.state.calendar.regularSeasonStart}T00:00:00Z`
    ).getUTCFullYear() + 1
  )
  const nextSeasonStart = nextLeague.state.calendar.regularSeasonStart
  for (const injury of nextLeague.history.injuries ?? []) {
    if (!injury.returnDate) injury.returnDate = nextSeasonStart
  }
  for (const injury of archive.injuries) {
    if (!injury.returnDate) injury.returnDate = nextSeasonStart
  }
  nextLeague.state.rotations = Object.fromEntries(
    teamIds.map((teamId) => {
      const players = (nextLeague.entities.teams[teamId]?.rosterPlayerIds ?? [])
        .map((playerId) => nextLeague.entities.players[playerId])
        .filter((player): player is NonNullable<typeof player> =>
          Boolean(player)
        )
      return [teamId, createDefaultRotation(players)]
    })
  )
  if (nextLeague.state.gamePlans) {
    nextLeague.state.gamePlans = Object.fromEntries(
      teamIds.map((teamId) => [
        teamId,
        {
          ...nextLeague.state.gamePlans![teamId]!,
          rotation: structuredClone(nextLeague.state.rotations![teamId]),
        },
      ])
    )
  }
  nextLeague.projections.standings = teamIds.map((teamId) => ({
    teamId,
    wins: 0,
    losses: 0,
  }))
  delete nextLeague.projections.currentSeason
  resetSeasonAvailability(nextLeague)
  nextLeague.optionalData = {
    ...nextLeague.optionalData,
    games: [],
  }
  nextLeague.metadata.updatedAt = new Date().toISOString()

  const archiveEvent: LeagueEvent = {
    id: `event:season-archive:${currentSeason}`,
    type: "season.archived",
    season: currentSeason,
    phase: league.state.phase,
    leagueDay: league.state.leagueDay,
    entityRefs: [],
    payload: {
      season: currentSeason,
      games: archive.games.length,
      playersDeveloped: developmentEvents.length,
      nextSeason,
    },
    summary: `Archived season ${currentSeason} and advanced the league to season ${nextSeason}.`,
    importance: "major",
    storyTags: ["season", "archive", "development"],
    source: { kind: "command", id: command.commandId },
  }
  const events = [archiveEvent, ...developmentEvents]
  nextLeague.history.events.push(...events)
  const validation = validateLeagueDocument(nextLeague)
  if (!validation.valid) {
    fail(
      "invalid_season_transition",
      validation.issues[0]?.message ??
        "The season transition produced an invalid league snapshot.",
      validation.issues[0]?.path
    )
  }
  return { league: validation.data, events, archive }
}

export function simulateOneLeagueDate(
  league: LeagueDocument,
  date: string,
  commandId = `date:${date}`
): LeagueDateSimulationResult {
  if (league.state.phase !== "regular-season") {
    fail(
      "phase_command_blocked",
      "Regular-season simulation is available only during the regular season.",
      ["state", "phase"]
    )
  }
  if (date !== league.state.calendar.currentDate) {
    fail(
      "invalid_simulation_date",
      `The next unprocessed date is ${league.state.calendar.currentDate}.`,
      ["state", "calendar", "currentDate"]
    )
  }
  if (compareDates(date, league.state.calendar.regularSeasonEnd) > 0) {
    fail(
      "regular_season_complete",
      "The regular season has reached its supported boundary.",
      ["state", "calendar", "regularSeasonEnd"]
    )
  }

  const scheduledGames = league.state.calendar.schedule.filter(
    (entry) =>
      entry.kind === "regular-season" &&
      entry.status === "scheduled" &&
      entry.date === date
  )
  const storedGameIds = new Set(
    getStoredGames(league).map((game) => game.scheduleId)
  )
  for (const entry of scheduledGames) {
    if (storedGameIds.has(entry.id)) {
      fail(
        "game_already_completed",
        `Schedule entry ${entry.id} already has a stored game record.`,
        ["state", "calendar", "schedule", entry.id]
      )
    }
  }

  const nextLeague = structuredClone(league)
  ensureAvailability(nextLeague)
  const completedGames: LeagueGameRecord[] = []
  const events: LeagueEvent[] = []

  for (const scheduleEntry of scheduledGames) {
    const result = simulateGameMatchup(
      createGameFixture(nextLeague, scheduleEntry)
    )
    if (result.status !== "completed" || !result.reconciliation.passed) {
      fail(
        "game_simulation_failed",
        `The game on ${scheduleEntry.date} could not be completed.`,
        ["state", "calendar", "schedule", scheduleEntry.id]
      )
    }
    const nextScheduleEntry = nextLeague.state.calendar.schedule.find(
      (entry) => entry.id === scheduleEntry.id
    )
    if (!nextScheduleEntry) {
      fail(
        "schedule_entry_missing",
        "The scheduled game disappeared during simulation."
      )
    }
    nextScheduleEntry.status = "completed"
    const record = {
      scheduleId: scheduleEntry.id,
      season: league.state.season,
      date: scheduleEntry.date,
      kind: scheduleEntry.kind,
      result,
    } satisfies LeagueGameRecord
    completedGames.push(record)
    events.push(gameEvent(nextLeague, scheduleEntry, result))
    events.push(...injuryEvents(nextLeague, scheduleEntry, result))
    applyAvailabilityAfterGame(nextLeague, scheduleEntry, result)
    nextLeague.projections.standings = updateStandings(
      nextLeague.projections.standings,
      result
    )
  }

  reconcileSavedPlansForAvailability(nextLeague)

  nextLeague.optionalData ??= {}
  nextLeague.optionalData.games ??= []
  nextLeague.optionalData.games.push(...completedGames)
  nextLeague.state.leagueDay += 1
  nextLeague.state.calendar.currentDate = addDays(date, 1)
  nextLeague.metadata.updatedAt = new Date().toISOString()
  const calendarEvent: LeagueEvent = {
    id: `event:calendar:${commandId}:${date}`,
    type: "calendar.advanced",
    season: nextLeague.state.season,
    phase: nextLeague.state.phase,
    leagueDay: nextLeague.state.leagueDay,
    entityRefs: [],
    payload: {
      fromDate: date,
      toDate: nextLeague.state.calendar.currentDate,
      gamesCompleted: completedGames.length,
    },
    summary:
      completedGames.length > 0
        ? `Completed ${completedGames.length} game${completedGames.length === 1 ? "" : "s"} on ${date}.`
        : `Advanced to ${nextLeague.state.calendar.currentDate}.`,
    importance: "routine",
    storyTags: ["calendar", "regular-season"],
    source: { kind: "command", id: commandId },
  }
  events.push(calendarEvent)

  const allGames = getStoredGames(nextLeague)
  nextLeague.projections.currentSeason = updateCurrentSeason(
    nextLeague,
    allGames
  )
  const productionEvent: LeagueEvent = {
    id: `event:production:${commandId}:${date}`,
    type: "production.updated",
    season: nextLeague.state.season,
    phase: nextLeague.state.phase,
    leagueDay: nextLeague.state.leagueDay,
    entityRefs: [],
    payload: {
      gamesCompleted: nextLeague.projections.currentSeason.gamesCompleted,
      gamesPerTeam: nextLeague.projections.currentSeason.gamesPerTeam,
    },
    summary: "Updated current-season production and player value.",
    importance: "routine",
    storyTags: ["season", "production", "player-value"],
    source: { kind: "simulation", id: commandId },
  }
  events.push(productionEvent)
  nextLeague.history.events.push(...events)

  const validation = validateLeagueDocument(nextLeague)
  if (!validation.valid) {
    fail(
      "invalid_lifecycle_snapshot",
      validation.issues[0]?.message ??
        "The lifecycle command produced an invalid league snapshot.",
      validation.issues[0]?.path
    )
  }
  return {
    league: validation.data,
    events,
    games: completedGames,
    currentDate: validation.data.state.calendar.currentDate,
  }
}

function hasRemainingRegularSeasonGames(league: LeagueDocument): boolean {
  return league.state.calendar.schedule.some(
    (entry) =>
      entry.kind === "regular-season" &&
      entry.status === "scheduled" &&
      entry.date >= league.state.calendar.currentDate
  )
}

export function resolveNextUserGame(
  league: LeagueDocument
): Extract<LifecycleTarget, { kind: "next-game" }> | null {
  const teamId = league.state.userTeamId
  if (!teamId) return null
  const scheduleEntry = league.state.calendar.schedule
    .filter(
      (entry) =>
        entry.kind === "regular-season" &&
        entry.status === "scheduled" &&
        entry.date >= league.state.calendar.currentDate &&
        (entry.homeTeamId === teamId || entry.awayTeamId === teamId)
    )
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) || left.id.localeCompare(right.id)
    )[0]
  return scheduleEntry
    ? {
        kind: "next-game",
        teamId,
        scheduleId: scheduleEntry.id,
        date: scheduleEntry.date,
      }
    : null
}

export function resolveNextKeyDate(
  league: LeagueDocument
): Extract<LifecycleTarget, { kind: "key-date" }> | null {
  const milestones = [
    {
      date: league.state.calendar.milestones.tradeDeadline,
      label: "Trade deadline",
    },
    {
      date: league.state.calendar.regularSeasonEnd,
      label: "Regular-season end",
    },
    {
      date: league.state.calendar.milestones.playoffsStart,
      label: "Play-in and playoffs start",
    },
  ]
    .filter((milestone) => milestone.date > league.state.calendar.currentDate)
    .sort((left, right) => left.date.localeCompare(right.date))
  const milestone = milestones[0]
  return milestone ? { kind: "key-date", ...milestone } : null
}

function actionForTarget(
  league: LeagueDocument,
  id: LifecycleActionId,
  label: string,
  target: LifecycleTarget | null,
  reason?: string
): LifecycleActionState {
  return {
    id,
    label,
    enabled: !reason && Boolean(target),
    reason,
    target: target ?? undefined,
    expectedDates: target
      ? dateDistance(league.state.calendar.currentDate, target.date) +
        (target.kind === "deadline" || target.kind === "key-date" ? 0 : 1)
      : undefined,
    expectedGames: target
      ? league.state.calendar.schedule.filter(
          (entry) =>
            entry.kind === "regular-season" &&
            entry.status === "scheduled" &&
            entry.date >= league.state.calendar.currentDate &&
            (target.kind === "deadline"
              ? entry.date < target.date
              : entry.date <= target.date)
        ).length
      : undefined,
  }
}

export function getLifecycleActionState(
  league: LeagueDocument,
  id: LifecycleActionId
): LifecycleActionState {
  const regularSeason = league.state.phase === "regular-season"
  const baseReason = regularSeason
    ? undefined
    : "This command is available during the regular season."
  if (!regularSeason) {
    return {
      id,
      label:
        id === "advance-day"
          ? "Advance day"
          : id === "next-game"
            ? "Next game"
            : id === "next-key-date"
              ? "Next key date"
              : id === "next-phase"
                ? "Next phase"
                : id === "simulate-to-season-end"
                  ? "Regular-season end"
                  : "Simulate to date",
      enabled: false,
      reason: baseReason,
    }
  }

  switch (id) {
    case "advance-day":
      return {
        id,
        label: "Advance day",
        enabled: hasRemainingRegularSeasonGames(league),
        reason: hasRemainingRegularSeasonGames(league)
          ? undefined
          : "The regular season is complete.",
      }
    case "next-game": {
      const target = resolveNextUserGame(league)
      return actionForTarget(
        league,
        id,
        "Next game",
        target,
        league.state.userTeamId
          ? target
            ? undefined
            : "No future game is scheduled for the selected team."
          : "Select a team before simulating its next game."
      )
    }
    case "next-key-date": {
      const target = resolveNextKeyDate(league)
      return actionForTarget(
        league,
        id,
        "Next key date",
        target,
        target ? undefined : "There are no future management milestones."
      )
    }
    case "simulate-to-deadline": {
      const date = league.state.calendar.milestones.tradeDeadline
      const target: LifecycleTarget = {
        kind: "deadline",
        date,
        label: "Trade deadline",
      }
      return actionForTarget(
        league,
        id,
        "Trade deadline",
        target,
        date > league.state.calendar.currentDate
          ? undefined
          : "The trade deadline has already been reached."
      )
    }
    case "simulate-to-season-end": {
      const target: LifecycleTarget = {
        kind: "regular-season-end",
        date: league.state.calendar.regularSeasonEnd,
      }
      return actionForTarget(
        league,
        id,
        "Regular-season end",
        target,
        hasRemainingRegularSeasonGames(league)
          ? undefined
          : "The regular season is complete."
      )
    }
    case "simulate-to-date":
      return {
        id,
        label: "Simulate to date",
        enabled: false,
        reason: "Choose a future date before starting date simulation.",
      }
    case "next-phase":
      return {
        id,
        label: "Next phase",
        enabled: false,
        reason: "No supported phase transition and target schedule exists yet.",
      }
  }
}

function resolveCommandTarget(
  league: LeagueDocument,
  command: LeagueCommand
): { target: LifecycleTarget; includeTargetDate: boolean } {
  switch (command.type) {
    case "SimulateToNextGame": {
      const target = resolveNextUserGame(league)
      if (!target) {
        fail(
          league.state.userTeamId
            ? "no_future_team_game"
            : "user_team_required",
          league.state.userTeamId
            ? "No future game is scheduled for the selected team."
            : "Select a team before simulating its next game.",
          ["state", "userTeamId"]
        )
      }
      return { target, includeTargetDate: true }
    }
    case "SimulateToDate": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(command.targetDate)) {
        fail(
          "invalid_target_date",
          "The target date must use YYYY-MM-DD format.",
          ["command", "targetDate"]
        )
      }
      if (command.targetDate < league.state.calendar.currentDate) {
        fail(
          "target_date_in_past",
          "A simulation target cannot be before the current date.",
          ["command", "targetDate"]
        )
      }
      if (command.targetDate > league.state.calendar.regularSeasonEnd) {
        fail(
          "target_date_outside_season",
          "The target date is outside the supported regular-season window.",
          ["command", "targetDate"]
        )
      }
      return {
        target: { kind: "date", date: command.targetDate },
        includeTargetDate: true,
      }
    }
    case "SimulateToNextKeyDate": {
      const keyDate = resolveNextKeyDate(league)
      if (!keyDate)
        fail("no_future_key_date", "There are no future management milestones.")
      if (keyDate.date === league.state.calendar.milestones.tradeDeadline) {
        return {
          target: {
            kind: "deadline",
            date: keyDate.date,
            label: keyDate.label,
          },
          includeTargetDate: false,
        }
      }
      return { target: keyDate, includeTargetDate: true }
    }
    case "SimulateToDeadline": {
      const date = league.state.calendar.milestones.tradeDeadline
      if (date <= league.state.calendar.currentDate) {
        fail(
          "deadline_already_reached",
          "The trade deadline has already been reached."
        )
      }
      return {
        target: { kind: "deadline", date, label: "Trade deadline" },
        includeTargetDate: false,
      }
    }
    case "SimulateToRegularSeasonEnd": {
      if (!hasRemainingRegularSeasonGames(league)) {
        fail("regular_season_complete", "The regular season is complete.")
      }
      return {
        target: {
          kind: "regular-season-end",
          date: league.state.calendar.regularSeasonEnd,
        },
        includeTargetDate: true,
      }
    }
    case "SimulateToNextPhase":
      fail(
        "next_phase_unavailable",
        "No supported next phase and target schedule exists yet.",
        ["state", "phase"]
      )
    default:
      fail(
        "unsupported_target_command",
        `${command.type} is not a target command.`
      )
  }
}

function markManagementBoundary(
  league: LeagueDocument,
  target: LifecycleTarget,
  commandId: string
): { league: LeagueDocument; event: LeagueEvent } {
  const nextLeague = structuredClone(league)
  const label =
    target.kind === "deadline" ? target.label : "Management boundary"
  nextLeague.state.lifecycleBoundary = {
    kind: target.kind === "next-phase" ? "phase" : "management",
    date: target.date,
    label,
    commandId,
  }
  nextLeague.metadata.updatedAt = new Date().toISOString()
  const event: LeagueEvent = {
    id: `event:target:${commandId}:${target.date}`,
    type: "lifecycle.target-reached",
    season: nextLeague.state.season,
    phase: nextLeague.state.phase,
    leagueDay: nextLeague.state.leagueDay,
    entityRefs: [],
    payload: { target },
    summary: `Arrived at ${label} on ${target.date}.`,
    importance: "major",
    storyTags: ["calendar", "management-boundary"],
    source: { kind: "command", id: commandId },
  }
  nextLeague.history.events.push(event)
  const validation = validateLeagueDocument(nextLeague)
  if (!validation.valid) {
    fail(
      "invalid_lifecycle_boundary",
      validation.issues[0]?.message ?? "The lifecycle boundary is invalid.",
      validation.issues[0]?.path
    )
  }
  return { league: validation.data, event }
}

function simulateToTarget(
  league: LeagueDocument,
  command: LeagueCommand,
  target: LifecycleTarget,
  includeTargetDate: boolean,
  onProgress?: LifecycleProgressCallback
): LifecycleAdvanceResult {
  let working = league
  const events: LeagueEvent[] = []
  let datesProcessed = 0
  let gamesCompleted = 0
  const finalDate = target.date
  const totalGames = working.state.calendar.schedule.filter(
    (entry) =>
      entry.kind === "regular-season" &&
      entry.status === "scheduled" &&
      (includeTargetDate ? entry.date <= finalDate : entry.date < finalDate) &&
      entry.date >= working.state.calendar.currentDate
  ).length

  while (
    includeTargetDate
      ? working.state.calendar.currentDate <= finalDate
      : working.state.calendar.currentDate < finalDate
  ) {
    const dateResult = simulateOneLeagueDate(
      working,
      working.state.calendar.currentDate,
      command.commandId
    )
    working = dateResult.league
    events.push(...dateResult.events)
    datesProcessed += 1
    gamesCompleted += dateResult.games.length
    onProgress?.({
      progress: {
        completed: gamesCompleted,
        total: totalGames,
        label:
          totalGames > 0
            ? `Simulated ${gamesCompleted} of ${totalGames} game${totalGames === 1 ? "" : "s"}.`
            : `Advanced through ${working.state.calendar.currentDate}.`,
        datesProcessed,
        gamesCompleted,
        currentDate: working.state.calendar.currentDate,
      },
      checkpoint: {
        currentDate: working.state.calendar.currentDate,
        completedGames: getStoredGames(working).length,
        league: working,
      },
    })
  }

  if (!includeTargetDate) {
    const boundary = markManagementBoundary(working, target, command.commandId)
    working = boundary.league
    events.push(boundary.event)
  }

  return {
    league: working,
    events,
    progress: {
      completed: gamesCompleted,
      total: gamesCompleted,
      label:
        gamesCompleted > 0
          ? `Completed ${gamesCompleted} game${gamesCompleted === 1 ? "" : "s"} through ${target.date}.`
          : `Arrived at ${target.date}.`,
      datesProcessed,
      gamesCompleted,
      currentDate: working.state.calendar.currentDate,
    },
    target,
  }
}

export function simulateLifecycleTarget(
  league: LeagueDocument,
  command: Extract<
    LeagueCommand,
    {
      type:
        | "SimulateToNextGame"
        | "SimulateToDate"
        | "SimulateToNextKeyDate"
        | "SimulateToDeadline"
        | "SimulateToRegularSeasonEnd"
        | "SimulateToNextPhase"
    }
  >,
  onProgress?: LifecycleProgressCallback
): LifecycleAdvanceResult {
  const resolved = resolveCommandTarget(league, command)
  return simulateToTarget(
    league,
    command,
    resolved.target,
    resolved.includeTargetDate,
    onProgress
  )
}

export function advanceLeagueDay(
  league: LeagueDocument,
  command: Extract<LeagueCommand, { type: "AdvanceDay" }>
): LifecycleAdvanceResult {
  const action = getLifecycleActionState(league, "advance-day")
  if (!action.enabled) {
    fail(
      "phase_command_blocked",
      action.reason ?? "Advance day is not available.",
      ["state", "phase"]
    )
  }
  const result = simulateOneLeagueDate(
    league,
    league.state.calendar.currentDate,
    command.commandId
  )
  return {
    league: result.league,
    events: result.events,
    progress: {
      completed: result.games.length,
      total: result.games.length,
      label: result.events.at(-2)?.summary ?? "Advanced the calendar.",
      datesProcessed: 1,
      gamesCompleted: result.games.length,
      currentDate: result.currentDate,
    },
  }
}
