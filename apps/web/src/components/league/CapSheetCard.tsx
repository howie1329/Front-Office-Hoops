import type { LeagueRecord } from "@workspace/shared/types"

import {
  formatMarketTier,
  formatMoney,
  formatTeamMode,
  formatTolerance,
} from "@/components/league/lib/moneyFormat"
import { useTeamFinancials } from "@/hooks/useTeamFinancials"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

type CapSheetCardProps = {
  league: LeagueRecord
  teamId: string
}

export function CapSheetCard({ league, teamId }: CapSheetCardProps) {
  const financials = useTeamFinancials(league, teamId)

  if (!financials?.teamFinance) {
    return null
  }

  const { seasonFinancials, payroll, capSpace, taxBill, teamFinance, isOverTax } =
    financials

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cap sheet</CardTitle>
        <CardDescription>
          {formatMarketTier(teamFinance.spendingProfile.marketTier)} ·{" "}
          {formatTolerance(teamFinance.spendingProfile.taxTolerance)} ·{" "}
          {formatTeamMode(teamFinance.strategy.mode)}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Salary cap</span>
          <span>{formatMoney(seasonFinancials.salaryCap)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Payroll</span>
          <span>{formatMoney(payroll)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Cap space</span>
          <span className={capSpace < 0 ? "text-destructive" : undefined}>
            {formatMoney(capSpace)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Tax line</span>
          <span>{formatMoney(seasonFinancials.luxuryTaxLine)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Projected tax</span>
          <span className={isOverTax ? "text-destructive" : undefined}>
            {formatMoney(taxBill)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Cash</span>
          <span>{formatMoney(teamFinance.cashReserves)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Debt</span>
          <span className={teamFinance.debt > 0 ? "text-destructive" : undefined}>
            {formatMoney(teamFinance.debt)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Team mode</span>
          <span>{formatTeamMode(teamFinance.strategy.mode)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">MLE remaining</span>
          <span>{formatMoney(teamFinance.mleRemaining)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
