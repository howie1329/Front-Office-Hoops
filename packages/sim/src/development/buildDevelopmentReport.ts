import type {
  PlayerDevelopmentRecord,
  PreseasonDevelopmentReport,
  RetirementEntry,
} from "@workspace/shared/types"

export function buildPreseasonDevelopmentReport(
  season: number,
  records: PlayerDevelopmentRecord[],
  retirements: RetirementEntry[],
): PreseasonDevelopmentReport {
  const activeRecords = records.filter((record) => !record.retired)

  const byOverallDelta = [...activeRecords].sort(
    (a, b) => b.overallAfter - b.overallBefore - (a.overallAfter - a.overallBefore),
  )

  const topRisers = byOverallDelta.filter((r) => r.overallAfter > r.overallBefore).slice(0, 10)
  const topFallers = [...byOverallDelta]
    .reverse()
    .filter((r) => r.overallAfter < r.overallBefore)
    .slice(0, 10)

  const breakouts = activeRecords.filter((record) =>
    record.events.some((event) => event.startsWith("event:breakout")),
  )
  const regressions = activeRecords.filter((record) =>
    record.events.some((event) => event.startsWith("event:regression")),
  )

  return {
    season,
    topRisers,
    topFallers,
    breakouts,
    regressions,
    retirements,
  }
}
