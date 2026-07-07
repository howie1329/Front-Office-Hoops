import { CAMP_EXTRA_PLAYERS } from "@workspace/shared/constants"
import type { Player, Rng, TeamWithRoster } from "@workspace/shared/types"

import { generatePlayerProfile, potentialGapForAge } from "../playerGeneration/generatePlayerProfile"
import { finalizeRosterUsage } from "../playerGeneration/rosterPipeline"
import { computeAiCutScore, validateRosterFloor } from "../roster/rosterManagement"
import type { PlayerPosition } from "@workspace/shared/types"

const CAMP_POSITIONS: PlayerPosition[] = [
  "SG",
  "SF",
  "PF",
  "C",
  "PG",
  "SF",
]

function buildCampPlayer(
  team: TeamWithRoster,
  index: number,
  season: number,
  rng: Rng,
  usedNames: Set<string>,
): Player {
  const position = CAMP_POSITIONS[index % CAMP_POSITIONS.length]!
  const age = rng.int(20, 24)
  const profile = generatePlayerProfile({
    age,
    targetOverall: rng.int(44, 58),
    position,
    rng,
    usedNames,
    potentialGap: potentialGapForAge(age, rng),
    usageIndex: team.players.length + index,
    skillVariance: { min: -4, max: 4 },
  })

  return {
    id: `p_${team.abbrev.toLowerCase()}_camp_s${season}_${String(index + 1).padStart(2, "0")}`,
    teamId: team.id,
    firstName: profile.firstName,
    lastName: profile.lastName,
    age: profile.age,
    peakAge: profile.peakAge,
    heightInches: profile.heightInches,
    weightLbs: profile.weightLbs,
    position: profile.position,
    archetype: profile.archetype,
    ratings: profile.ratings,
    tags: [...(profile.tags ?? []), "camp_invite"],
    status: "active",
    injury: null,
    draftInfo: null,
    activeContractId: null,
    seasonsWithTeam: 0,
    yearsOfService: profile.yearsOfService,
  }
}

export function addCampPlayersToTeams(
  teams: TeamWithRoster[],
  rng: Rng,
  season: number,
  extraPlayers = CAMP_EXTRA_PLAYERS,
): TeamWithRoster[] {
  return teams.map((team) => {
    const usedNames = new Set(
      team.players.map((player) => `${player.firstName} ${player.lastName}`),
    )
    const campPlayers = Array.from({ length: extraPlayers }, (_, index) =>
      buildCampPlayer(team, index, season, rng, usedNames),
    )

    return {
      ...team,
      players: finalizeRosterUsage([...team.players, ...campPlayers]),
    }
  })
}

function selectCampTrimCandidate(players: Player[]): Player {
  const sorted = [...players].sort((a, b) => {
    const campDiff =
      Number(b.tags?.includes("camp_invite") ?? 0) -
      Number(a.tags?.includes("camp_invite") ?? 0)
    if (campDiff !== 0) {
      return campDiff
    }

    return computeAiCutScore(b, players) - computeAiCutScore(a, players)
  })

  const candidate = sorted.find((player) => {
    const remaining = players.filter((entry) => entry.id !== player.id)
    return validateRosterFloor(remaining).ok
  })

  if (!candidate) {
    throw new Error("No player available to cut without violating roster rules")
  }

  return candidate
}

export function trimTeamsToRegularRoster(
  teams: TeamWithRoster[],
  rosterMax: number,
  _rng: Rng,
  protectedTeamId?: string | null,
): TeamWithRoster[] {
  return teams.map((team) => {
    if (team.players.length <= rosterMax) {
      return team
    }

    if (team.id === protectedTeamId) {
      return team
    }

    let players = [...team.players]
    while (players.length > rosterMax) {
      const cutCandidate = selectCampTrimCandidate(players)
      players = players.filter((player) => player.id !== cutCandidate.id)
    }

    return {
      ...team,
      players: finalizeRosterUsage(players),
    }
  })
}
