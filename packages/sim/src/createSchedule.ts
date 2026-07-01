import type { Rng, ScheduleConfig, ScheduleGame } from "@workspace/shared/types"

type PairMatchup = {
  homeTeamId: string
  awayTeamId: string
}

function buildDoubleRoundRobinMatchups(
  teamIds: string[],
): PairMatchup[] {
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

export function createSchedule(
  config: ScheduleConfig,
  rng: Rng,
): ScheduleGame[] {
  if (config.gamesPerTeam === 82 && config.teams.length === 30) {
    throw new Error("82-game schedule for 30 teams is not implemented yet")
  }

  if (config.teams.length === 6 && config.gamesPerTeam === 10) {
    return createSixTeamDoubleRoundRobin(config, rng)
  }

  throw new Error(
    `Unsupported schedule config: ${config.teams.length} teams, ${config.gamesPerTeam} games per team`,
  )
}
