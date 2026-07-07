import { useEffect, useState } from "react"

import { formatMoney } from "@/components/league/lib/moneyFormat"
import { canExtendContract, getExtensionBounds } from "@workspace/sim"
import type { ExtensionOffer, LeagueRecord } from "@workspace/shared/types"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

export type ExtendContractDialogProps = {
  league: LeagueRecord
  teamId: string
  playerId: string
  playerName: string
  position: string
  overall: number
  currentSalary: number
  open: boolean
  onClose: () => void
  onConfirm: (playerId: string, offer: ExtensionOffer) => void
}

export function ExtendContractDialog({
  league,
  teamId,
  playerId,
  playerName,
  position,
  overall,
  currentSalary,
  open,
  onClose,
  onConfirm,
}: ExtendContractDialogProps) {
  const bounds = open ? getExtensionBounds(league, playerId) : null
  const [years, setYears] = useState(2)
  const [salary, setSalary] = useState(5)

  useEffect(() => {
    if (!bounds) {
      return
    }
    setYears(bounds.minYears)
    setSalary(Math.round(bounds.minSalary * 10) / 10)
  }, [bounds, playerId])

  const offer: ExtensionOffer = {
    years,
    firstYearSalary: salary,
  }
  const validation = bounds
    ? canExtendContract(league, teamId, playerId, offer)
    : null

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      {bounds ? (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend {playerName}</DialogTitle>
            <DialogDescription>
              New years are added after the current contract. First-year extension
              salary applies when the current deal ends.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 overflow-auto p-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <OfferMetric label="Position" value={position} />
              <OfferMetric label="Overall" value={String(overall)} />
              <OfferMetric
                label="Current salary"
                value={formatMoney(currentSalary)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="extension-years">New years</Label>
                <Input
                  id="extension-years"
                  type="number"
                  min={bounds.minYears}
                  max={bounds.maxYears}
                  value={years}
                  onChange={(event) => setYears(Number(event.target.value))}
                />
                <p className="text-[0.625rem] text-muted-foreground">
                  {bounds.minYears}–{bounds.maxYears} years allowed
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="extension-salary">First extension year (M)</Label>
                <Input
                  id="extension-salary"
                  type="number"
                  min={bounds.minSalary}
                  max={bounds.maxSalary}
                  step={0.1}
                  value={salary}
                  onChange={(event) => setSalary(Number(event.target.value))}
                />
                <p className="text-[0.625rem] text-muted-foreground">
                  {formatMoney(bounds.minSalary)}–{formatMoney(bounds.maxSalary)}
                </p>
              </div>
            </div>

            {validation && !validation.ok ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                {validation.reason}
              </p>
            ) : null}
            {validation?.ok ? (
              <p className="rounded-md border bg-muted/25 p-2 text-xs text-muted-foreground">
                Extension offer is valid under current CBA rules.
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!validation?.ok}
              onClick={() => onConfirm(playerId, offer)}
            >
              Extend for {formatMoney(salary)} × {years} yr
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
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
