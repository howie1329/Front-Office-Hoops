import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "@tanstack/react-router"

import {
  canReleasePlayer,
  getCurrentSalary,
  getExtensionEligibilityReason,
  getYearsRemaining,
} from "@workspace/sim"
import type {
  Contract,
  ExtensionOffer,
  LeagueRecord,
  PlayerSeasonStats,
  TeamWithRoster,
} from "@workspace/shared/types"

import { ExtendContractDialog } from "@/components/league/ExtendContractDialog"
import { formatMoney } from "@/components/league/lib/moneyFormat"
import {
  getNextContractOptionLabel,
  getTradableRestrictionLabel,
} from "@/components/league/lib/contractLabels"
import { getViewRatings } from "@/components/league/lib/scouting"
import {
  nullableNumberSort,
} from "@/components/league/lib/tableSort"
import {
  SortableTable,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@/components/league/SortableTable"
import type {
  ColumnDef,
  SortingState,
} from "@/components/league/SortableTable"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

export type MyTeamRosterRow = {
  playerId: string
  playerName: string
  contractLabel: string
  pos: string
  role: string
  age: number
  overall: number
  potential: number
  salary: number
  yearsRemaining: number
  gp: number
  min: number | null
  pts: number | null
  reb: number | null
  ast: number | null
  canRelease: boolean
  releaseReason: string | null
  canExtend: boolean
  extendReason: string | null
}

type MyTeamRosterTableProps = {
  league: LeagueRecord
  teamId: string
  roster: TeamWithRoster
  contracts: Contract[]
  playerSeasonStats: PlayerSeasonStats[]
  teamScoutingLevel?: number
  currentDay?: number | null
  onReleasePlayer: (playerId: string) => void
  onExtendContract: (playerId: string, offer: ExtensionOffer) => void
}

function getContractForPlayer(contracts: Contract[], playerId: string) {
  return contracts.find(
    (contract) => contract.playerId === playerId && contract.status === "active",
  )
}

function contractSubline(
  contract: Contract | undefined,
  yearsRemaining: number,
  currentDay: number | null,
): string {
  const parts: string[] = []

  if (yearsRemaining <= 0) {
    parts.push("No active contract")
  } else if (yearsRemaining === 1) {
    parts.push("Expiring")
  } else {
    parts.push(`${yearsRemaining} years remaining`)
  }

  const optionLabel = getNextContractOptionLabel(contract, yearsRemaining)
  if (optionLabel) {
    parts.push(optionLabel)
  }

  const tradableLabel = getTradableRestrictionLabel(contract, currentDay)
  if (tradableLabel) {
    parts.push(tradableLabel)
  }

  return parts.join(" · ")
}

function formatAverage(value: number | null): string {
  if (value === null) {
    return "—"
  }
  return value.toFixed(1)
}

function formatArchetype(value: string | undefined): string {
  if (!value) {
    return "—"
  }
  return value.replaceAll("_", " ")
}

function buildRows({
  league,
  teamId,
  roster,
  contracts,
  playerSeasonStats,
  teamScoutingLevel,
  currentDay,
}: Omit<
  MyTeamRosterTableProps,
  "onReleasePlayer" | "onExtendContract"
>): MyTeamRosterRow[] {
  const statsByPlayerId = new Map(
    playerSeasonStats.map((stats) => [stats.playerId, stats]),
  )

  return roster.players.map((player) => {
    const contract = getContractForPlayer(contracts, player.id)
    const yearsRemaining = getYearsRemaining(contract)
    const viewRatings = getViewRatings(player.ratings, {
      isOwnRoster: true,
      teamScoutingLevel: teamScoutingLevel ?? 5,
    })
    const stats = statsByPlayerId.get(player.id)
    const releaseCheck = canReleasePlayer(league.seasonState.teams, {
      teamId,
      playerId: player.id,
    })
    const extendEligibility = getExtensionEligibilityReason(
      league,
      teamId,
      player.id,
    )

    return {
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      contractLabel: contractSubline(contract, yearsRemaining, currentDay ?? null),
      pos: player.position,
      role: formatArchetype(player.archetype),
      age: player.age,
      overall: viewRatings.overall,
      potential: viewRatings.potential,
      salary: getCurrentSalary(contract),
      yearsRemaining,
      gp: stats?.gp ?? 0,
      min:
        stats?.gp && stats.min
          ? stats.min / stats.gp
          : null,
      pts:
        stats?.gp && stats.pts
          ? stats.pts / stats.gp
          : null,
      reb:
        stats?.gp && stats.reb
          ? stats.reb / stats.gp
          : null,
      ast:
        stats?.gp && stats.ast
          ? stats.ast / stats.gp
          : null,
      canRelease: releaseCheck.ok,
      releaseReason: releaseCheck.ok ? null : releaseCheck.reason,
      canExtend: extendEligibility.ok,
      extendReason: extendEligibility.ok ? null : extendEligibility.reason,
    }
  })
}

export function MyTeamRosterTable({
  league,
  teamId,
  roster,
  contracts,
  playerSeasonStats,
  teamScoutingLevel = 5,
  currentDay = null,
  onReleasePlayer,
  onExtendContract,
}: MyTeamRosterTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "overall", desc: true },
  ])
  const [releaseTarget, setReleaseTarget] = useState<MyTeamRosterRow | null>(
    null,
  )
  const [bulkReleaseOpen, setBulkReleaseOpen] = useState(false)
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [extendTarget, setExtendTarget] = useState<MyTeamRosterRow | null>(null)

  const rows = useMemo(
    () =>
      buildRows({
        league,
        teamId,
        roster,
        contracts,
        playerSeasonStats,
        teamScoutingLevel,
        currentDay,
      }),
    [
      league,
      teamId,
      roster,
      contracts,
      playerSeasonStats,
      teamScoutingLevel,
      currentDay,
    ],
  )

  useEffect(() => {
    setSelectedPlayerIds((current) => {
      const validIds = new Set(rows.map((row) => row.playerId))
      const next = new Set(
        [...current].filter((playerId) => validIds.has(playerId)),
      )

      return next.size === current.size ? current : next
    })
  }, [rows])

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedPlayerIds.has(row.playerId)),
    [rows, selectedPlayerIds],
  )
  const selectedReleaseRows = useMemo(
    () => selectedRows.filter((row) => row.canRelease),
    [selectedRows],
  )

  function togglePlayerSelection(playerId: string, checked: boolean) {
    setSelectedPlayerIds((current) => {
      const next = new Set(current)

      if (checked) {
        next.add(playerId)
      } else {
        next.delete(playerId)
      }

      return next
    })
  }

  function toggleVisibleReleaseSelection(checked: boolean) {
    setSelectedPlayerIds((current) => {
      const next = new Set(current)

      for (const row of table.getRowModel().rows) {
        if (!row.original.canRelease) {
          continue
        }

        if (checked) {
          next.add(row.original.playerId)
        } else {
          next.delete(row.original.playerId)
        }
      }

      return next
    })
  }

  const columns = useMemo<ColumnDef<MyTeamRosterRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => {
          const releaseRows = table
            .getRowModel()
            .rows.filter((row) => row.original.canRelease)
          const selectedVisibleCount = releaseRows.filter((row) =>
            selectedPlayerIds.has(row.original.playerId),
          ).length
          const allSelected =
            releaseRows.length > 0 && selectedVisibleCount === releaseRows.length
          const partiallySelected =
            selectedVisibleCount > 0 && selectedVisibleCount < releaseRows.length

          return (
            <SelectionCheckbox
              ariaLabel="Select releasable players"
              checked={allSelected}
              indeterminate={partiallySelected}
              disabled={releaseRows.length === 0}
              onCheckedChange={toggleVisibleReleaseSelection}
            />
          )
        },
        enableSorting: false,
        cell: ({ row }) => (
          <SelectionCheckbox
            ariaLabel={`Select ${row.original.playerName}`}
            checked={selectedPlayerIds.has(row.original.playerId)}
            disabled={!row.original.canRelease}
            title={row.original.releaseReason ?? undefined}
            onCheckedChange={(checked) =>
              togglePlayerSelection(row.original.playerId, checked)
            }
          />
        ),
      },
      {
        accessorKey: "playerName",
        header: "Player",
        cell: ({ row }) => (
          <div className="flex min-w-44 flex-col">
            <Link
              to="/league/players/$playerId"
              params={{ playerId: row.original.playerId }}
              className="font-medium hover:underline"
            >
              {row.original.playerName}
            </Link>
            <span className="text-xs text-muted-foreground">
              {row.original.contractLabel}
            </span>
          </div>
        ),
      },
      { accessorKey: "pos", header: "Pos" },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.role}
          </span>
        ),
      },
      { accessorKey: "age", header: "Age" },
      { accessorKey: "overall", header: "OVR" },
      { accessorKey: "potential", header: "POT" },
      {
        accessorKey: "salary",
        header: "Salary",
        cell: ({ row }) => formatMoney(row.original.salary),
      },
      { accessorKey: "yearsRemaining", header: "Yrs" },
      { accessorKey: "gp", header: "GP" },
      {
        accessorKey: "min",
        header: "MIN",
        cell: ({ row }) => formatAverage(row.original.min),
        sortingFn: nullableNumberSort("min"),
      },
      {
        accessorKey: "pts",
        header: "PTS",
        cell: ({ row }) => formatAverage(row.original.pts),
        sortingFn: nullableNumberSort("pts"),
      },
      {
        accessorKey: "reb",
        header: "REB",
        cell: ({ row }) => formatAverage(row.original.reb),
        sortingFn: nullableNumberSort("reb"),
      },
      {
        accessorKey: "ast",
        header: "AST",
        cell: ({ row }) => formatAverage(row.original.ast),
        sortingFn: nullableNumberSort("ast"),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <RosterRowActions
            row={row.original}
            onRelease={() => setReleaseTarget(row.original)}
            onExtend={() => setExtendTarget(row.original)}
          />
        ),
      },
    ],
    [selectedPlayerIds],
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
    <>
      <Card className="flex h-full min-h-0 flex-col">
        <CardHeader className="shrink-0 border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Roster</CardTitle>
              <CardDescription>
                {roster.players.length} players · select players for bulk actions
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {selectedRows.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {selectedRows.length} selected
                  </Badge>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={selectedReleaseRows.length === 0}
                    onClick={() => setBulkReleaseOpen(true)}
                  >
                    Release selected
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPlayerIds(new Set())}
                  >
                    Clear
                  </Button>
                </div>
              ) : null}
              <Badge variant="outline">{roster.abbrev}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
          <div className="h-full min-h-0 overflow-auto p-4 pt-3">
            <SortableTable
              table={table}
              emptyLabel="No players on roster."
              stickyHeader
              className="min-w-[1120px]"
              rowClassName={(row) =>
                selectedPlayerIds.has(row.original.playerId) ? "bg-muted/45" : ""
              }
            />
          </div>
        </CardContent>
      </Card>

      <ReleasePlayerDialog
        row={releaseTarget}
        onClose={() => setReleaseTarget(null)}
        onConfirm={(playerId) => {
          onReleasePlayer(playerId)
          setReleaseTarget(null)
        }}
      />

      <BulkReleasePlayersDialog
        rows={bulkReleaseOpen ? selectedReleaseRows : []}
        selectedCount={selectedRows.length}
        onClose={() => setBulkReleaseOpen(false)}
        onConfirm={(playerIds) => {
          for (const playerId of playerIds) {
            onReleasePlayer(playerId)
          }
          setSelectedPlayerIds(new Set())
          setBulkReleaseOpen(false)
        }}
      />

      <ExtendContractDialog
        league={league}
        teamId={teamId}
        playerId={extendTarget?.playerId ?? ""}
        playerName={extendTarget?.playerName ?? ""}
        position={extendTarget?.pos ?? ""}
        overall={extendTarget?.overall ?? 0}
        currentSalary={extendTarget?.salary ?? 0}
        open={Boolean(extendTarget)}
        onClose={() => setExtendTarget(null)}
        onConfirm={(playerId, offer) => {
          onExtendContract(playerId, offer)
          setExtendTarget(null)
        }}
      />
    </>
  )
}

