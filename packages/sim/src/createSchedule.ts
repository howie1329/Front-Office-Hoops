import {
  MINI_PRESEASON_GAMES_PER_TEAM,
  NBA_GAMES_PER_TEAM,
  NBA_TOTAL_GAMES,
  PRESEASON_GAMES_PER_TEAM,
  SIX_TEAM_GAMES_PER_TEAM,
  TEAMS_PER_DIVISION,
} from "@workspace/shared/constants"
import type {
  GameType,
  Rng,
  ScheduleConfig,
  ScheduleGame,
  TeamWithRoster,
} from "@workspace/shared/types"

import {
  getRegularSeasonStartDay,
  getSeasonMilestones,
  resolvePreseasonLength,
  resolveRegularSeasonLength,
} from "./calendar"
import {
  assignGamesToDays,
  type PairMatchup,
} from "./schedule/assignGamesToDays"

function buildDoubleRoundRobinMatchups(teamIds: string[]): PairMatchup[] {
  const matchups: PairMatchup[] = []

  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      const teamA = teamIds[i]!
      const teamB = teamIds[j]!
      matchups.push({ homeTeamId: teamA, awayTeamId: teamB })
      matchups.push({ homeTeamId: teamB, awayTeamId: teamA })
    }
  }

  return matchups
}

function pairKey(teamAId: string, teamBId: string): string {
  return teamAId < teamBId ? `${teamAId}:${teamBId}` : `${teamBId}:${teamAId}`
}

function expandHomeAwayGames(
  teamAId: string,
  teamBId: string,
  gamesBetween: number,
): PairMatchup[] {
  const matchups: PairMatchup[] = []

  if (gamesBetween === 4) {
    matchups.push(
      { homeTeamId: teamAId, awayTeamId: teamBId },
      { homeTeamId: teamAId, awayTeamId: teamBId },
      { homeTeamId: teamBId, awayTeamId: teamAId },
      { homeTeamId: teamBId, awayTeamId: teamAId },
    )
    return matchups
  }

  if (gamesBetween === 3) {
    const primaryHome = teamAId < teamBId ? teamAId : teamBId
    const secondaryHome = teamAId < teamBId ? teamBId : teamAId

    matchups.push(
      { homeTeamId: primaryHome, awayTeamId: secondaryHome },
      { homeTeamId: primaryHome, awayTeamId: secondaryHome },
      { homeTeamId: secondaryHome, awayTeamId: primaryHome },
    )
    return matchups
  }

  if (gamesBetween === 2) {
    matchups.push(
      { homeTeamId: teamAId, awayTeamId: teamBId },
      { homeTeamId: teamBId, awayTeamId: teamAId },
    )
    return matchups
  }

  throw new Error(`Unsupported gamesBetween value: ${gamesBetween}`)
}

function getDivisionTeams(
  teams: TeamWithRoster[],
  conferenceId: string,
  divisionId: string,
): TeamWithRoster[] {
  return teams
    .filter(
      (team) =>
        team.conferenceId === conferenceId && team.divisionId === divisionId,
    )
    .sort((a, b) => a.id.localeCompare(b.id))
}

function getDivisionIndex(
  team: TeamWithRoster,
  teams: TeamWithRoster[],
): number {
  const divisionTeams = getDivisionTeams(
    teams,
    team.conferenceId!,
    team.divisionId!,
  )
  const index = divisionTeams.findIndex((entry) => entry.id === team.id)

  if (index < 0) {
    throw new Error(`Failed to resolve division index for ${team.id}`)
  }

  return index
}

function crossDivisionGames(
  teamA: TeamWithRoster,
  teamB: TeamWithRoster,
  teams: TeamWithRoster[],
): number {
  const indexA = getDivisionIndex(teamA, teams)
  const indexB = getDivisionIndex(teamB, teams)

  return (indexA + indexB) % TEAMS_PER_DIVISION < 3 ? 4 : 3
}

