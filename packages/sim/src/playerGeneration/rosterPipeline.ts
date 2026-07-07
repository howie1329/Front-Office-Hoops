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
} from "./generatePlayerProfile"
import { clampRating, deriveTeamOverall, deriveUsage } from "../playerRatings"
import { defaultDevelopmentFields } from "../development/playerDefaults"
import { seedPlayerMood } from "../playerValue/moodSeed"

export const POSITION_TEMPLATE_MINI: PlayerPosition[] = [
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
  "PF",
  "C",
  "PG",
]

export const POSITION_TEMPLATE_PRODUCT: PlayerPosition[] = [
  "PG",
  "SG",
  "SF",
  "PF",
  "C",
  "PG",
  "SG",
  "SF",
  "PF",
  "C",
  "SG",
  "SF",
  "PF",
  "C",
  "SG",
]

export type GenerationArchetype =
  | "superstar_contender"
  | "balanced_contender"
  | "playoff_team"
  | "middle_team"
  | "rebuilding"
  | "bad_team"

type SlotSpec = {
  min: number
  max: number
  age: "prime" | "mixed" | "young" | "old" | "bench"
}

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
  { min: -26, max: -18 },
  { min: -28, max: -20 },
  { min: -30, max: -22 },
]

export const ARCHETYPE_COUNTS: Record<GenerationArchetype, number> = {
  superstar_contender: 2,
  balanced_contender: 4,
  playoff_team: 6,
  middle_team: 8,
  rebuilding: 5,
  bad_team: 5,
}

const ARCHETYPE_SLOTS: Record<GenerationArchetype, SlotSpec[]> = {
  superstar_contender: [
    { min: 89, max: 90, age: "prime" },
    { min: 84, max: 87, age: "prime" },
    { min: 80, max: 84, age: "mixed" },
    { min: 78, max: 82, age: "mixed" },
    { min: 75, max: 79, age: "mixed" },
    { min: 70, max: 75, age: "bench" },
    { min: 66, max: 72, age: "bench" },
    { min: 58, max: 67, age: "young" },
    { min: 54, max: 63, age: "bench" },
    { min: 50, max: 60, age: "old" },
    { min: 48, max: 58, age: "young" },
    { min: 46, max: 56, age: "bench" },
  ],
  balanced_contender: [
    { min: 86, max: 88, age: "prime" },
    { min: 82, max: 85, age: "prime" },
    { min: 80, max: 83, age: "mixed" },
    { min: 77, max: 81, age: "mixed" },
    { min: 74, max: 78, age: "mixed" },
    { min: 70, max: 75, age: "bench" },
    { min: 64, max: 71, age: "bench" },
    { min: 60, max: 68, age: "young" },
    { min: 56, max: 64, age: "bench" },
    { min: 52, max: 61, age: "old" },
    { min: 49, max: 58, age: "young" },
    { min: 46, max: 56, age: "bench" },
  ],
  playoff_team: [
    { min: 83, max: 86, age: "prime" },
    { min: 80, max: 83, age: "prime" },
    { min: 76, max: 80, age: "mixed" },
    { min: 73, max: 78, age: "mixed" },
    { min: 70, max: 75, age: "mixed" },
    { min: 66, max: 72, age: "bench" },
    { min: 60, max: 68, age: "bench" },
    { min: 57, max: 65, age: "young" },
    { min: 53, max: 62, age: "bench" },
    { min: 50, max: 59, age: "old" },
    { min: 47, max: 56, age: "young" },
    { min: 45, max: 54, age: "bench" },
  ],
  middle_team: [
    { min: 76, max: 81, age: "prime" },
    { min: 73, max: 78, age: "mixed" },
    { min: 70, max: 76, age: "mixed" },
    { min: 67, max: 73, age: "mixed" },
    { min: 64, max: 71, age: "bench" },
    { min: 61, max: 68, age: "bench" },
    { min: 58, max: 65, age: "young" },
    { min: 55, max: 62, age: "bench" },
    { min: 52, max: 60, age: "old" },
    { min: 49, max: 57, age: "young" },
    { min: 46, max: 55, age: "bench" },
    { min: 44, max: 53, age: "bench" },
  ],
  rebuilding: [
    { min: 74, max: 80, age: "young" },
    { min: 70, max: 76, age: "young" },
    { min: 67, max: 73, age: "mixed" },
    { min: 63, max: 70, age: "young" },
    { min: 60, max: 67, age: "mixed" },
    { min: 56, max: 64, age: "young" },
    { min: 53, max: 61, age: "bench" },
    { min: 50, max: 58, age: "young" },
    { min: 48, max: 56, age: "bench" },
    { min: 46, max: 54, age: "young" },
    { min: 44, max: 52, age: "bench" },
    { min: 42, max: 50, age: "bench" },
  ],
  bad_team: [
    { min: 70, max: 76, age: "mixed" },
    { min: 66, max: 72, age: "old" },
    { min: 63, max: 69, age: "mixed" },
    { min: 60, max: 66, age: "bench" },
    { min: 57, max: 64, age: "young" },
    { min: 54, max: 61, age: "bench" },
    { min: 51, max: 58, age: "young" },
    { min: 48, max: 56, age: "bench" },
    { min: 46, max: 54, age: "old" },
    { min: 44, max: 52, age: "young" },
    { min: 42, max: 50, age: "bench" },
    { min: 40, max: 48, age: "bench" },
  ],
}