function RosterRowActions({
  row,
  onRelease,
  onExtend,
}: {
  row: MyTeamRosterRow
  onRelease: () => void
  onExtend: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Player actions">
          ···
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {row.canExtend ? (
          <DropdownMenuItem onClick={onExtend}>Extend contract</DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled title={row.extendReason ?? undefined}>
            Extend contract
          </DropdownMenuItem>
        )}
        {row.canRelease ? (
          <DropdownMenuItem variant="destructive" onClick={onRelease}>
            Release player
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled title={row.releaseReason ?? undefined}>
            Release player
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ReleasePlayerDialog({
  row,
  onClose,
  onConfirm,
}: {
  row: MyTeamRosterRow | null
  onClose: () => void
  onConfirm: (playerId: string) => void
}) {
  return (
    <AlertDialog open={Boolean(row)} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Release {row?.playerName}?</AlertDialogTitle>
          <AlertDialogDescription>
            The player will be waived and become a free agent. Dead cap may apply
            depending on contract terms.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => row && onConfirm(row.playerId)}
          >
            Release player
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function BulkReleasePlayersDialog({
  rows,
  selectedCount,
  onClose,
  onConfirm,
}: {
  rows: MyTeamRosterRow[]
  selectedCount: number
  onClose: () => void
  onConfirm: (playerIds: string[]) => void
}) {
  const ineligibleCount = Math.max(0, selectedCount - rows.length)
  const playerNames = rows.map((row) => row.playerName).join(", ")

  return (
    <AlertDialog
      open={rows.length > 0}
      onOpenChange={(open) => !open && onClose()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Release {rows.length} selected player{rows.length === 1 ? "" : "s"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            The selected player{rows.length === 1 ? "" : "s"} will be waived
            and become free agent{rows.length === 1 ? "" : "s"}. Dead cap may
            apply depending on contract terms.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
          <p className="font-medium text-foreground">{playerNames}</p>
          {ineligibleCount > 0 ? (
            <p className="mt-2 text-muted-foreground">
              {ineligibleCount} selected player
              {ineligibleCount === 1 ? "" : "s"} cannot be released and will be
              skipped.
            </p>
          ) : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => onConfirm(rows.map((row) => row.playerId))}
          >
            Release selected
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function SelectionCheckbox({
  ariaLabel,
  checked,
  indeterminate = false,
  disabled = false,
  title,
  onCheckedChange,
}: {
  ariaLabel: string
  checked: boolean
  indeterminate?: boolean
  disabled?: boolean
  title?: string
  onCheckedChange: (checked: boolean) => void
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={ariaLabel}
      checked={checked}
      disabled={disabled}
      title={title}
      onChange={(event) => onCheckedChange(event.target.checked)}
      className="size-3.5 rounded-sm border border-border accent-primary focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-40"
    />
  )
}
