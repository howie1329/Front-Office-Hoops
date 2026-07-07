import type {
  Player,
  PlayerSeasonProfile,
  PlayerSeasonStats,
  Rng,
  SkillKey,
  TeamWithRoster,
} from "@workspace/shared/types"

export type SkillDeltas = Record<SkillKey, number>

export type ModifierCategory =
  | "culture"
  | "staff"
  | "mentorship"
  | "performance"
  | "injury"
  | "opportunity"
  | "event"

export type DevelopmentModifier = {
  id: string
  source: "tag" | "team" | "performance" | "manual"
  category?: ModifierCategory
  growthMultiplier?: number
  regressionMultiplier?: number
  growthBonus?: number
  regressionBonus?: number
  potentialDriftBias?: number
  skillBonuses?: Partial<Record<SkillKey, number>>
}

export type DevelopmentContext = {
  player: Player
  team: TeamWithRoster
  season: number
  seasonStats?: PlayerSeasonStats
  seasonProfile?: PlayerSeasonProfile
  teammates: Player[]
  rng: Rng
  cultureScore?: number
  coachingLevel?: number
  developmentLevel?: number
}

export type ProgressPlayerResult = {
  player: Player
  record: import("@workspace/shared/types").PlayerDevelopmentRecord
}
