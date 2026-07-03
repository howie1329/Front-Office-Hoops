import { useState } from "react"

import type { FreeAgentOffer, LeagueRecord, Player } from "@workspace/shared/types"
import { canSignPlayer } from "@workspace/sim"

import { formatMoney } from "@/components/league/lib/moneyFormat"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

type FreeAgencyPanelProps = {
  league: LeagueRecord
  teamId: string
  freeAgents: Player[]
  title?: string
  description?: string
  emptyMessage?: string
  mode?: "re_sign" | "external"
  onSign: (playerId: string, offer: FreeAgentOffer) => void
}

export function FreeAgencyPanel({
  league,
  teamId,
  freeAgents,
  title = "Free agency",
  description = "Sign available free agents during the offseason.",
  emptyMessage = "No free agents are currently available.",
  mode = "external",
  onSign,
}: FreeAgencyPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [years, setYears] = useState(2)
  const [salary, setSalary] = useState(5)

  const selected = freeAgents.find((player) => player.id === selectedId)
  const offer: FreeAgentOffer = {
    years,
    firstYearSalary: salary,
  }
  const validation =
    selected && teamId
      ? canSignPlayer(league, teamId, selected.id, offer)
      : null

  const sorted = [...freeAgents].sort(
    (a, b) => b.ratings.overall - a.ratings.overall,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead>Pos</TableHead>
              <TableHead>OVR</TableHead>
              <TableHead>Age</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-sm text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : null}
            {sorted.slice(0, 20).map((player) => (
              <TableRow key={player.id}>
                <TableCell>
                  {player.firstName} {player.lastName}
                </TableCell>
                <TableCell>{player.position}</TableCell>
                <TableCell>{player.ratings.overall}</TableCell>
                <TableCell>{player.age}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant={selectedId === player.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedId(player.id)
                      setSalary(Math.max(2, Math.round(player.ratings.overall / 8)))
                    }}
                  >
                    {mode === "re_sign" ? "Re-sign" : "Offer"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {selected ? (
          <div className="flex flex-col gap-3 rounded-lg border p-4">
            <p className="text-sm font-medium">
              Offer for {selected.firstName} {selected.lastName}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                Years
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={years}
                  onChange={(event) => setYears(Number(event.target.value))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                First-year salary (M)
                <Input
                  type="number"
                  min={1}
                  step={0.1}
                  value={salary}
                  onChange={(event) => setSalary(Number(event.target.value))}
                />
              </label>
            </div>
            {validation && !validation.ok ? (
              <p className="text-xs text-destructive">{validation.reason}</p>
            ) : null}
            <Button
              disabled={!validation?.ok}
              onClick={() => onSign(selected.id, offer)}
            >
              {mode === "re_sign" ? "Re-sign" : "Sign"} for {formatMoney(salary)} ×{" "}
              {years} yr
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