function buildNbaMatchupCounts(teams: TeamWithRoster[]): Map<string, number> {
  const matchupCounts = new Map<string, number>()

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const teamA = teams[i]!
      const teamB = teams[j]!
      const key = pairKey(teamA.id, teamB.id)

      if (
        teamA.conferenceId === teamB.conferenceId &&
        teamA.divisionId === teamB.divisionId
      ) {
        matchupCounts.set(key, 4)
      } else if (teamA.conferenceId !== teamB.conferenceId) {
        matchupCounts.set(key, 2)
      } else {
        matchupCounts.set(key, crossDivisionGames(teamA, teamB, teams))
      }
    }
  }

  return matchupCounts
}

function buildNbaMatchups(teams: TeamWithRoster[]): PairMatchup[] {
  const matchupCounts = buildNbaMatchupCounts(teams)
  const matchups: PairMatchup[] = []

  for (const [key, gamesBetween] of matchupCounts.entries()) {
    const [teamAId, teamBId] = key.split(":")
    matchups.push(...expandHomeAwayGames(teamAId!, teamBId!, gamesBetween))
  }

  return matchups
}

function countTeamGames(matchups: PairMatchup[], teamId: string): number {
  return matchups.filter(
    (game) => game.homeTeamId === teamId || game.awayTeamId === teamId,
  ).length
}

function shuffleMatchups(matchups: PairMatchup[], rng: Rng): PairMatchup[] {
  const shuffled = [...matchups]

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    const temp = shuffled[i]!
    shuffled[i] = shuffled[j]!
    shuffled[j] = temp
  }

  return shuffled
}

function buildExhibitionMatchups(
  teamIds: string[],
  gamesPerTeam: number,
): PairMatchup[] {
  const rotatingTeams = [...teamIds]
  if (rotatingTeams.length % 2 === 1) {
    rotatingTeams.push(`bye_${rotatingTeams.length}`)
  }

  const matchups: PairMatchup[] = []

  for (let round = 0; round < gamesPerTeam; round++) {
    for (let index = 0; index < rotatingTeams.length / 2; index++) {
      const first = rotatingTeams[index]!
      const second = rotatingTeams[rotatingTeams.length - 1 - index]!

      if (first.startsWith("bye_") || second.startsWith("bye_")) {
        continue
      }

      matchups.push(
        round % 2 === 0
          ? { homeTeamId: first, awayTeamId: second }
          : { homeTeamId: second, awayTeamId: first },
      )
    }

    const anchor = rotatingTeams[0]!
    const rest = rotatingTeams.slice(1)
    const last = rest.pop()
    if (last) {
      rest.unshift(last)
    }
    rotatingTeams.splice(0, rotatingTeams.length, anchor, ...rest)
  }

  const targetGames = (teamIds.length * gamesPerTeam) / 2
  if (matchups.length !== targetGames) {
    throw new Error(
      `Failed to build exhibition schedule: expected ${targetGames} games, got ${matchups.length}`,
    )
  }

  return matchups
}

function shuffleMatchupsWithDays(
  matchups: PairMatchup[],
  days: number[],
  rng: Rng,
): { matchups: PairMatchup[]; days: number[] } {
  const indices = matchups.map((_, index) => index)

  for (let i = indices.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    const temp = indices[i]!
    indices[i] = indices[j]!
    indices[j] = temp
  }

  return {
    matchups: indices.map((index) => matchups[index]!),
    days: indices.map((index) => days[index]!),
  }
}

function toScheduleGames(
  matchups: PairMatchup[],
  days: number[],
  config: ScheduleConfig,
  gameType: GameType,
  idPrefix: string,
): ScheduleGame[] {
  return matchups.map((matchup, index) => ({
    id: `${idPrefix}_${config.season}_${String(index + 1).padStart(4, "0")}`,
    season: config.season,
    day: days[index] ?? days.at(-1) ?? 1,
    homeTeamId: matchup.homeTeamId,
    awayTeamId: matchup.awayTeamId,
    status: "scheduled" as const,
    gameType,
  }))
}

