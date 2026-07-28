import { useEffect, useState } from "react"

import type {
  LeagueRecord,
  StaffExtensionOffer,
  StaffMember,
} from "@workspace/shared/types"
import { getStaffEmploymentSeason, getStaffPayroll } from "@workspace/sim"

import { formatMoney } from "@/components/league/lib/moneyFormat"
import { formatStaffRole } from "@/components/league/staff/staffLabels"
import {
  estimateOfferPayroll,
  formatStaffContractLabel,
  formatStaffSalaryLabel,
  getActiveStaffContract,
  getCurrentStaffSalary,
  getStaffYearsRemaining,
} from "@/components/league/staff/staffSelectors"
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

type ExtendStaffDialogProps = {
  league: LeagueRecord
  teamId: string
  member: StaffMember | null
  staffBudget: number
  staffPayroll: number
  onClose: () => void
  onConfirm: (staffId: string, offer: StaffExtensionOffer) => void
}

export function ExtendStaffDialog({
  league,
  teamId,
  member,
  staffBudget,
  staffPayroll: _staffPayroll,
  onClose,
  onConfirm,
}: ExtendStaffDialogProps) {
  const season = getStaffEmploymentSeason(league)
  const contract = member
    ? getActiveStaffContract(league, member.id, teamId)
    : undefined
  const currentSalary = getCurrentStaffSalary(contract, season)
  const yearsRemaining = getStaffYearsRemaining(contract, season)

  const [years, setYears] = useState(2)
  const [salary, setSalary] = useState(currentSalary || 1)

  useEffect(() => {
    if (!member || !contract) {
      return
    }
    setYears(2)
    setSalary(currentSalary > 0 ? currentSalary : 1)
  }, [contract, currentSalary, member?.id])

  const extensionTotal = estimateOfferPayroll(salary, years)
  const extensionStartSeason = (contract?.endSeason ?? season - 1) + 1
  const payrollForecast = Array.from({ length: years }, (_, index) => {
    const salaryForSeason = Math.round(salary * (1 + index * 0.05) * 10) / 10
    return {
      season: extensionStartSeason + index,
      payroll:
        getStaffPayroll(teamId, league.staffContracts, extensionStartSeason + index) +
        salaryForSeason,
    }
  })
  const overBudget = payrollForecast.some((entry) => entry.payroll > staffBudget)
  const canSubmit =
    member && contract && years >= 1 && salary > 0 && !overBudget

  return (
    <Dialog open={Boolean(member)} onOpenChange={(open) => !open && onClose()}>
      {member && contract ? (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Extend {member.firstName} {member.lastName}
            </DialogTitle>
            <DialogDescription>
              Add a new deal after the current contract ends. The existing
              contract remains in the staff history.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 overflow-auto p-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <OfferMetric label="Role" value={formatStaffRole(member.role)} />
              <OfferMetric
                label="Current salary"
                value={formatStaffSalaryLabel(contract, season)}
              />
              <OfferMetric
                label="Contract"
                value={formatStaffContractLabel(contract, season)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="extend-years">New years</Label>
                <Input
                  id="extend-years"
                  type="number"
                  min={1}
                  max={4}
                  value={years}
                  onChange={(event) => setYears(Number(event.target.value))}
                />
                <p className="text-[0.625rem] text-muted-foreground">
                  {yearsRemaining} year{yearsRemaining === 1 ? "" : "s"} left on
                  current deal
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="extend-salary">First-year salary (M)</Label>
                <Input
                  id="extend-salary"
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={salary}
                  onChange={(event) => setSalary(Number(event.target.value))}
                />
              </div>
            </div>

            <div className="grid gap-1 text-xs text-muted-foreground">
              {payrollForecast.map((entry) => (
                <div key={entry.season} className="flex justify-between gap-4">
                  <span>Season {entry.season} payroll</span>
                  <span className={entry.payroll > staffBudget ? "text-destructive" : undefined}>
                    {formatMoney(entry.payroll)} / {formatMoney(staffBudget)}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Total contract value: {formatMoney(extensionTotal)}.
            </p>

            {overBudget ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                Extension exceeds the annual staff budget.
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!canSubmit}
              onClick={() =>
                onConfirm(member.id, { years, firstYearSalary: salary })
              }
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
