import { formatMoney } from "@/components/league/lib/moneyFormat"
import { cn } from "@workspace/ui/lib/utils"

type StaffBudgetBarProps = {
  budget: number
  payroll: number
}

export function StaffBudgetBar({ budget, payroll }: StaffBudgetBarProps) {
  const ratio = budget > 0 ? Math.min(payroll / budget, 1.5) : 0
  const overBudget = payroll > budget
  const fillPercent = Math.min(ratio * 100, 100)

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium">Staff budget</span>
        <span className={cn(overBudget && "text-destructive")}>
          {formatMoney(payroll)} / {formatMoney(budget)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            overBudget ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${fillPercent}%` }}
        />
      </div>
      {overBudget ? (
        <p className="text-xs text-destructive">
          Payroll exceeds annual staff budget by {formatMoney(payroll - budget)}.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {formatMoney(budget - payroll)} remaining in staff budget.
        </p>
      )}
    </div>
  )
}
