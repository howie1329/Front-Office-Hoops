import { CAMP_EXTRA_PLAYERS } from "@workspace/shared/constants"
import type { LeagueRecord, Player, Rng, TeamWithRoster } from "@workspace/shared/types"

import { waiveContract } from "../financials/contracts/createContract"
import { generatePlayerProfile } from "../playerGeneration/generatePlayerProfile"
import { finalizeRosterUsage } from "../playerGeneration/rosterPipeline"
import { deriveTeamOverall } from "../playerRatings"
import { seedPlayerMood } from "../playerValue/moodSeed"
import { computeAiCutScore, validateRosterFloor } from "../roster/rosterManagement"
import type { PlayerPosition } from "@workspace/shared/types"

export function isCampPlayerForSeason(playerId: string, season: number): boolean {
  return playerId.includes(`_camp_s${season}_`)
}

export function purgeCampFringePlayers(
  league: Pick<LeagueRecord, "seasonState" | "contracts" | "freeAgentPool">,
  season: number,
): Pick<LeagueRecord, "seasonState" | "contracts" | "freeAgentPool"> {
  const campPlayerIds = new Set<string>()

  for (const player of league.freeAgentPool) {
    if (player.tags?.includes("camp_invite")) {
      campPlayerIds.add(player.id)
    }
  }

  for (const team of league.seasonState.teams) {
    for (const player of team.players) {
      if (
        player.tags?.includes("camp_invite") &&
        !isCampPlayerForSeason(player.id, season)
      ) {
        campPlayerIds.add(player.id)
      }
    }
  }

  const contracts = league.contracts.map((contract) =>
    campPlayerIds.has(contract.playerId) && contract.status === "active"
      ? waiveContract(contract)
      : contract,
  )

  const teams = league.seasonState.teams.map((team) => {
    const players = team.players.filter((player) => !campPlayerIds.has(player.id))
    return {
      ...team,
      players,
      overall: deriveTeamOverall(players),
    }
  })

  return {
    seasonState: {
      ...league.seasonState,
      teams,
    },
    contracts,
    freeAgentPool: league.freeAgentPool.filter(
      (player) => !campPlayerIds.has(player.id),
    ),
  }
}

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
    usageIndex: team.players.length + index,
    skillVariance: { min: -5, max: 5 },
    archetypeContext: "camp",
    prospectType: "camp_fringe",
    scoutingLevel: 9,
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
    wingspanInches: profile.wingspanInches,
    reachRating: profile.reachRating,
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
    mood: seedPlayerMood(`p_${team.abbrev.toLowerCase()}_camp_s${season}_${index + 1}`),
    performanceDrift: 0,
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
