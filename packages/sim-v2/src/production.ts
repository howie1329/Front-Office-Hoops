import type {
  GamePlayerBoxScore,
  GameResult,
  GameTeamBoxScore,
  LeagueProductionSummary,
  PlayerEntity,
  PlayerSeasonProduction,
  PlayerTeamSeasonSplit,
  ProductionSampleState,
  SeasonFixture,
  TeamSeasonProduction,
} from "@workspace/domain-v2"

function round(value: number, precision = 2): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function safeRate(numerator: number, denominator: number): number {
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator <= 0
  ) {
    return 0
  }
  return round((numerator / denominator) * 100)
}

function safePerGame(total: number, games: number): number {
  return games > 0 ? round(total / games) : 0
}

function sampleState(games: number, scheduled: number): ProductionSampleState {
  if (games <= 0) return "provisional"
  if (games < 10) return "early"
  if (games < Math.min(82, scheduled)) return "established"
  return "full"
}

function populationFor(
  playerId: string,
  freeAgentIds: Set<string>,
  draftProspectIds: Set<string>
): PlayerSeasonProduction["population"] {
  if (freeAgentIds.has(playerId)) return "free-agent"
  if (draftProspectIds.has(playerId)) {
    return "draft-prospect"
  }
  return "rostered"
}

type MutablePlayerTotals = {
  gamesPlayed: number
  starts: number
  minutes: number
  opportunities: number
  usageWeighted: number
  usageWeight: number
  points: number
  fieldGoalsMade: number
  fieldGoalsAttempted: number
  threePointersMade: number
  threePointersAttempted: number
  freeThrowsMade: number
  freeThrowsAttempted: number
  offensiveRebounds: number
  defensiveRebounds: number
  rebounds: number
  assists: number
  turnovers: number
  steals: number
  blocks: number
  fouls: number
  shotProfile: {
    rimAttempts: number
    midrangeAttempts: number
    threePointAttempts: number
  }
  roleMinutes: Record<string, number>
}

type MutablePlayerProduction = MutablePlayerTotals & {
  playerId: string
  teamId: string | null
  population: PlayerSeasonProduction["population"]
  gamesScheduled: number
  teamSplits: Record<string, MutablePlayerTotals>
}

type MutableTeamProduction = {
  teamId: string
  gamesPlayed: number
  wins: number
  losses: number
  points: number
  opponentPoints: number
  possessions: number
  opponentPossessions: number
  fieldGoalsMade: number
  fieldGoalsAttempted: number
  threePointersMade: number
  threePointersAttempted: number
  freeThrowsMade: number
  freeThrowsAttempted: number
  rebounds: number
  assists: number
  turnovers: number
  steals: number
  blocks: number
  fouls: number
}

function createPlayerProduction(
  player: PlayerEntity,
  gamesPerTeam: number,
  freeAgentIds: Set<string>,
  draftProspectIds: Set<string>
): MutablePlayerProduction {
  const teamId =
    player.leagueStatus.kind === "rostered" ? player.leagueStatus.teamId : null
  return {
    playerId: player.id,
    teamId,
    population: populationFor(player.id, freeAgentIds, draftProspectIds),
    gamesScheduled: teamId ? gamesPerTeam : 0,
    teamSplits: {},
    ...createPlayerTotals(),
  }
}

function createPlayerTotals(): MutablePlayerTotals {
  return {
    gamesPlayed: 0,
    starts: 0,
    minutes: 0,
    opportunities: 0,
    usageWeighted: 0,
    usageWeight: 0,
    points: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    rebounds: 0,
    assists: 0,
    turnovers: 0,
    steals: 0,
    blocks: 0,
    fouls: 0,
    shotProfile: {
      rimAttempts: 0,
      midrangeAttempts: 0,
      threePointAttempts: 0,
    },
    roleMinutes: {},
  }
}

function createTeamProduction(teamId: string): MutableTeamProduction {
  return {
    teamId,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    points: 0,
    opponentPoints: 0,
    possessions: 0,
    opponentPossessions: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    rebounds: 0,
    assists: 0,
    turnovers: 0,
    steals: 0,
    blocks: 0,
    fouls: 0,
  }
}

