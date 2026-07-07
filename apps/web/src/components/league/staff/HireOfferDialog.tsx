import { useEffect, useState } from "react"

import type { StaffMember, StaffOffer } from "@workspace/shared/types"

import { formatMoney } from "@/components/league/lib/moneyFormat"
import { formatStaffRole } from "@/components/league/staff/staffLabels"
import {
  defaultHireSalary,
  estimateOfferPayroll,
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

type HireOfferDialogProps = {
  member: StaffMember | null
  staffBudget: number
  staffPayroll: number
  roleFilled: boolean
  onClose: () => void
  onConfirm: (staffId: string, offer: StaffOffer) => void
}

export function HireOfferDialog({
  member,
  staffBudget,
  staffPayroll,
  roleFilled,
  onClose,
  onConfirm,
}: HireOfferDialogProps) {
  const [years, setYears] = useState(2)
  const [salary, setSalary] = useState(1)

  useEffect(() => {
    if (!member) {
      return
    }
    setYears(2)
    setSalary(defaultHireSalary(member.ratings.overall))
  }, [member?.id, member?.ratings.overall])

  const offerTotal = estimateOfferPayroll(salary, years)
  const remainingBudget = staffBudget - staffPayroll
  const overBudget = offerTotal > remainingBudget
  const canSubmit = member && !roleFilled && years >= 1 && salary > 0 && !overBudget

  return (
    <Dialog open={Boolean(member)} onOpenChange={(open) => !open && onClose()}>
      {member ? (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Hire {member.firstName} {member.lastName}
            </DialogTitle>
            <DialogDescription>
              Offer a contract to this {formatStaffRole(member.role).toLowerCase()}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 overflow-auto p-4">
            <div className="grid gap-2 sm:grid-cols-3">
              <OfferMetric label="Role" value={formatStaffRole(member.role)} />
              <OfferMetric label="Overall" value={String(member.ratings.overall)} />
              <OfferMetric
                label="Budget room"
                value={formatMoney(remainingBudget)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="hire-years">Years</Label>
                <Input
                  id="hire-years"
                  type="number"
                  min={1}
                  max={4}
                  value={years}
                  onChange={(event) => setYears(Number(event.target.value))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="hire-salary">First-year salary (M)</Label>
                <Input
                  id="hire-salary"
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={salary}
                  onChange={(event) => setSalary(Number(event.target.value))}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Total offer value: {formatMoney(offerTotal)} over {years} year
              {years === 1 ? "" : "s"}.
            </p>

            {roleFilled ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                This role is already filled on your staff.
              </p>
            ) : null}
            {overBudget ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                Offer exceeds remaining staff budget.
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
              Hire for {formatMoney(salary)} × {years} yr
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
