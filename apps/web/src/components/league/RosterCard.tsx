import { Link } from "@tanstack/react-router"

import type { Contract, TeamWithRoster } from "@workspace/shared/types"
import { getCurrentSalary, getYearsRemaining } from "@workspace/sim"

import { formatMoney } from "@/components/league/lib/moneyFormat"
import {
  getNextContractOptionLabel,
  getTradableRestrictionLabel,
} from "@/components/league/lib/contractLabels"
import { getViewRatings } from "@/components/league/lib/scouting"
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

type RosterCardProps = {
  roster: TeamWithRoster
  contracts?: Contract[]
  showRelease?: boolean
  onReleasePlayer?: (playerId: string) => void
  isOwnRoster?: boolean
  teamScoutingLevel?: number
  currentDay?: number | null
}

function getContractForPlayer(
  contracts: Contract[] | undefined,
  playerId: string
) {
  return contracts?.find(
    (contract) => contract.playerId === playerId && contract.status === "active"
  )
}

export function RosterCard({
  roster,
  contracts,
  showRelease = false,
  onReleasePlayer,
  isOwnRoster = false,
  teamScoutingLevel = 5,
  currentDay = null,
}: RosterCardProps) {
  const sortedPlayers = [...roster.players].sort((a, b) => {
    const aRatings = getViewRatings(a.ratings, { isOwnRoster, teamScoutingLevel })
    const bRatings = getViewRatings(b.ratings, { isOwnRoster, teamScoutingLevel })
    return (
      bRatings.overall - aRatings.overall ||
      bRatings.potential - aRatings.potential ||
      a.lastName.localeCompare(b.lastName)
    )
  })

  return (
    <Card className="h-full min-h-0">
      <CardHeader className="border-b">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Roster</CardTitle>
            <CardDescription>
              {roster.abbrev} · {roster.overall} OVR · {roster.pace} pace
              {roster.divisionId ? ` · ${roster.divisionId}` : null}
            </CardDescription>
          </div>
          <p className="text-xs text-muted-foreground">
            {roster.players.length} players
          </p>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-hidden">
        <div className="h-full min-h-0 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Pos</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Age</TableHead>
                <TableHead className="text-right">OVR</TableHead>
                <TableHead className="text-right">POT</TableHead>
                {contracts ? (
                  <TableHead className="text-right">Salary</TableHead>
                ) : null}
                {contracts ? (
                  <TableHead className="text-right">Yrs</TableHead>
                ) : null}
                {showRelease ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPlayers.map((player) => {
                const contract = getContractForPlayer(contracts, player.id)
                const yearsRemaining = getYearsRemaining(contract)
                const optionLabel = getNextContractOptionLabel(
                  contract,
                  yearsRemaining,
                )
                const tradableLabel = getTradableRestrictionLabel(
                  contract,
                  currentDay,
                )
                const viewRatings = getViewRatings(player.ratings, {
                  isOwnRoster,
                  teamScoutingLevel,
                })
                return (
                  <TableRow key={player.id}>
                    <TableCell>
                      <div className="flex min-w-48 flex-col">
                        <Link
                          to="/league/players/$playerId"
                          params={{ playerId: player.id }}
                          className="font-medium hover:underline"
                        >
                          {player.firstName} {player.lastName}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {contractLabel(yearsRemaining)}
                          {optionLabel ? ` · ${optionLabel}` : ""}
                          {tradableLabel ? ` · ${tradableLabel}` : ""}
                          {player.tags?.includes("camp_invite")
                            ? " · Camp invite"
                            : ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{player.position}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatArchetype(player.archetype)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {player.age}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {viewRatings.overall}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {viewRatings.potential}
                    </TableCell>
                    {contracts ? (
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(getCurrentSalary(contract))}
                      </TableCell>
                    ) : null}
                    {contracts ? (
                      <TableCell className="text-right tabular-nums">
                        {yearsRemaining}
                      </TableCell>
                    ) : null}
                    {showRelease ? (
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onReleasePlayer?.(player.id)}
                        >
                          Release
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function contractLabel(yearsRemaining: number): string {
  if (yearsRemaining <= 0) {
    return "No active contract"
  }
  if (yearsRemaining === 1) {
    return "Expiring"
  }
  return `${yearsRemaining} years remaining`
}

function formatArchetype(value: string | undefined): string {
  if (!value) {
    return "—"
  }
  return value.replaceAll("_", " ")
}