function createSixTeamDoubleRoundRobin(
  config: ScheduleConfig,
  rng: Rng,
  gameType: GameType,
): ScheduleGame[] {
  const teamIds = config.teams.map((team) => team.id)
  const matchups = shuffleMatchups(buildDoubleRoundRobinMatchups(teamIds), rng)
  const regularStartDay = getRegularSeasonStartDay(config.teams.length)
  const days = assignGamesToDays(matchups, {
    startDay: gameType === "exhibition" ? 1 : regularStartDay,
    endDay:
      (gameType === "exhibition" ? 1 : regularStartDay) +
      config.seasonLengthDays -
      1,
    rng,
  })

  return toScheduleGames(
    matchups,
    days,
    config,
    gameType,
    gameType === "exhibition" ? "ex" : "sg",
  )
}

function createThirtyTeamEightyTwoSchedule(
  config: ScheduleConfig,
  rng: Rng,
  gameType: GameType,
): ScheduleGame[] {
  const matchups = shuffleMatchups(buildNbaMatchups(config.teams), rng)

  for (const team of config.teams) {
    const games = countTeamGames(matchups, team.id)
    if (games !== NBA_GAMES_PER_TEAM) {
      throw new Error(
        `Team ${team.id} scheduled for ${games} games, expected ${NBA_GAMES_PER_TEAM}`,
      )
    }
  }

  if (matchups.length !== NBA_TOTAL_GAMES) {
    throw new Error(
      `Schedule has ${matchups.length} games, expected ${NBA_TOTAL_GAMES}`,
    )
  }

  const regularStartDay = getRegularSeasonStartDay(config.teams.length)
  const days = assignGamesToDays(matchups, {
    startDay: gameType === "exhibition" ? 1 : regularStartDay,
    endDay:
      (gameType === "exhibition" ? 1 : regularStartDay) +
      config.seasonLengthDays -
      1,
    rng,
  })

  return toScheduleGames(
    matchups,
    days,
    config,
    gameType,
    gameType === "exhibition" ? "ex" : "sg",
  )
}

export function createPreseasonSchedule(
  config: ScheduleConfig,
  rng: Rng,
): ScheduleGame[] {
  const teamIds = config.teams.map((team) => team.id)
  const gamesPerTeam =
    config.teams.length === 6
      ? MINI_PRESEASON_GAMES_PER_TEAM
      : PRESEASON_GAMES_PER_TEAM
  const matchups = buildExhibitionMatchups(teamIds, gamesPerTeam)
  const gamesPerRound = teamIds.length / 2
  const orderedDays = matchups.map(
    (_, index) => 1 + Math.floor(index / gamesPerRound),
  )
  const shuffled = shuffleMatchupsWithDays(matchups, orderedDays, rng)

  return toScheduleGames(
    shuffled.matchups,
    shuffled.days,
    config,
    "exhibition",
    "ex",
  )
}

export function createRegularSchedule(
  config: ScheduleConfig,
  rng: Rng,
): ScheduleGame[] {
  if (config.teams.length === 30 && config.gamesPerTeam === NBA_GAMES_PER_TEAM) {
    return createThirtyTeamEightyTwoSchedule(config, rng, "regular")
  }

  if (config.teams.length === 6 && config.gamesPerTeam === SIX_TEAM_GAMES_PER_TEAM) {
    return createSixTeamDoubleRoundRobin(config, rng, "regular")
  }

  throw new Error(
    `Unsupported schedule config: ${config.teams.length} teams, ${config.gamesPerTeam} games per team`,
  )
}

export function createSchedule(
  config: ScheduleConfig,
  rng: Rng,
): ScheduleGame[] {
  const preseasonConfig = {
    ...config,
    seasonLengthDays: resolvePreseasonLength(config.teams.length),
  }
  const regularConfig = {
    ...config,
    seasonLengthDays: resolveRegularSeasonLength(config.teams.length),
  }

  return [
    ...createPreseasonSchedule(preseasonConfig, rng),
    ...createRegularSchedule(regularConfig, rng),
  ]
}

export function getScheduleMilestones(teamCount: number) {
  return getSeasonMilestones(
    resolveRegularSeasonLength(teamCount),
    resolvePreseasonLength(teamCount),
  )
}

// Re-export for tests
export { buildDoubleRoundRobinMatchups, countTeamGames }
