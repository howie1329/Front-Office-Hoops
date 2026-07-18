import { useMemo, useState } from "react"

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
import {
  SortableTable,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@/components/league/SortableTable"
import type { ColumnDef, SortingState } from "@/components/league/SortableTable"
import { Button } from "@workspace/ui/components/button"

type StaffRosterTableProps = {
  league: LeagueRecord
  teamId: string
  editable: boolean
  onFire: (member: StaffMember) => void
  onExtend: (member: StaffMember) => void
}

type StaffRosterRow = {
  role: string
  name: string
  ratings: string
  schemes: string
  pace: string
  contract: string
  salary: string
  member: StaffMember | null
  contractRecord: ReturnType<typeof getActiveStaffContract>
}

export function StaffRosterTable({
  league,
  teamId,
  editable,
  onFire,
  onExtend,
}: StaffRosterTableProps) {
  const season = getStaffEmploymentSeason(league)
  const [sorting, setSorting] = useState<SortingState>([])

  const rows = useMemo<StaffRosterRow[]>(
    () =>
      STAFF_ROLES.map((role) => {
        const member = getStaffByRole(league.staff, teamId, role) ?? null
        const contractRecord = member
          ? getActiveStaffContract(league, member.id, teamId)
          : undefined

        return {
          role: formatStaffRole(role),
          name: member ? `${member.firstName} ${member.lastName}` : "Vacant",
          ratings: member ? getRoleRatingSummary(member) : "—",
          schemes: member
            ? `${formatOffensiveScheme(member.preferredOffense)} / ${formatDefensiveScheme(member.preferredDefense)}`
            : "—",
          pace:
            member?.role === "head_coach" && member.pace
              ? formatCoachingPace(member.pace)
              : "—",
          contract: formatStaffContractLabel(contractRecord, season),
          salary: formatStaffSalaryLabel(contractRecord, season),
          member,
          contractRecord,
        }
      }),
    [league, season, teamId]
  )

  const columns = useMemo<ColumnDef<StaffRosterRow>[]>(() => {
    const baseColumns: ColumnDef<StaffRosterRow>[] = [
      { accessorKey: "role", header: "Role" },
      { accessorKey: "name", header: "Name" },
      {
        accessorKey: "ratings",
        header: "Ratings",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.ratings}
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
      { accessorKey: "pace", header: "Pace" },
      { accessorKey: "contract", header: "Contract" },
      { accessorKey: "salary", header: "Salary" },
    ]

    if (!editable) {
      return baseColumns
    }

    return [
      ...baseColumns,
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const { member, contractRecord } = row.original
          if (!member) {
            return null
          }

          return (
            <div className="flex justify-end gap-2">
              {contractRecord ? (
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
          )
        },
      },
    ]
  }, [editable, onExtend, onFire])

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div
      tabIndex={0}
      aria-label="Staff roster table"
      className="min-h-0 min-w-0 flex-1 overflow-auto rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <SortableTable
        table={table}
        emptyLabel="No staff roles available."
        stickyHeader
        className="min-w-[880px]"
      />
    </div>
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
