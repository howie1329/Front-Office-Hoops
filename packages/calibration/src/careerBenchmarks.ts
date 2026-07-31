import type {
  CareerBenchmarkResult,
  CareerCohortSummary,
} from "@workspace/domain-v2"

export type CareerBenchmarkTarget = {
  min: number
  max: number
}

export type CareerBenchmarkProfile = {
  id: string
  label: string
  targets: Record<string, CareerBenchmarkTarget>
}

export const NBA_LIKE_CAREER_BENCHMARK_PROFILE: CareerBenchmarkProfile = {
  id: "nba-like-career-v1",
  label: "NBA-like career directional baseline",
  targets: {
    averagePeakAge: { min: 24, max: 31 },
    averageDeclineStartAge: { min: 27, max: 36 },
    availabilityRate: { min: 0.65, max: 0.98 },
    breakoutRate: { min: 0.01, max: 0.45 },
    bustRate: { min: 0.01, max: 0.55 },
    retirementRate: { min: 0, max: 0.8 },
  },
}

export function evaluateCareerBenchmark(
  summary: CareerCohortSummary,
  profile: CareerBenchmarkProfile
): CareerBenchmarkResult {
  const checks = Object.fromEntries(
    Object.entries(profile.targets).map(([metric, target]) => {
      const actual = Number(summary[metric as keyof CareerCohortSummary])
      return [
        metric,
        {
          metric,
          actual,
          target,
          passed: actual >= target.min && actual <= target.max,
        },
      ]
    })
  )
  return {
    profileId: profile.id,
    label: profile.label,
    passed: Object.values(checks).every((check) => check.passed),
    checks,
  }
}