function applyPlayerBoxScore(
  target: MutablePlayerTotals,
  player: GamePlayerBoxScore
): void {
  if (player.minutes <= 0) return
  target.gamesPlayed += 1
  if (player.starter) target.starts += 1
  target.minutes += player.minutes
  target.opportunities += player.opportunities
  target.usageWeighted += player.usageRate * player.minutes
  target.usageWeight += player.minutes
  target.points += player.points
  target.fieldGoalsMade += player.fieldGoalsMade
  target.fieldGoalsAttempted += player.fieldGoalsAttempted
  target.threePointersMade += player.threePointersMade
  target.threePointersAttempted += player.threePointersAttempted
  target.freeThrowsMade += player.freeThrowsMade
  target.freeThrowsAttempted += player.freeThrowsAttempted
  target.offensiveRebounds += player.offensiveRebounds
  target.defensiveRebounds += player.defensiveRebounds
  target.rebounds += player.rebounds
  target.assists += player.assists
  target.turnovers += player.turnovers
  target.steals += player.steals
  target.blocks += player.blocks
  target.fouls += player.fouls
  target.shotProfile.rimAttempts += player.shotProfile.rimAttempts
  target.shotProfile.midrangeAttempts += player.shotProfile.midrangeAttempts
  target.shotProfile.threePointAttempts += player.shotProfile.threePointAttempts
  target.roleMinutes[player.role.label] =
    (target.roleMinutes[player.role.label] ?? 0) + player.minutes
}

function applyTeamBoxScore(
  target: MutableTeamProduction,
  team: GameTeamBoxScore,
  opponent: GameTeamBoxScore,
  winnerTeamId: string | null
): void {
  target.gamesPlayed += 1
  if (winnerTeamId === target.teamId) target.wins += 1
  else target.losses += 1
  target.points += team.points
  target.opponentPoints += opponent.points
  target.possessions += team.possessions
  target.opponentPossessions += opponent.possessions
  target.fieldGoalsMade += team.fieldGoalsMade
  target.fieldGoalsAttempted += team.fieldGoalsAttempted
  target.threePointersMade += team.threePointersMade
  target.threePointersAttempted += team.threePointersAttempted
  target.freeThrowsMade += team.freeThrowsMade
  target.freeThrowsAttempted += team.freeThrowsAttempted
  target.rebounds += team.rebounds
  target.assists += team.assists
  target.turnovers += team.turnovers
  target.steals += team.steals
  target.blocks += team.blocks
  target.fouls += team.fouls
}

function finalizePlayerProduction(
  target: MutablePlayerProduction
): PlayerSeasonProduction {
  const role =
    Object.entries(target.roleMinutes).sort(
      (left, right) => right[1] - left[1]
    )[0]?.[0] ?? "Projected"
  return {
    playerId: target.playerId,
    teamId: target.teamId,
    population: target.population,
    gamesScheduled: target.gamesScheduled,
    gamesPlayed: target.gamesPlayed,
    starts: target.starts,
    minutes: round(target.minutes),
    opportunities: target.opportunities,
    usageRate:
      target.usageWeight > 0
        ? round(target.usageWeighted / target.usageWeight)
        : 0,
    points: target.points,
    pointsPerGame: safePerGame(target.points, target.gamesPlayed),
    fieldGoalsMade: target.fieldGoalsMade,
    fieldGoalsAttempted: target.fieldGoalsAttempted,
    threePointersMade: target.threePointersMade,
    threePointersAttempted: target.threePointersAttempted,
    freeThrowsMade: target.freeThrowsMade,
    freeThrowsAttempted: target.freeThrowsAttempted,
    trueShootingPercentage: safeRate(
      target.points,
      2 * (target.fieldGoalsAttempted + 0.44 * target.freeThrowsAttempted)
    ),
    offensiveRebounds: target.offensiveRebounds,
    defensiveRebounds: target.defensiveRebounds,
    rebounds: target.rebounds,
    reboundsPerGame: safePerGame(target.rebounds, target.gamesPlayed),
    assists: target.assists,
    assistsPerGame: safePerGame(target.assists, target.gamesPlayed),
    turnovers: target.turnovers,
    turnoversPerGame: safePerGame(target.turnovers, target.gamesPlayed),
    steals: target.steals,
    blocks: target.blocks,
    fouls: target.fouls,
    availabilityRate: safeRate(target.gamesPlayed, target.gamesScheduled),
    shotProfile: target.shotProfile,
    role,
    sampleState: sampleState(target.gamesPlayed, target.gamesScheduled),
  }
}

function finalizeTeamProduction(
  target: MutableTeamProduction
): TeamSeasonProduction {
  return {
    teamId: target.teamId,
    gamesPlayed: target.gamesPlayed,
    wins: target.wins,
    losses: target.losses,
    points: target.points,
    opponentPoints: target.opponentPoints,
    possessions: target.possessions,
    opponentPossessions: target.opponentPossessions,
    pace: safePerGame(target.possessions, target.gamesPlayed),
    offensiveEfficiency: safeRate(target.points, target.possessions),
    defensiveEfficiency: safeRate(
      target.opponentPoints,
      target.opponentPossessions
    ),
    fieldGoalsMade: target.fieldGoalsMade,
    fieldGoalsAttempted: target.fieldGoalsAttempted,
    threePointersMade: target.threePointersMade,
    threePointersAttempted: target.threePointersAttempted,
    freeThrowsMade: target.freeThrowsMade,
    freeThrowsAttempted: target.freeThrowsAttempted,
    rebounds: target.rebounds,
    assists: target.assists,
    turnovers: target.turnovers,
    steals: target.steals,
    blocks: target.blocks,
    fouls: target.fouls,
  }
}

