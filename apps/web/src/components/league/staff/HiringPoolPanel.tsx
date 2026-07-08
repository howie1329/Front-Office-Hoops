import { useMemo, useState } from "react"
import { COLLEGE_PROMOTION_THRESHOLD } from "@workspace/shared/constants"
import type { LeagueRecord, StaffMember, StaffRole } from "@workspace/shared/types"
import {
  getContractOffersForCandidate,
  getStaffByRole,
  getStaffContractMarketValue,
} from "@workspace/sim"

import { formatMoney } from "@/components/league/lib/moneyFormat"
import {
  formatDefensiveScheme,
  formatOffensiveScheme,
  formatStaffRole,
  STAFF_ROLES,
} from "@/components/league/staff/staffLabels"
import { getMarketPool, getVacantRoles } from "@/components/league/staff/staffSelectors"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"

type HiringPoolPanelProps = {
  league: LeagueRecord
  teamId: string
  onHire: (member: StaffMember) => void
}

type PoolTab = "market" | "college"
type RoleFilter = "all" | StaffRole

export function HiringPoolPanel({
  league,
  teamId,
  onHire,
}: HiringPoolPanelProps) {
  const [poolTab, setPoolTab] = useState<PoolTab>("market")
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all")

  const vacantRoles = useMemo(
    () => getVacantRoles(league, teamId),
    [league, teamId],
  )

  const marketPool = useMemo(() => getMarketPool(league), [league])

  const collegePool = useMemo(
    () =>
      league.collegeCoaches.filter(
        (member) => member.ratings.overall >= COLLEGE_PROMOTION_THRESHOLD,
      ),
    [league.collegeCoaches],
  )

  const filteredPool = useMemo(() => {
    const source = poolTab === "market" ? marketPool : collegePool
    const sorted = [...source].sort(
      (left, right) => right.ratings.overall - left.ratings.overall,
    )
    if (roleFilter === "all") {
      return sorted
    }
    return sorted.filter((member) => member.role === roleFilter)
  }, [collegePool, marketPool, poolTab, roleFilter])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hiring pool</CardTitle>
        <CardDescription>
          Hire from the pro market or promoted college coaches.
          {vacantRoles.length > 0
            ? ` Open roles: ${vacantRoles.map((role) => formatStaffRole(role)).join(", ")}.`
            : " All staff roles are filled."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={poolTab === "market" ? "default" : "outline"}
            onClick={() => setPoolTab("market")}
          >
            Market ({marketPool.length})
          </Button>
          <Button
            size="sm"
            variant={poolTab === "college" ? "default" : "outline"}
            onClick={() => setPoolTab("college")}
          >
            College ({collegePool.length})
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterButton
            active={roleFilter === "all"}
            onClick={() => setRoleFilter("all")}
            label="All roles"
          />
          {STAFF_ROLES.map((role) => (
            <FilterButton
              key={role}
              active={roleFilter === role}
              onClick={() => setRoleFilter(role)}
              label={formatStaffRole(role)}
            />
          ))}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Overall</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead>Best offer</TableHead>
              <TableHead>Schemes</TableHead>
              <TableHead className="text-right">Offer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPool.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  No coaches match this filter.
                </TableCell>
              </TableRow>
            ) : (
              filteredPool.map((member) => {
                const roleFilled = Boolean(
                  getStaffByRole(league.staff, teamId, member.role),
                )
                const matchesVacancy = vacantRoles.includes(member.role)
                const market = getStaffContractMarketValue(member)
                const sortedOffers = getContractOffersForCandidate(
                  league,
                  member.id,
                  "staff",
                  "staff",
                )
                  .filter((offer) => offer.status === "pending")
                  .sort((a, b) => b.firstYearSalary - a.firstYearSalary)
                const bestOfferText =
                  sortedOffers.length > 0
                    ? `${formatMoney(sortedOffers[0].firstYearSalary)} x ${sortedOffers[0].years}`
                    : "None"

                return (
                  <TableRow
                    key={member.id}
                    className={cn(matchesVacancy && "bg-primary/5")}
                  >
                    <TableCell>
                      {member.firstName} {member.lastName}
                      {poolTab === "college" && member.potential ? (
                        <Badge variant="outline" className="ml-2">
                          POT {member.potential}
                        </Badge>
                      ) : null}
                      {matchesVacancy ? (
                        <Badge className="ml-2">Open role</Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>{formatStaffRole(member.role)}</TableCell>
                    <TableCell>{member.ratings.overall}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatMoney(market.lowSalary)}-
                      {formatMoney(market.highSalary)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {bestOfferText}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatOffensiveScheme(member.preferredOffense)} /{" "}
                      {formatDefensiveScheme(member.preferredDefense)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        disabled={roleFilled}
                        onClick={() => onHire(member)}
                      >
                        {roleFilled ? "Role filled" : "Offer"}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <Button size="sm" variant={active ? "default" : "outline"} onClick={onClick}>
      {label}
    </Button>
  )
}
