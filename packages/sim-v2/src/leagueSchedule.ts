import type {
  LeagueCalendar,
  LeagueDivision,
  LeagueGameKind,
  LeagueScheduleEntry,
  LeagueStructure,
} from "@workspace/domain-v2"

import { createDeterministicRandom } from "./randomness"

export const STANDARD_CONFERENCES = [
  { id: "conference:east", name: "Eastern Conference" },
  { id: "conference:west", name: "Western Conference" },
] as const

const STANDARD_DIVISIONS = [
  {
    id: "division:atlantic",
    name: "Atlantic",
    conferenceId: "conference:east",
  },
  { id: "division:central", name: "Central", conferenceId: "conference:east" },
  {
    id: "division:southeast",
    name: "Southeast",
    conferenceId: "conference:east",
  },
  {
    id: "division:northwest",
    name: "Northwest",
    conferenceId: "conference:west",
  },
  { id: "division:pacific", name: "Pacific", conferenceId: "conference:west" },
  {
    id: "division:southwest",
    name: "Southwest",
    conferenceId: "conference:west",
  },
] as const

type UndirectedGame = { first: string; second: string }

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function pairKey(first: string, second: string): string {
  return [first, second].sort().join("|")
}

export function createStandardLeagueStructure(
  teamIds: string[]
): LeagueStructure {
  if (teamIds.length !== 30) {
    throw new Error("The standard league structure requires exactly 30 teams.")
  }

  const divisions: LeagueDivision[] = STANDARD_DIVISIONS.map(
    (division, index) => ({
      ...division,
      teamIds: teamIds.slice(index * 5, index * 5 + 5),
    })
  )

  return {
    conferences: STANDARD_CONFERENCES.map((conference) => ({
      ...conference,
      divisionIds: divisions
        .filter((division) => division.conferenceId === conference.id)
        .map((division) => division.id),
    })),
    divisions,
  }
}

function createRoundRobinRounds(
  teamIds: string[],
  rounds: number
): UndirectedGame[][] {
  const fixed = teamIds[0]!
  const rotating = teamIds.slice(1)
  const result: UndirectedGame[][] = []

  for (let round = 0; round < rounds; round += 1) {
    const ordered = [
      fixed,
      ...rotating.map(
        (_, index) => rotating[(index + round) % rotating.length]!
      ),
    ]
    result.push(
      Array.from({ length: ordered.length / 2 }, (_, pairIndex) => ({
        first: ordered[pairIndex]!,
        second: ordered[ordered.length - 1 - pairIndex]!,
      }))
    )
  }

  return result
}

function createPreseasonGames(teamIds: string[]): UndirectedGame[][] {
  return createRoundRobinRounds(teamIds, 6)
}

