import { useState } from "react"

import type { LeagueRecord, StaffMember } from "@workspace/shared/types"
import { getStaffByRole, getStaffEmploymentSeason } from "@workspace/sim"

import {
  formatCoachingPace,
  formatDefensiveScheme,
  formatOffensiveScheme,
  formatStaffRole,
  STAFF_ROLES,
} from "@/components/league/staff/staffLabels"
import {
  formatStaffContractLabel,
  formatStaffSalaryLabel,
  getActiveStaffContract,
  getRoleRatingSummary,
} from "@/components/league/staff/staffSelectors"
import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

type StaffRosterTableProps = {
  league: LeagueRecord
  teamId: string
  editable: boolean
  onFire: (member: StaffMember) => void
  onExtend: (member: StaffMember) => void
}

export function StaffRosterTable({
  league,
  teamId,
  editable,
  onFire,
  onExtend,
}: StaffRosterTableProps) {
  const season = getStaffEmploymentSeason(league)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Role</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Ratings</TableHead>
          <TableHead>Schemes</TableHead>
          <TableHead>Pace</TableHead>
          <TableHead>Contract</TableHead>
          <TableHead>Salary</TableHead>
          {editable ? (
            <TableHead className="text-right">Actions</TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {STAFF_ROLES.map((role) => {
          const member = getStaffByRole(league.staff, teamId, role)
          const contract = member
            ? getActiveStaffContract(league, member.id, teamId)
            : undefined

          return (
            <TableRow key={role}>
              <TableCell>{formatStaffRole(role)}</TableCell>
              <TableCell>
                {member ? `${member.firstName} ${member.lastName}` : "Vacant"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {member ? getRoleRatingSummary(member) : "—"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {member
                  ? `${formatOffensiveScheme(member.preferredOffense)} / ${formatDefensiveScheme(member.preferredDefense)}`
                  : "—"}
              </TableCell>
              <TableCell>
                {member?.role === "head_coach" && member.pace
                  ? formatCoachingPace(member.pace)
                  : "—"}
              </TableCell>
              <TableCell>
                {formatStaffContractLabel(contract, season)}
              </TableCell>
              <TableCell>{formatStaffSalaryLabel(contract, season)}</TableCell>
              {editable ? (
                <TableCell className="text-right">
                  {member ? (
                    <div className="flex justify-end gap-2">
                      {contract ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onExtend(member)}
                        >
                          Extend
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onFire(member)}
                      >
                        Fire
                      </Button>
                    </div>
                  ) : null}
                </TableCell>
              ) : null}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

export function useStaffRosterDialogs() {
  const [fireTarget, setFireTarget] = useState<StaffMember | null>(null)
  const [extendTarget, setExtendTarget] = useState<StaffMember | null>(null)

  return {
    fireTarget,
    extendTarget,
    openFire: setFireTarget,
    openExtend: setExtendTarget,
    closeFire: () => setFireTarget(null),
    closeExtend: () => setExtendTarget(null),
  }
}
