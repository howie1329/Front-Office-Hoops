import type { Game, ScheduleGame, SeasonState } from "@workspace/shared/types"

export type TeamScheduleFatigue = {
  playedYesterday: boolean
  gamesLast3Days: number
  gamesLast7Days: number
  roadTripLength: number
  isHomeStand: boolean
}

function countRecentGames(
  teamId: string,
  schedule: ScheduleGame[],
  games: Game[],
  currentDay: number,
  windowDays: number,
): number {
  const playedDays = new Set<number>()

  for (const game of games) {
    if (
      game.day >= currentDay - windowDays &&
      game.day < currentDay &&
      (game.homeTeamId === teamId || game.awayTeamId === teamId)
    ) {
      playedDays.add(game.day)
    }
  }

  for (const entry of schedule) {
    if (
      entry.status === "final" &&
      entry.day >= currentDay - windowDays &&
      entry.day < currentDay &&
      (entry.homeTeamId === teamId || entry.awayTeamId === teamId)
    ) {
      playedDays.add(entry.day)
    }
  }

  return playedDays.size
}

function getRecentLocations(
  teamId: string,
  schedule: ScheduleGame[],
  games: Game[],
  currentDay: number,
): Array<"home" | "away"> {
  const events: Array<{ day: number; location: "home" | "away" }> = []

  for (const game of games) {
    if (game.day >= currentDay - 14 && game.day < currentDay) {
      events.push({
        day: game.day,
        location: game.homeTeamId === teamId ? "home" : "away",
      })
    }
  }

  for (const entry of schedule) {
    if (
      entry.status === "final" &&
      entry.day >= currentDay - 14 &&
      entry.day < currentDay
    ) {
      events.push({
        day: entry.day,
        location: entry.homeTeamId === teamId ? "home" : "away",
      })
    }
  }

  return events
    .sort((a, b) => a.day - b.day)
    .map((event) => event.location)
}

export function getTeamScheduleFatigue(
  teamId: string,
  state: SeasonState,
  day: number = state.currentDay,
): TeamScheduleFatigue {
  const gamesLast3Days = countRecentGames(
    teamId,
    state.schedule,
    state.games,
    day,
    3,
  )
  const gamesLast7Days = countRecentGames(
    teamId,
    state.schedule,
    state.games,
    day,
    7,
  )
  const playedYesterday =
    countRecentGames(teamId, state.schedule, state.games, day, 1) > 0

  const locations = getRecentLocations(
    teamId,
    state.schedule,
    state.games,
    day,
  )
  const lastLocation = locations.at(-1)
  let roadTripLength = 0
  let homeStandLength = 0

  for (let index = locations.length - 1; index >= 0; index--) {
    const location = locations[index]!
    if (location === "away") {
      if (homeStandLength > 0) {
        break
      }
      roadTripLength += 1
    } else {
      if (roadTripLength > 0) {
        break
      }
      homeStandLength += 1
    }
  }

  return {
    playedYesterday,
    gamesLast3Days,
    gamesLast7Days,
    roadTripLength: lastLocation === "away" ? roadTripLength : 0,
    isHomeStand: lastLocation === "home" && homeStandLength >= 3,
  }
}

export function getFatigueEfficiencyPenalty(
  fatigue: TeamScheduleFatigue,
  gameType: ScheduleGame["gameType"] = "regular",
): number {
  if (gameType === "exhibition") {
    return 0
  }

  let penalty = 0

  if (fatigue.playedYesterday) {
    penalty += 0.015
  }

  if (fatigue.gamesLast3Days >= 2) {
    penalty += 0.02
  }

  if (fatigue.roadTripLength >= 3) {
    penalty += 0.005 * (fatigue.roadTripLength - 2)
  }

  return penalty
}

export function getFatigueInjuryMultiplier(
  fatigue: TeamScheduleFatigue,
  gameType: ScheduleGame["gameType"] = "regular",
): number {
  if (gameType === "exhibition") {
    return 0.5
  }

  let multiplier = 1

  if (fatigue.playedYesterday) {
    multiplier *= 1.3
  }

  if (fatigue.gamesLast3Days >= 2) {
    multiplier *= 1.15
  }

  return multiplier
}

export function getFatigueStarterMinuteReduction(
  fatigue: TeamScheduleFatigue,
  gameType: ScheduleGame["gameType"] = "regular",
): number {
  if (gameType === "exhibition") {
    return 8
  }

  if (fatigue.playedYesterday) {
    return 10
  }

  if (fatigue.gamesLast3Days >= 2) {
    return 6
  }

  return 0
}

export function isBackToBack(
  teamId: string,
  state: SeasonState,
  day: number = state.currentDay,
): boolean {
  return getTeamScheduleFatigue(teamId, state, day).playedYesterday
}

export function isThreeInFour(
  teamId: string,
  state: SeasonState,
  day: number = state.currentDay,
): boolean {
  const fatigue = getTeamScheduleFatigue(teamId, state, day)
  return fatigue.gamesLast3Days >= 2
}
