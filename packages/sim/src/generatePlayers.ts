import { PLAYERS_PER_TEAM } from "@workspace/shared/constants"
import type {
  Player,
  PlayerPosition,
  Rng,
  Team,
  TeamWithRoster,
} from "@workspace/shared/types"

import {
  generatePlayerProfile,
  potentialGapForAge,
} from "./playerGeneration/generatePlayerProfile"
import { clampRating, deriveTeamOverall, deriveUsage } from "./playerRatings"

const POSITION_TEMPLATE: PlayerPosition[] = [
  "PG",
  "PG",
  "SG",
  "SG",
  "SF",
  "SF",
  "PF",
  "PF",
  "C",
  "C",
  "SG",
  "SF",
]

/** Target OVR offset from team.overall by roster depth (star → bench). */
const ROSTER_TIER_OFFSETS: Array<{ min: number; max: number }> = [
  { min: 4, max: 10 },
  { min: 3, max: 9 },
  { min: 0, max: 6 },
  { min: -1, max: 5 },
  { min: -2, max: 4 },
  { min: -6, max: 0 },
  { min: -8, max: -2 },
  { min: -10, max: -4 },
  { min: -18, max: -10 },
  { min: -20, max: -12 },
  { min: -22, max: -14 },
  { min: -24, max: -16 },
]

function targetOverallForRosterSlot(
  teamOverall: number,
  index: number,
  rng: Rng
): number {
  const tier = ROSTER_TIER_OFFSETS[index] ?? ROSTER_TIER_OFFSETS.at(-1)!
  return clampRating(teamOverall + rng.int(tier.min, tier.max))
}

function generateAgeForRosterSlot(index: number, rng: Rng): number {
  if (index < 2) {
    return rng.int(27, 32)
  }

  if (index < 5) {
    return rng.int(24, 32)
  }

  if (index < 8) {
    return rng.int(22, 33)
  }

  return rng.next() < 0.55 ? rng.int(19, 23) : rng.int(30, 34)
}

function finalizeRosterUsage(players: Player[]): Player[] {
  const sorted = [...players].sort(
    (a, b) => b.ratings.overall - a.ratings.overall
  )

  return sorted.map((player, index) => ({
    ...player,
    ratings: {
      ...player.ratings,
      usage: deriveUsage(player.ratings.overall, index),
    },
  }))
}

export function generatePlayers(team: Team, rng: Rng): Player[] {
  const players: Player[] = []
  const usedNames = new Set<string>()

  for (let index = 0; index < PLAYERS_PER_TEAM; index++) {
    const position = POSITION_TEMPLATE[index]!
    const targetOverall = targetOverallForRosterSlot(team.overall, index, rng)
    const age = generateAgeForRosterSlot(index, rng)
    const profile = generatePlayerProfile({
      age,
      targetOverall,
      position,
      rng,
      usedNames,
      potentialGap: potentialGapForAge(age, rng),
      usageIndex: index,
    })

    players.push({
      id: `p_${team.abbrev.toLowerCase()}_${String(index + 1).padStart(2, "0")}`,
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
      tags: profile.tags,
      status: "active",
      injury: null,
      draftInfo: null,
      activeContractId: null,
      seasonsWithTeam: 0,
      yearsOfService: profile.yearsOfService,
    })
  }

  return finalizeRosterUsage(players)
}

export function generateTeamWithRoster(team: Team, rng: Rng): TeamWithRoster {
  const players = generatePlayers(team, rng)
  const overall = deriveTeamOverall(players)

  return {
    ...team,
    overall,
    players,
  }
}
