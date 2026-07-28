import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"

import { STAFF_MINIMUM_SALARY } from "@workspace/shared/constants"
import type {
  StaffExtensionOffer,
  StaffMember,
  StaffOffer,
} from "@workspace/shared/types"
import {
  getCurrentCalendar,
  getStaffByRole,
  getVacantStaffRoles,
} from "@workspace/sim"

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
import { formatMoney } from "@/components/league/lib/moneyFormat"
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
import { cn } from "@workspace/ui/lib/utils"

export const Route = createFileRoute("/league/staff")({
  component: LeagueStaffPage,
})

function LeagueStaffPage() {
  const {
    league,
    userTeamId,
    isOffseason,
    offseasonPhase,
    submitStaffContractOffer,
    advanceStaffMarketDay,
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
  const vacantRoles = getVacantStaffRoles(league, userTeamId)
  const staffPhaseEndDay = getCurrentCalendar(league.seasonState).milestones
    .staffPhaseEndDay
  const isFinalStaffDay =
    isStaffPhase && league.seasonState.currentDay >= staffPhaseEndDay - 1
  const staffDaysRemaining = Math.max(
    0,
    staffPhaseEndDay - league.seasonState.currentDay
  )
  const isStaffDeadlineWarning = isStaffPhase && staffDaysRemaining <= 2

  function handleHireConfirm(staffId: string, offer: StaffOffer) {
    void submitStaffContractOffer(staffId, offer)
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
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-4 overflow-y-auto xl:overflow-hidden">
      <Card className="shrink-0">
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
              {isStaffDeadlineWarning ? (
                <p
                  role="status"
                  className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {isFinalStaffDay
                    ? "Final staff day: any open roles will be filled automatically after today’s offers resolve."
                    : "Two staff days remain. Any open roles left on the final day will be filled automatically."}{" "}
                  Fallback staff receive one-year contracts at{" "}
                  {formatMoney(STAFF_MINIMUM_SALARY)}.
                </p>
              ) : vacantRoles.length > 0 ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  Fill all four staff roles before continuing to re-signing.
                </p>
              ) : null}
              <div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => void advanceStaffMarketDay()}
                  >
                    {isFinalStaffDay
                      ? "Finish staff phase"
                      : "Advance staff day"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canCompleteStaffPhase}
                    onClick={() => void completeStaffPhase()}
                  >
                    Complete staff phase
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <div
        className={cn(
          "grid min-h-0 gap-4 xl:flex-1",
          isStaffPhase && "xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]"
        )}
      >
        <Card className="min-h-[20rem] xl:min-h-0">
          <CardHeader>
            <CardTitle>Staff roster</CardTitle>
            <CardDescription>
              Review current assignments, contracts, and role ratings.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
      </div>

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
