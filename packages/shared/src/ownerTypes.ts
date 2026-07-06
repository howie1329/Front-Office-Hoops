export type OwnerArchetype =
  "frugal" | "patient" | "win_now" | "meddling" | "hands_off" | "analytics"

export type OwnerPatience = "low" | "medium" | "high"
export type OwnerRiskTolerance = "low" | "medium" | "high"

export type Owner = {
  id: string
  teamId: string
  displayName: string
  archetype: OwnerArchetype
  trust: number
  patience: OwnerPatience
  riskTolerance: OwnerRiskTolerance
}

export type OwnerGoalType =
  | "make_playoffs"
  | "win_championship"
  | "win_total"
  | "acquire_picks"
  | "reduce_payroll"
  | "avoid_luxury_tax"
  | "develop_youth"
  | "re_sign_player"

export type OwnerGoalPriority = "primary" | "secondary"
export type OwnerGoalStatus = "active" | "completed" | "failed" | "cancelled"

export type OwnerGoal = {
  id: string
  teamId: string
  season: number
  type: OwnerGoalType
  params: Record<string, number | string>
  priority: OwnerGoalPriority
  trustReward: number
  trustPenalty: number
  status: OwnerGoalStatus
  assignedDay: number
  deadlineDay: number
}
