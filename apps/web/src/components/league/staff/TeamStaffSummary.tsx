import type { LeagueRecord } from "@workspace/shared/types"
import { derivePhilosophyFromStaff } from "@workspace/sim"

import {
  formatCoachingPace,
  formatCoachingRotation,
  formatDefensiveScheme,
  formatOffensiveScheme,
} from "@/components/league/staff/staffLabels"

type TeamStaffSummaryProps = {
  league: LeagueRecord
  teamId: string
  coachingLevel: number
  scoutingLevel: number
  developmentLevel: number
}

export function TeamStaffSummary({
  league,
  teamId,
  coachingLevel,
  scoutingLevel,
  developmentLevel,
}: TeamStaffSummaryProps) {
  const philosophy = derivePhilosophyFromStaff(league.staff, teamId)

  return (
    <section className="rounded-lg border bg-muted/20 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <SummaryMetric label="Coaching" value={String(coachingLevel)} />
        <SummaryMetric label="Scouting" value={String(scoutingLevel)} />
        <SummaryMetric label="Development" value={String(developmentLevel)} />
        <SummaryMetric label="Pace" value={formatCoachingPace(philosophy.pace)} />
        <SummaryMetric
          label="Rotation"
          value={formatCoachingRotation(philosophy.rotation)}
        />
        <SummaryMetric
          label="Offense"
          value={formatOffensiveScheme(philosophy.offense)}
        />
        <SummaryMetric
          label="Defense"
          value={formatDefensiveScheme(philosophy.defense)}
        />
      </div>
    </section>
  )
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
