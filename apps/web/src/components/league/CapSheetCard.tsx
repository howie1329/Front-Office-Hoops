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

  const {
    seasonFinancials,
    payroll,
    capSpace,
    taxBill,
    teamFinance,
    isOverTax,
  } = financials

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle>Cap sheet</CardTitle>
        <CardDescription>
          {formatMarketTier(teamFinance.spendingProfile.marketTier)} ·{" "}
          {formatTolerance(teamFinance.spendingProfile.taxTolerance)} ·{" "}
          {formatTeamMode(teamFinance.strategy.mode)}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <CapMetric
          label="Salary cap"
          value={formatMoney(seasonFinancials.salaryCap)}
        />
        <CapMetric label="Payroll" value={formatMoney(payroll)} />
        <CapMetric
          label="Cap space"
          value={formatMoney(capSpace)}
          tone={capSpace < 0 ? "destructive" : undefined}
        />
        <CapMetric
          label="Tax line"
          value={formatMoney(seasonFinancials.luxuryTaxLine)}
        />
        <CapMetric
          label="Projected tax"
          value={formatMoney(taxBill)}
          tone={isOverTax ? "destructive" : undefined}
        />
        <CapMetric label="Cash" value={formatMoney(teamFinance.cashReserves)} />
        <CapMetric
          label="Debt"
          value={formatMoney(teamFinance.debt)}
          tone={teamFinance.debt > 0 ? "destructive" : undefined}
        />
        <CapMetric
          label="MLE remaining"
          value={formatMoney(teamFinance.mleRemaining)}
        />
      </CardContent>
    </Card>
  )
}

function CapMetric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "destructive"
}) {
  return (
    <div className="flex justify-between gap-4 rounded-md border bg-muted/20 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={tone === "destructive" ? "text-destructive" : undefined}>
        {value}
      </span>
    </div>
  )
}
