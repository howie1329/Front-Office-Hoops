import { useState } from "react"

import type {
  FreeAgentOffer,
  LeagueRecord,
  Player,
} from "@workspace/shared/types"
import {
  canSignPlayer,
  getContractOffersForCandidate,
  getPlayerOfferAttemptsRemaining,
  getPlayerContractMarketValue,
  getReSigningAttemptsRemaining,
  isPlayerOfferBlocked,
} from "@workspace/sim"

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
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
  onOffer: (playerId: string, offer: FreeAgentOffer) => void
  onAdvanceMarketDay?: () => void
}

export function FreeAgencyPanel({
  league,
  teamId,
  freeAgents,
  title = "Free agency",
  description = "Sign available free agents during the offseason.",
  emptyMessage = "No free agents are currently available.",
  mode = "external",
  onOffer,
  onAdvanceMarketDay,
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
    (a, b) => b.ratings.overall - a.ratings.overall
  )

  function openOffer(player: Player) {
    setSelectedId(player.id)
    setYears(2)
    setSalary(Math.max(2, Math.round(player.ratings.overall / 8)))
  }

  function closeOffer() {
    setSelectedId(null)
  }

  function submitOffer() {
    if (!selected || !validation?.ok) {
      return
    }

    onOffer(selected.id, offer)
    closeOffer()
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            {mode === "external" && onAdvanceMarketDay ? (
              <Button size="sm" onClick={onAdvanceMarketDay}>
                Advance market day
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="min-h-0 overflow-hidden">
          <div className="-m-px max-h-[420px] overflow-auto p-px">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Pos</TableHead>
                  <TableHead>OVR</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Offers</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-sm text-muted-foreground"
                    >
                      {emptyMessage}
                    </TableCell>
                  </TableRow>
                ) : null}
                {sorted.slice(0, 20).map((player) => {
                  const market = getPlayerContractMarketValue(league, player)
                  const activeOffers = getContractOffersForCandidate(
                    league,
                    player.id,
                    "player",
                    mode === "re_sign" ? "re_signing" : "free_agency",
                  ).filter((entry) => entry.status === "pending")
                  const sortedOffers = [...activeOffers].sort(
                    (a, b) => b.firstYearSalary - a.firstYearSalary,
                  )
                  const bestOfferText =
                    sortedOffers.length > 0
                      ? `${formatMoney(sortedOffers[0].firstYearSalary)} x ${sortedOffers[0].years}`
                      : "None"
                  const attemptsRemaining =
                    mode === "re_sign"
                      ? getReSigningAttemptsRemaining(league, player.id, teamId)
                      : getPlayerOfferAttemptsRemaining(
                          league,
                          player.id,
                          teamId,
                          "free_agency",
                        )
                  const isBlocked =
                    mode === "re_sign"
                      ? attemptsRemaining === 0
                      : isPlayerOfferBlocked(
                          league,
                          player.id,
                          teamId,
                          "free_agency",
                        )

                  return (
                    <TableRow key={player.id}>
                      <TableCell>
                        {player.firstName} {player.lastName}
                      </TableCell>
                      <TableCell>{player.position}</TableCell>
                      <TableCell>{player.ratings.overall}</TableCell>
                      <TableCell>{player.age}</TableCell>
                      <TableCell className="tabular-nums">
                        {formatMoney(market.lowSalary)}-
                        {formatMoney(market.highSalary)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {bestOfferText}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {isBlocked ? "Cooldown" : attemptsRemaining}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isBlocked}
                          onClick={() => openOffer(player)}
                        >
                          {mode === "re_sign" ? "Offer" : "Offer"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && closeOffer()}
      >
        {selected ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {mode === "re_sign" ? "Re-sign" : "Offer"} {selected.firstName}{" "}
                {selected.lastName}
              </DialogTitle>
              <DialogDescription>
                Set years and first-year salary, then submit the offer for
                evaluation.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 overflow-auto p-4">
              <div className="grid gap-2 sm:grid-cols-3">
                <OfferMetric label="Position" value={selected.position} />
                <OfferMetric
                  label="Overall"
                  value={String(selected.ratings.overall)}
                />
                <OfferMetric label="Age" value={String(selected.age)} />
              </div>

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
                <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                  {validation.reason}
                </p>
              ) : null}
              {validation?.ok ? (
                <p className="rounded-md border bg-muted/25 p-2 text-xs text-muted-foreground">
                  Offer is valid via{" "}
                  {validation.signingException?.replaceAll("_", " ") ??
                    "standard signing"}
                  .
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeOffer}>
                Cancel
              </Button>
              <Button disabled={!validation?.ok} onClick={submitOffer}>
                Offer{" "}
                {formatMoney(salary)} × {years} yr
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  )
}

function OfferMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium tabular-nums">{value}</div>
    </div>
  )
}
