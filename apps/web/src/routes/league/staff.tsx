import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"

import type { StaffExtensionOffer, StaffMember, StaffOffer } from "@workspace/shared/types"
import { getStaffByRole } from "@workspace/sim"

import { ExtendStaffDialog } from "@/components/league/staff/ExtendStaffDialog"
import { FireStaffDialog } from "@/components/league/staff/FireStaffDialog"
import { HireOfferDialog } from "@/components/league/staff/HireOfferDialog"
import { HiringPoolPanel } from "@/components/league/staff/HiringPoolPanel"
import {
  StaffRosterTable,
  useStaffRosterDialogs,
} from "@/components/league/staff/StaffRosterTable"
import { StaffBudgetBar } from "@/components/league/staff/StaffBudgetBar"
import { TeamStaffSummary } from "@/components/league/staff/TeamStaffSummary"
import { useLeagueContext } from "@/contexts/LeagueContext"
import { useTeamFinancials } from "@/hooks/useTeamFinancials"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

export const Route = createFileRoute("/league/staff")({
  component: LeagueStaffPage,
})

function LeagueStaffPage() {
  const {
    league,
    userTeamId,
    isOffseason,
    offseasonPhase,
    hireStaff,
    fireStaff,
    extendStaffContract,
    completeStaffPhase,
    canCompleteStaffPhase,
  } = useLeagueContext()
  const financials = useTeamFinancials(league, userTeamId)
  const rosterDialogs = useStaffRosterDialogs()
  const [hireTarget, setHireTarget] = useState<StaffMember | null>(null)

  if (!league || !userTeamId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Staff</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No team selected. Pick a team to continue.
          </p>
        </CardContent>
      </Card>
    )
  }

  const isStaffPhase = isOffseason && offseasonPhase === "staff"
  const teamFinance = financials?.teamFinance
  const staffBudget = teamFinance?.staffBudget ?? 0
  const staffPayroll = teamFinance?.staffPayroll ?? 0
  const coachingLevel = teamFinance?.coachingLevel ?? 5
  const scoutingLevel = teamFinance?.scoutingLevel ?? 5
  const developmentLevel = teamFinance?.developmentLevel ?? 5

  function handleHireConfirm(staffId: string, offer: StaffOffer) {
    void hireStaff(staffId, offer)
    setHireTarget(null)
  }

  function handleFireConfirm(staffId: string) {
    void fireStaff(staffId)
    rosterDialogs.closeFire()
  }

  function handleExtendConfirm(staffId: string, offer: StaffExtensionOffer) {
    void extendStaffContract(staffId, offer)
    rosterDialogs.closeExtend()
  }

  const hireRoleFilled = hireTarget
    ? Boolean(getStaffByRole(league.staff, userTeamId, hireTarget.role))
    : false

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Staff</CardTitle>
          <CardDescription>
            {isStaffPhase
              ? "Hire, fire, and extend coaches during the staff week before re-signing opens."
              : "Review your coaching staff and front-office impact year-round."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!isStaffPhase ? (
            <p className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              Staff changes open during the offseason staff week.
              {isOffseason && canCompleteStaffPhase ? (
                <>
                  {" "}
                  <Link to="/league" className="underline">
                    Return to the dashboard
                  </Link>{" "}
                  to advance the offseason.
                </>
              ) : null}
            </p>
          ) : null}

          <TeamStaffSummary
            league={league}
            teamId={userTeamId}
            coachingLevel={coachingLevel}
            scoutingLevel={scoutingLevel}
            developmentLevel={developmentLevel}
          />

          {isStaffPhase ? (
            <>
              <StaffBudgetBar budget={staffBudget} payroll={staffPayroll} />
              {canCompleteStaffPhase ? (
                <div>
                  <Button size="sm" onClick={() => void completeStaffPhase()}>
                    Complete staff phase
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}

          <StaffRosterTable
            league={league}
            teamId={userTeamId}
            editable={isStaffPhase}
            onFire={rosterDialogs.openFire}
            onExtend={rosterDialogs.openExtend}
          />
        </CardContent>
      </Card>

      {isStaffPhase ? (
        <HiringPoolPanel
          league={league}
          teamId={userTeamId}
          onHire={setHireTarget}
        />
      ) : null}

      <FireStaffDialog
        member={rosterDialogs.fireTarget}
        onClose={rosterDialogs.closeFire}
        onConfirm={handleFireConfirm}
      />

      <ExtendStaffDialog
        league={league}
        teamId={userTeamId}
        member={rosterDialogs.extendTarget}
        staffBudget={staffBudget}
        staffPayroll={staffPayroll}
        onClose={rosterDialogs.closeExtend}
        onConfirm={handleExtendConfirm}
      />

      <HireOfferDialog
        member={hireTarget}
        staffBudget={staffBudget}
        staffPayroll={staffPayroll}
        roleFilled={hireRoleFilled}
        onClose={() => setHireTarget(null)}
        onConfirm={handleHireConfirm}
      />
    </div>
  )
}
