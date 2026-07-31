export type CalibrationTarget = {
  min: number
  max: number
}

export type CalibrationBenchmarkProfile = {
  id: string
  label: string
  targets: Record<string, CalibrationTarget>
}

export const MODERN_BALANCED_BENCHMARK_PROFILE: CalibrationBenchmarkProfile = {
  id: "modern-balanced-v1",
  label: "Modern balanced basketball",
  targets: {
    teamPoints: { min: 105, max: 123 },
    teamPossessions: { min: 95, max: 103 },
    offensiveEfficiency: { min: 105, max: 123 },
    fieldGoalPercentage: { min: 44, max: 50 },
    threePointPercentage: { min: 33, max: 40 },
    freeThrowPercentage: { min: 75, max: 82 },
    threePointAttemptRate: { min: 36, max: 42 },
    freeThrowAttemptRate: { min: 20, max: 28 },
    turnoverRate: { min: 12, max: 15 },
    assists: { min: 23, max: 30 },
    rebounds: { min: 39, max: 48 },
    offensiveRebounds: { min: 9, max: 13 },
    steals: { min: 6, max: 9 },
    blocks: { min: 3, max: 7 },
    fouls: { min: 15, max: 22 },
    reconciliationPass: { min: 1, max: 1 },
    failureRate: { min: 0, max: 0.05 },
  },
}
