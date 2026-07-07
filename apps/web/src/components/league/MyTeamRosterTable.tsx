import { useMemo, useState } from "react"
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
  type ColumnDef,
  type SortingState,
  SortableTable,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
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

  const columns = useMemo<ColumnDef<MyTeamRosterRow>[]>(
    () => [
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
    [],
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Roster</CardTitle>
              <CardDescription>
                {roster.players.length} players · sort by column · actions per row
              </CardDescription>
            </div>
            <Badge variant="outline">{roster.abbrev}</Badge>
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
          <div className="h-full min-h-0 overflow-auto p-4 pt-3">
            <SortableTable
              table={table}
              emptyLabel="No players on roster."
              stickyHeader
              className="min-w-[1080px]"
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
