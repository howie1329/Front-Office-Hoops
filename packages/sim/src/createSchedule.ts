import {
  NBA_GAMES_PER_TEAM,
  NBA_TOTAL_GAMES,
  SIX_TEAM_GAMES_PER_TEAM,
  TEAMS_PER_DIVISION,
} from "@workspace/shared/constants"
import type { Rng, ScheduleConfig, ScheduleGame, TeamWithRoster } from "@workspace/shared/types"

type PairMatchup = {
  homeTeamId: string
  awayTeamId: string
}

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

function assignDays(gameCount: number, seasonLengthDays: number): number[] {
  const days: number[] = []
  let day = 1
  let gamesOnDay = 0

  for (let i = 0; i < gameCount; i++) {
    days.push(day)
    gamesOnDay += 1

    const remainingDays = seasonLengthDays - day

    if (remainingDays <= 0) {
      continue
    }

    const targetGamesPerDay = Math.ceil((gameCount - i - 1) / remainingDays)
    if (gamesOnDay >= targetGamesPerDay && day < seasonLengthDays) {
      day += 1
      gamesOnDay = 0
    }
  }

  return days
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
    const primaryHome =
      teamAId < teamBId ? teamAId : teamBId
    const secondaryHome =
      teamAId < teamBId ? teamBId : teamAId

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

function createSixTeamDoubleRoundRobin(
  config: ScheduleConfig,
  rng: Rng,
): ScheduleGame[] {
  const teamIds = config.teams.map((team) => team.id)
  const matchups = shuffleMatchups(buildDoubleRoundRobinMatchups(teamIds), rng)
  const days = assignDays(matchups.length, config.seasonLengthDays)

  return matchups.map((matchup, index) => ({
    id: `sg_${config.season}_${String(index + 1).padStart(3, "0")}`,
    season: config.season,
    day: days[index] ?? config.seasonLengthDays,
    homeTeamId: matchup.homeTeamId,
    awayTeamId: matchup.awayTeamId,
    status: "scheduled" as const,
  }))
}

function createThirtyTeamEightyTwoSchedule(
  config: ScheduleConfig,
  rng: Rng,
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

  const days = assignDays(matchups.length, config.seasonLengthDays)

  return matchups.map((matchup, index) => ({
    id: `sg_${config.season}_${String(index + 1).padStart(4, "0")}`,
    season: config.season,
    day: days[index] ?? config.seasonLengthDays,
    homeTeamId: matchup.homeTeamId,
    awayTeamId: matchup.awayTeamId,
    status: "scheduled" as const,
  }))
}

export function createSchedule(
  config: ScheduleConfig,
  rng: Rng,
): ScheduleGame[] {
  if (config.teams.length === 30 && config.gamesPerTeam === NBA_GAMES_PER_TEAM) {
    return createThirtyTeamEightyTwoSchedule(config, rng)
  }

  if (config.teams.length === 6 && config.gamesPerTeam === SIX_TEAM_GAMES_PER_TEAM) {
    return createSixTeamDoubleRoundRobin(config, rng)
  }

  throw new Error(
    `Unsupported schedule config: ${config.teams.length} teams, ${config.gamesPerTeam} games per team`,
  )
}
