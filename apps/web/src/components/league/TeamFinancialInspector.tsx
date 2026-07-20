import type { ReactNode } from "react"

import type { LeagueRecord } from "@workspace/shared/types"

import {
  formatMoney,
  formatTeamMode,
  formatTolerance,
} from "@/components/league/lib/moneyFormat"
import { useTeamFinancials } from "@/hooks/useTeamFinancials"
import { cn } from "@workspace/ui/lib/utils"

type TeamFinancialInspectorProps = {
  league: LeagueRecord
  teamId: string
  cutsNeeded: number
}

export function TeamFinancialInspector({
  league,
  teamId,
  cutsNeeded,
}: TeamFinancialInspectorProps) {
  const financials = useTeamFinancials(league, teamId)

  return (
    <>
      <details className="group order-first rounded-lg bg-card ring-1 ring-foreground/10 2xl:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          <span>Financials</span>
          <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
            {financials ? formatMoney(financials.capSpace) : "Unavailable"}
            <span
              aria-hidden="true"
              className="transition-transform duration-150 ease-out group-open:rotate-180 motion-reduce:transition-none"
            >
              ⌄
            </span>
          </span>
        </summary>
        <div className="border-t p-3">
          <FinancialLedger financials={financials} cutsNeeded={cutsNeeded} />
        </div>
      </details>

      <aside
        className="hidden min-h-0 flex-col overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10 2xl:flex"
        aria-label="Team financials"
      >
        <div className="shrink-0 border-b px-3 py-2.5">
          <h2 className="text-sm font-medium">Financials</h2>
          {financials ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatTeamMode(financials.teamFinance.strategy.mode)} ·{" "}
              {formatTolerance(
                financials.teamFinance.spendingProfile.taxTolerance,
              )}
            </p>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <FinancialLedger financials={financials} cutsNeeded={cutsNeeded} />
        </div>
      </aside>
    </>
  )
}

type Financials = ReturnType<typeof useTeamFinancials>

function FinancialLedger({
  financials,
  cutsNeeded,
}: {
  financials: Financials
  cutsNeeded: number
}) {
  if (!financials) {
    return (
      <p className="max-w-[55ch] text-sm text-muted-foreground">
        Financial data is unavailable. The roster remains available while the
        league record refreshes.
      </p>
    )
  }

  const activeHolds = financials.teamFinance.capHolds.filter(
    (hold) => hold.status === "active",
  )
  const tradeExceptionTotal = financials.activeTpe.reduce(
    (sum, exception) => sum + exception.amount,
    0,
  )

  return (
    <div className="space-y-4 text-xs">
      {cutsNeeded > 0 ? (
        <div className="rounded-md border border-warning/35 bg-warning/10 px-3 py-2 text-foreground">
          <p className="font-medium">
            Cut {cutsNeeded} player{cutsNeeded === 1 ? "" : "s"} to continue
          </p>
          <p className="mt-0.5 text-muted-foreground">
            The roster is above the league limit.
          </p>
        </div>
      ) : null}

      <LedgerGroup title="Cap position">
        <LedgerRow
          label="Salary cap"
          value={formatMoney(financials.seasonFinancials.salaryCap)}
        />
        <LedgerRow
          label="Contract payroll"
          value={formatMoney(financials.contractPayroll)}
        />
        {financials.capHolds > 0 ? (
          <LedgerRow
            label="Cap holds"
            value={formatMoney(financials.capHolds)}
          />
        ) : null}
        <LedgerRow
          label="Cap space"
          value={formatMoney(financials.capSpace)}
          tone={financials.capSpace < 0 ? "destructive" : "default"}
          strong
        />
      </LedgerGroup>

      <LedgerGroup title="Tax position">
        <LedgerRow
          label="Tax line"
          value={formatMoney(financials.seasonFinancials.luxuryTaxLine)}
        />
        <LedgerRow
          label="Tax payroll"
          value={formatMoney(financials.payroll)}
        />
        <LedgerRow
          label="Projected tax"
          value={formatMoney(financials.taxBill)}
          tone={financials.isOverTax ? "destructive" : "default"}
          strong
        />
      </LedgerGroup>

      <LedgerGroup title="Commitments">
        <LedgerRow
          label="Dead money"
          value={formatMoney(financials.deadCapPayroll)}
          tone={financials.deadCapPayroll > 0 ? "destructive" : "default"}
        />
        <LedgerRow
          label="Staff payroll"
          value={formatMoney(financials.teamFinance.staffPayroll)}
        />
        <LedgerRow
          label="Cash"
          value={formatMoney(financials.teamFinance.cashReserves)}
        />
        {financials.teamFinance.debt > 0 ? (
          <LedgerRow
            label="Debt"
            value={formatMoney(financials.teamFinance.debt)}
            tone="destructive"
          />
        ) : null}
      </LedgerGroup>

      <LedgerGroup title="Exceptions and holds">
        <LedgerRow
          label={
            financials.teamFinance.mleType === "taxpayer"
              ? "Taxpayer MLE"
              : "Non-taxpayer MLE"
          }
          value={formatMoney(financials.teamFinance.mleRemaining)}
        />
        <LedgerRow
          label="Room MLE"
          value={
            financials.roomMleEligible
              ? formatMoney(financials.teamFinance.roomMleRemaining)
              : "Not eligible"
          }
        />
        <LedgerRow
          label="Trade exceptions"
          value={
            financials.activeTpe.length > 0
              ? `${financials.activeTpe.length} · ${formatMoney(tradeExceptionTotal)}`
              : "None"
          }
        />
        <LedgerRow
          label="Active cap holds"
          value={activeHolds.length > 0 ? String(activeHolds.length) : "None"}
        />
      </LedgerGroup>

      <LedgerGroup title="Scouting">
        <LedgerRow
          label="Scouting level"
          value={`${financials.teamFinance.scoutingLevel} / 10`}
        />
      </LedgerGroup>
    </div>
  )
}

function LedgerGroup({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section>
      <h3 className="border-b pb-1.5 font-medium text-foreground">{title}</h3>
      <dl className="divide-y divide-border/70">{children}</dl>
    </section>
  )
}

function LedgerRow({
  label,
  value,
  tone = "default",
  strong = false,
}: {
  label: string
  value: string
  tone?: "default" | "destructive"
  strong?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="min-w-0 text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "shrink-0 text-right tabular-nums",
          strong && "font-medium",
          tone === "destructive" && "text-destructive",
        )}
      >
        {value}
      </dd>
    </div>
  )
}
