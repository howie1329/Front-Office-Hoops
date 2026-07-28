import { useMemo, useState } from "react"

import { COLLEGE_PROMOTION_THRESHOLD } from "@workspace/shared/constants"
import type {
  LeagueRecord,
  StaffMember,
  StaffRole,
} from "@workspace/shared/types"
import {
  getContractOffersForCandidate,
  getStaffByRole,
  getStaffContractMarketValue,
} from "@workspace/sim"

import {
  SortableTable,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@/components/league/SortableTable"
import type { ColumnDef, SortingState } from "@/components/league/SortableTable"
import { formatMoney } from "@/components/league/lib/moneyFormat"
import {
  formatDefensiveScheme,
  formatOffensiveScheme,
  formatStaffRole,
  STAFF_ROLES,
} from "@/components/league/staff/staffLabels"
import {
  getMarketPool,
  getStaffCareerSummary,
  getVacantRoles,
} from "@/components/league/staff/staffSelectors"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"

type HiringPoolPanelProps = {
  league: LeagueRecord
  teamId: string
  onHire: (member: StaffMember) => void
}

type PoolTab = "market" | "college"
type RoleFilter = "all" | StaffRole

type HiringPoolRow = {
  member: StaffMember
  name: string
  role: string
  overall: number
  age: number
  career: string
  expected: string
  bestOffer: string
  schemes: string
  roleFilled: boolean
  matchesVacancy: boolean
}

export function HiringPoolPanel({
  league,
  teamId,
  onHire,
}: HiringPoolPanelProps) {
  const [poolTab, setPoolTab] = useState<PoolTab>("market")
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all")
  const [sorting, setSorting] = useState<SortingState>([
    { id: "overall", desc: true },
  ])

  const vacantRoles = useMemo(
    () => getVacantRoles(league, teamId),
    [league, teamId]
  )

  const marketPool = useMemo(() => getMarketPool(league), [league])

  const collegePool = useMemo(
    () =>
      league.collegeCoaches.filter(
        (member) => member.ratings.overall >= COLLEGE_PROMOTION_THRESHOLD
      ),
    [league.collegeCoaches]
  )

  const filteredPool = useMemo(() => {
    const source = poolTab === "market" ? marketPool : collegePool
    if (roleFilter === "all") {
      return source
    }
    return source.filter((member) => member.role === roleFilter)
  }, [collegePool, marketPool, poolTab, roleFilter])

  const rows = useMemo<HiringPoolRow[]>(
    () =>
      filteredPool.map((member) => {
        const roleFilled = Boolean(
          getStaffByRole(league.staff, teamId, member.role)
        )
        const matchesVacancy = vacantRoles.includes(member.role)
        const market = getStaffContractMarketValue(member)
        const sortedOffers = getContractOffersForCandidate(
          league,
          member.id,
          "staff",
          "staff"
        )
          .filter((offer) => offer.status === "pending")
          .sort((a, b) => b.firstYearSalary - a.firstYearSalary)

        return {
          member,
          name: `${member.firstName} ${member.lastName}`,
          role: formatStaffRole(member.role),
          overall: member.ratings.overall,
          age: member.age,
          career: getStaffCareerSummary(league, member.id),
          expected: `${formatMoney(market.lowSalary)}-${formatMoney(market.highSalary)}`,
          bestOffer:
            sortedOffers.length > 0
              ? `${formatMoney(sortedOffers[0].firstYearSalary)} x ${sortedOffers[0].years}`
              : "None",
          schemes: `${formatOffensiveScheme(member.preferredOffense)} / ${formatDefensiveScheme(member.preferredDefense)}`,
          roleFilled,
          matchesVacancy,
        }
      }),
    [filteredPool, league, teamId, vacantRoles]
  )

  const columns = useMemo<ColumnDef<HiringPoolRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const { member, matchesVacancy } = row.original
          return (
            <>
              {row.original.name}
              {poolTab === "college" && member.potential ? (
                <Badge variant="outline" className="ml-2">
                  POT {member.potential}
                </Badge>
              ) : null}
              {matchesVacancy ? (
                <Badge className="ml-2">Open role</Badge>
              ) : null}
            </>
          )
        },
      },
      { accessorKey: "role", header: "Role" },
      { accessorKey: "age", header: "Age" },
      { accessorKey: "overall", header: "Overall" },
      {
        accessorKey: "career",
        header: "Career",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.career}</span>
        ),
      },
      { accessorKey: "expected", header: "Expected" },
      {
        accessorKey: "bestOffer",
        header: "Best offer",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.bestOffer}
          </span>
        ),
      },
      {
        accessorKey: "schemes",
        header: "Schemes",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.schemes}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Offer",
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            size="sm"
            disabled={row.original.roleFilled}
            onClick={() => onHire(row.original.member)}
          >
            {row.original.roleFilled ? "Role filled" : "Offer"}
          </Button>
        ),
      },
    ],
    [onHire, poolTab]
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <Card className="min-h-[26rem] xl:min-h-0">
      <CardHeader>
        <CardTitle>Hiring pool</CardTitle>
        <CardDescription>
          Hire from the pro market or promoted college coaches.
          {vacantRoles.length > 0
            ? ` Open roles: ${vacantRoles.map((role) => formatStaffRole(role)).join(", ")}.`
            : " All staff roles are filled."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
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

        <div
          tabIndex={0}
          aria-label="Hiring pool table"
          className="min-h-0 min-w-0 flex-1 overflow-auto rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <SortableTable
            table={table}
            emptyLabel="No coaches match this filter."
            stickyHeader
            className="min-w-[1120px]"
            rowClassName={(row) =>
              cn(row.original.matchesVacancy && "bg-primary/5")
            }
          />
        </div>
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
    <Button
      size="sm"
      variant={active ? "default" : "outline"}
      onClick={onClick}
    >
      {label}
    </Button>
  )
}
