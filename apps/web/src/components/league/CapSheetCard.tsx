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
    contractPayroll,
    deadCapPayroll,
    payroll,
    capSpace,
    taxBill,
    teamFinance,
    isOverTax,
    isRepeater,
    repeaterSurcharge,
    roomMleEligible,
    activeTpe,
  } = financials

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle>Cap sheet</CardTitle>
        <CardDescription>
          {formatMarketTier(teamFinance.spendingProfile.marketTier)} ·{" "}
          {formatTolerance(teamFinance.spendingProfile.taxTolerance)} ·{" "}
          {formatTeamMode(teamFinance.strategy.mode)}
          {isRepeater ? " · Repeater taxpayer" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <CapMetric
          label="Salary cap"
          value={formatMoney(seasonFinancials.salaryCap)}
        />
        <CapMetric label="Contract payroll" value={formatMoney(contractPayroll)} />
        {deadCapPayroll > 0 ? (
          <CapMetric
            label="Dead cap"
            value={formatMoney(deadCapPayroll)}
            tone="destructive"
          />
        ) : null}
        <CapMetric label="Total payroll" value={formatMoney(payroll)} />
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
        {isRepeater ? (
          <CapMetric
            label="Repeater surcharge"
            value={formatMoney(repeaterSurcharge)}
            tone="destructive"
          />
        ) : null}
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
        <CapMetric
          label="Room MLE"
          value={
            roomMleEligible
              ? formatMoney(teamFinance.roomMleRemaining)
              : "Not eligible"
          }
        />
        {activeTpe.length > 0 ? (
          <div className="rounded-md border bg-muted/20 px-3 py-2">
            <p className="mb-1 text-muted-foreground">Trade exceptions</p>
            <ul className="space-y-1 text-xs">
              {activeTpe.map((tpe) => (
                <li key={tpe.id} className="flex justify-between gap-3">
                  <span>{tpe.originDescription}</span>
                  <span>
                    {formatMoney(tpe.amount)} · exp S{tpe.expiresSeason}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <CapMetric
          label="Scouting level"
          value={`${teamFinance.scoutingLevel} / 10`}
        />
        {teamFinance.consecutiveTaxSeasons > 0 ? (
          <CapMetric
            label="Consecutive tax seasons"
            value={String(teamFinance.consecutiveTaxSeasons)}
          />
        ) : null}
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
