import {
  LEAGUE_TEAM_COUNT,
  MAX_OVERALL,
  MIN_OVERALL,
} from "@workspace/shared/constants"
import type { Rng, Team, TeamWithRoster } from "@workspace/shared/types"

import { generateLeagueRostersFromArchetypes } from "./leagueRosterGeneration"
import { CITIES, CONFERENCES, NICKNAMES } from "./teamPools"

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
}

function makeAbbrev(city: string, nickname: string, used: Set<string>): string {
  const cityPart = city.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase()
  const nickPart = nickname.replace(/[^A-Za-z]/g, "").slice(0, 1).toUpperCase()
  let abbrev = `${cityPart}${nickPart}`

  if (used.has(abbrev)) {
    abbrev = city.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase()
  }

  if (used.has(abbrev)) {
    let suffix = 2
    while (used.has(`${abbrev}${suffix}`)) {
      suffix += 1
    }
    abbrev = `${abbrev}${suffix}`
  }

  used.add(abbrev)
  return abbrev
}

function buildTeamBase(
  city: string,
  nickname: string,
  conferenceId: string,
  divisionId: string,
  index: number,
  usedAbbrevs: Set<string>,
): Team {
  const name = `${city} ${nickname}`
  const id = `t_${slugify(city)}_${slugify(nickname)}`
  const overallSpread =
    MIN_OVERALL +
    Math.floor(((MAX_OVERALL - MIN_OVERALL) * index) / LEAGUE_TEAM_COUNT)
  const overall = Math.min(
    MAX_OVERALL,
    Math.max(MIN_OVERALL, overallSpread + (index % 3) - 1),
  )

  return {
    id,
    name,
    abbrev: makeAbbrev(city, nickname, usedAbbrevs),
    overall,
    conferenceId,
    divisionId,
  }
}

export function generateTeams(rng: Rng, count = LEAGUE_TEAM_COUNT): Team[] {
  if (count !== LEAGUE_TEAM_COUNT) {
    throw new Error(`generateTeams currently supports ${LEAGUE_TEAM_COUNT} teams`)
  }

  const cityPool = [...CITIES]
  const nicknamePool = [...NICKNAMES]
  const usedAbbrevs = new Set<string>()
  const teams: Team[] = []
  let index = 0

  for (const conference of CONFERENCES) {
    for (const divisionId of conference.divisions) {
      for (let slot = 0; slot < 5; slot++) {
        const cityIndex = rng.int(0, cityPool.length - 1)
        const nicknameIndex = rng.int(0, nicknamePool.length - 1)
        const city = cityPool.splice(cityIndex, 1)[0]!
        const nickname = nicknamePool.splice(nicknameIndex, 1)[0]!

        teams.push(
          buildTeamBase(
            city,
            nickname,
            conference.id,
            divisionId,
            index,
            usedAbbrevs,
          ),
        )
        index += 1
      }
    }
  }

  return teams
}

export function generateLeagueRosters(rng: Rng): TeamWithRoster[] {
  return generateLeagueRostersFromArchetypes(generateTeams(rng), rng)
}