function createRegularSeasonGames(
  teamIds: string[],
  structure: LeagueStructure,
  seed: string
): UndirectedGame[][] {
  const rounds = createRoundRobinRounds(teamIds, 29)
  const games = rounds.flatMap((round) => [round, round])
  const teamToDivision = new Map(
    structure.divisions.flatMap((division) =>
      division.teamIds.map((teamId) => [teamId, division.id] as const)
    )
  )

  for (const division of structure.divisions) {
    for (let left = 0; left < division.teamIds.length; left += 1) {
      for (let right = left + 1; right < division.teamIds.length; right += 1) {
        for (let copy = 0; copy < 2; copy += 1) {
          games.push([
            {
              first: division.teamIds[left]!,
              second: division.teamIds[right]!,
            },
          ])
        }
      }
    }
  }

  for (const conference of structure.conferences) {
    const conferenceDivisions = conference.divisionIds.map((divisionId) =>
      structure.divisions.find((division) => division.id === divisionId)!
    )
    for (let left = 0; left < conferenceDivisions.length; left += 1) {
      for (
        let right = left + 1;
        right < conferenceDivisions.length;
        right += 1
      ) {
        const firstDivision = conferenceDivisions[left]!
        const secondDivision = conferenceDivisions[right]!
        for (let shift = 0; shift < 8; shift += 1) {
          for (
            let index = 0;
            index < firstDivision.teamIds.length;
            index += 1
          ) {
            games.push([
              {
                first: firstDivision.teamIds[index]!,
                second: secondDivision.teamIds[(index + shift) % 5]!,
              },
            ])
          }
        }
      }
    }
  }

  const extraGames = games.slice(58).flat()
  const regularRounds = colorGamesIntoRounds(
    [...games.slice(0, 58).flat(), ...extraGames],
    teamIds,
    `${seed}:regular-season`
  )
  const counts = new Map<string, number>()
  for (const round of regularRounds) {
    for (const game of round) {
      const key = pairKey(game.first, game.second)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  for (const first of teamIds) {
    for (const second of teamIds) {
      if (first >= second) continue
      const sameDivision =
        teamToDivision.get(first) === teamToDivision.get(second)
      if (sameDivision && counts.get(pairKey(first, second)) !== 4) {
        throw new Error("Regular-season division matchup count is invalid.")
      }
    }
  }
  return regularRounds
}

function colorGamesIntoRounds(
  games: UndirectedGame[],
  teamIds: string[],
  seed: string
): UndirectedGame[][] {
  const random = createDeterministicRandom(seed)
  const rounds = Array.from({ length: 174 }, () => [] as UndirectedGame[])
  const usedTeams = Array.from(
    { length: rounds.length },
    () => new Set<string>()
  )
  const shuffled = [...games]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = random.int(0, index)
    ;[shuffled[index], shuffled[swap]] = [shuffled[swap]!, shuffled[index]!]
  }
  for (const game of shuffled) {
    const roundIndex = usedTeams.findIndex(
      (teams) =>
        teams.size < teamIds.length &&
        !teams.has(game.first) &&
        !teams.has(game.second)
    )
    if (roundIndex < 0) {
      throw new Error("Could not create a date-valid regular-season schedule.")
    }
    rounds[roundIndex]!.push(game)
    usedTeams[roundIndex]!.add(game.first)
    usedTeams[roundIndex]!.add(game.second)
  }
  return rounds.filter((round) => round.length > 0)
}

function orientGames(
  rounds: UndirectedGame[][],
  teamIds: string[]
): UndirectedGame[][] {
  const edges = rounds.flat()
  const adjacency = new Map<string, number[]>()
  teamIds.forEach((teamId) => adjacency.set(teamId, []))
  edges.forEach((game, index) => {
    adjacency.get(game.first)!.push(index)
    adjacency.get(game.second)!.push(index)
  })

  const used = new Set<number>()
  const oriented = new Array<UndirectedGame | null>(edges.length).fill(null)
  for (const start of teamIds) {
    const stack: Array<{ teamId: string; incomingEdge: number | null }> = [
      { teamId: start, incomingEdge: null },
    ]
    const circuit: Array<{ teamId: string; incomingEdge: number | null }> = []
    while (stack.length > 0) {
      const current = stack.at(-1)!
      const edgeIndex = adjacency
        .get(current.teamId)!
        .find((index) => !used.has(index))
      if (edgeIndex === undefined) {
        circuit.push(stack.pop()!)
        continue
      }
      used.add(edgeIndex)
      const edge = edges[edgeIndex]!
      stack.push({
        teamId: edge.first === current.teamId ? edge.second : edge.first,
        incomingEdge: edgeIndex,
      })
    }
    const ordered = circuit.reverse()
    for (let index = 1; index < ordered.length; index += 1) {
      const edgeIndex = ordered[index]!.incomingEdge
      if (edgeIndex === null) continue
      oriented[edgeIndex] = {
        first: ordered[index - 1]!.teamId,
        second: ordered[index]!.teamId,
      }
    }
  }

  let offset = 0
  return rounds.map((round) => {
    const next = round.map((_, index) => oriented[offset + index]!)
    offset += round.length
    return next
  })
}

function toSchedule(
  rounds: UndirectedGame[][],
  kind: LeagueGameKind,
  startDate: Date,
  prefix: string,
  spacingDays: number,
  teamIds: string[]
): LeagueScheduleEntry[] {
  const oriented = orientGames(rounds, teamIds)
  return oriented.flatMap((round, roundIndex) => {
    const date = dateKey(addDays(startDate, roundIndex * spacingDays))
    return round.map((game, gameIndex) => ({
      id: `${prefix}:${String(roundIndex + 1).padStart(2, "0")}:${String(gameIndex + 1).padStart(2, "0")}`,
      date,
      kind,
      round: roundIndex + 1,
      homeTeamId: game.first,
      awayTeamId: game.second,
      status: "scheduled" as const,
    }))
  })
}

export function createLeagueCalendar(
  teamIds: string[],
  structure: LeagueStructure,
  seed: string,
  seasonStartYear: number
): LeagueCalendar {
  const preseasonStart = new Date(Date.UTC(seasonStartYear, 9, 1))
  const regularSeasonStart = new Date(Date.UTC(seasonStartYear, 9, 21))
  const regularSeasonEnd = new Date(Date.UTC(seasonStartYear + 1, 3, 12))
  const playoffsStart = new Date(Date.UTC(seasonStartYear + 1, 3, 18))
  const tradeDeadline = new Date(Date.UTC(seasonStartYear + 1, 1, 1))
  while (tradeDeadline.getUTCDay() !== 4)
    tradeDeadline.setUTCDate(tradeDeadline.getUTCDate() + 1)

  const preseason = toSchedule(
    createPreseasonGames(teamIds),
    "preseason",
    preseasonStart,
    "preseason-game",
    3,
    teamIds
  )
  const regularSeason = toSchedule(
    createRegularSeasonGames(teamIds, structure, seed),
    "regular-season",
    regularSeasonStart,
    "regular-season-game",
    1,
    teamIds
  )

  return {
    kind: "regular-season",
    currentDate: dateKey(regularSeasonStart),
    preseasonStart: dateKey(preseasonStart),
    regularSeasonStart: dateKey(regularSeasonStart),
    regularSeasonEnd: dateKey(regularSeasonEnd),
    milestones: {
      tradeDeadline: dateKey(tradeDeadline),
      playoffsStart: dateKey(playoffsStart),
    },
    schedule: [...preseason, ...regularSeason],
  }
}