export type RosterGenerationStrategy =
  | { mode: "tier_offset" }
  | { mode: "archetype_slots"; archetype: GenerationArchetype }

export function finalizeRosterUsage(players: Player[]): Player[] {
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

function generateAge(kind: SlotSpec["age"], rng: Rng): number {
  switch (kind) {
    case "prime":
      return rng.int(25, 31)
    case "young":
      return rng.int(19, 24)
    case "old":
      return rng.int(30, 35)
    case "bench":
      return rng.next() < 0.55 ? rng.int(22, 27) : rng.int(28, 34)
    case "mixed":
      return rng.int(22, 32)
  }
}

function buildPlayerFromProfile(
  team: Team,
  index: number,
  profile: ReturnType<typeof generatePlayerProfile>
): Player {
  return {
    id: `p_${team.abbrev.toLowerCase()}_${String(index + 1).padStart(2, "0")}`,
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
    tags: profile.tags,
    status: "active",
    injury: null,
    draftInfo: null,
    activeContractId: null,
    seasonsWithTeam: 0,
    yearsOfService: profile.yearsOfService,
    mood: seedPlayerMood(`p_${team.abbrev.toLowerCase()}_${index + 1}`),
    ...defaultDevelopmentFields(profile.ratings.overall),
  }
}

function generateTierOffsetPlayers(team: Team, rng: Rng): Player[] {
  const players: Player[] = []
  const usedNames = new Set<string>()

  for (let index = 0; index < PLAYERS_PER_TEAM; index++) {
    const position = POSITION_TEMPLATE_MINI[index]!
    const targetOverall = targetOverallForRosterSlot(team.overall, index, rng)
    const age = generateAgeForRosterSlot(index, rng)
    const profile = generatePlayerProfile({
      age,
      targetOverall,
      position,
      rng,
      usedNames,
      usageIndex: index,
      scoutingLevel: 9,
    })

    players.push(buildPlayerFromProfile(team, index, profile))
  }

  return finalizeRosterUsage(players)
}

function generateArchetypePlayers(
  team: Team,
  archetype: GenerationArchetype,
  rng: Rng
): Player[] {
  const usedNames = new Set<string>()
  const players: Player[] = []

  for (let index = 0; index < PLAYERS_PER_TEAM; index++) {
    const slot = ARCHETYPE_SLOTS[archetype][index] ?? {
      min: 42,
      max: 52,
      age: "bench" as const,
    }
    const age = generateAge(slot.age, rng)
    const position = POSITION_TEMPLATE_PRODUCT[index]!
    const profile = generatePlayerProfile({
      age,
      targetOverall: rng.int(slot.min, slot.max),
      position,
      rng,
      usedNames,
      usageIndex: index,
      skillVariance: { min: -3, max: 3 },
      scoutingLevel: 9,
    })

    players.push(buildPlayerFromProfile(team, index, profile))
  }

  return finalizeRosterUsage(players)
}

export function generateTeamRoster(
  team: Team,
  strategy: RosterGenerationStrategy,
  rng: Rng
): TeamWithRoster {
  const players =
    strategy.mode === "tier_offset"
      ? generateTierOffsetPlayers(team, rng)
      : generateArchetypePlayers(team, strategy.archetype, rng)

  return {
    ...team,
    overall: deriveTeamOverall(players),
    players,
  }
}

export function buildArchetypeList(rng: Rng): GenerationArchetype[] {
  const archetypes = Object.entries(ARCHETYPE_COUNTS).flatMap(
    ([archetype, count]) =>
      Array.from({ length: count }, () => archetype as GenerationArchetype)
  )

  for (let index = archetypes.length - 1; index > 0; index--) {
    const swapIndex = rng.int(0, index)
    const current = archetypes[index]!
    archetypes[index] = archetypes[swapIndex]!
    archetypes[swapIndex] = current
  }

  return archetypes
}