export type ProductionAggregation = {
  players: Record<string, PlayerSeasonProduction>
  teams: Record<string, TeamSeasonProduction>
  league: LeagueProductionSummary
}

export function aggregateSeasonProduction(
  fixture: SeasonFixture,
  games: GameResult[],
  gamesPerTeam: number
): ProductionAggregation {
  const freeAgentIds = new Set(fixture.populations.freeAgents)
  const draftProspectIds = new Set(fixture.populations.draftProspects)
  const players = Object.fromEntries(
    Object.values(fixture.players).map((player) => [
      player.id,
      createPlayerProduction(
        player,
        player.leagueStatus.kind === "rostered" ? gamesPerTeam : 0,
        freeAgentIds,
        draftProspectIds
      ),
    ])
  ) as Record<string, MutablePlayerProduction>
  const teams = Object.fromEntries(
    Object.keys(fixture.teams).map((teamId) => [
      teamId,
      createTeamProduction(teamId),
    ])
  ) as Record<string, MutableTeamProduction>
  let injuries = 0
  let reconciled = 0
  let completedGames = 0

  for (const result of games) {
    if (result.status !== "completed") continue
    completedGames += 1
    if (result.reconciliation.passed) reconciled += 1
    injuries += result.events.length
    const home = result.teams[result.homeTeamId]
    const away = result.teams[result.awayTeamId]
    if (!home || !away) continue
    applyTeamBoxScore(
      teams[result.homeTeamId]!,
      home,
      away,
      result.winnerTeamId
    )
    applyTeamBoxScore(
      teams[result.awayTeamId]!,
      away,
      home,
      result.winnerTeamId
    )
    for (const player of Object.values(result.players)) {
      const target = players[player.playerId]
      if (target) applyPlayerBoxScore(target, player)
    }
  }

  const finalizedPlayers = Object.fromEntries(
    Object.values(players).map((player) => [
      player.playerId,
      finalizePlayerProduction(player),
    ])
  )
  const finalizedTeams = Object.fromEntries(
    Object.values(teams).map((team) => [
      team.teamId,
      finalizeTeamProduction(team),
    ])
  )
  const finalizedTeamValues = Object.values(finalizedTeams)
  const teamCount = Object.keys(fixture.teams).length
  const totalTeamGames = finalizedTeamValues.reduce(
    (sum, team) => sum + team.gamesPlayed,
    0
  )
  const totalPoints = finalizedTeamValues.reduce(
    (sum, team) => sum + team.points,
    0
  )
  const totalPossessions = finalizedTeamValues.reduce(
    (sum, team) => sum + team.possessions,
    0
  )
  const totalFga = finalizedTeamValues.reduce(
    (sum, team) => sum + team.fieldGoalsAttempted,
    0
  )
  const totalFgm = finalizedTeamValues.reduce(
    (sum, team) => sum + team.fieldGoalsMade,
    0
  )
  const total3pa = finalizedTeamValues.reduce(
    (sum, team) => sum + team.threePointersAttempted,
    0
  )
  const totalFta = finalizedTeamValues.reduce(
    (sum, team) => sum + team.freeThrowsAttempted,
    0
  )
  const totalAst = finalizedTeamValues.reduce(
    (sum, team) => sum + team.assists,
    0
  )
  const totalTo = finalizedTeamValues.reduce(
    (sum, team) => sum + team.turnovers,
    0
  )
  const totalReb = finalizedTeamValues.reduce(
    (sum, team) => sum + team.rebounds,
    0
  )
  return {
    players: finalizedPlayers,
    teams: finalizedTeams,
    league: {
      gamesCompleted: completedGames,
      gamesPerTeam,
      teamCount,
      pointsPerGame: safePerGame(totalPoints, totalTeamGames),
      possessionsPerTeam: safePerGame(totalPossessions, totalTeamGames),
      offensiveEfficiency: safeRate(totalPoints, totalPossessions),
      fieldGoalPercentage: safeRate(totalFgm, totalFga),
      threePointPercentage: safeRate(
        finalizedTeamValues.reduce(
          (sum, team) => sum + team.threePointersMade,
          0
        ),
        total3pa
      ),
      freeThrowPercentage: safeRate(
        finalizedTeamValues.reduce((sum, team) => sum + team.freeThrowsMade, 0),
        totalFta
      ),
      threePointAttemptRate: safeRate(total3pa, totalFga),
      assistsPerTeam: safePerGame(totalAst, totalTeamGames),
      turnoversPerTeam: safePerGame(totalTo, totalTeamGames),
      reboundsPerTeam: safePerGame(totalReb, totalTeamGames),
      injuries,
      reconciliationPassRate: safeRate(reconciled, completedGames),
    },
  }
}
