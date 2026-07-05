import { Link } from "@tanstack/react-router"

import type { Contract, TeamWithRoster } from "@workspace/shared/types"
import { getCurrentSalary, getYearsRemaining } from "@workspace/sim"

import { formatMoney } from "@/components/league/lib/moneyFormat"
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
}: RosterCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{roster.name}</CardTitle>
        <CardDescription>
          {roster.abbrev} · {roster.overall} OVR · {roster.pace} pace ·{" "}
          {roster.players.length} players
          {roster.divisionId ? ` · ${roster.divisionId}` : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead>Pos</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>OVR</TableHead>
              <TableHead>POT</TableHead>
              {contracts ? <TableHead>Salary</TableHead> : null}
              {contracts ? <TableHead>Yrs</TableHead> : null}
              {showRelease ? <TableHead /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {roster.players.map((player) => {
              const contract = getContractForPlayer(contracts, player.id)
              return (
                <TableRow key={player.id}>
                  <TableCell>
                    <Link
                      to="/league/players/$playerId"
                      params={{ playerId: player.id }}
                      className="font-medium hover:underline"
                    >
                      {player.firstName} {player.lastName}
                    </Link>
                  </TableCell>
                  <TableCell>{player.position}</TableCell>
                  <TableCell>{player.age}</TableCell>
                  <TableCell>{player.ratings.overall}</TableCell>
                  <TableCell>{player.ratings.potential}</TableCell>
                  {contracts ? (
                    <TableCell>
                      {formatMoney(getCurrentSalary(contract))}
                    </TableCell>
                  ) : null}
                  {contracts ? (
                    <TableCell>{getYearsRemaining(contract)}</TableCell>
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
      </CardContent>
    </Card>
  )
}
