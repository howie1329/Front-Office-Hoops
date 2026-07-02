import type {
  Player,
  PlayerSeasonStats,
  Rng,
  SkillKey,
  TeamWithRoster,
} from "@workspace/shared/types"

export type SkillDeltas = Record<SkillKey, number>

export type DevelopmentModifier = {
  id: string
  source: "tag" | "team" | "performance" | "manual"
  growthMultiplier?: number
  regressionMultiplier?: number
  potentialDriftBias?: number
  skillBonuses?: Partial<Record<SkillKey, number>>
}

export type DevelopmentContext = {
  player: Player
  team: TeamWithRoster
  season: number
  seasonStats?: PlayerSeasonStats
  teammates: Player[]
  rng: Rng
}
