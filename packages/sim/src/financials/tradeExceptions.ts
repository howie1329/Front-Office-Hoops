import type { TradeException } from "@workspace/shared/financialTypes"

import { roundMoney } from "./capMath"

export function createTradeException({
  teamId,
  amount,
  season,
  description,
}: {
  teamId: string
  amount: number
  season: number
  description: string
}): TradeException {
  return {
    id: `tpe_${teamId}_${season}_${Math.round(amount * 10)}`,
    amount: roundMoney(amount),
    createdSeason: season,
    expiresSeason: season + 1,
    originDescription: description,
  }
}

export function consumeTradeExceptions(
  tradeExceptions: TradeException[],
  amountNeeded: number,
): {
  tradeExceptions: TradeException[]
  amountConsumed: number
} {
  let remaining = roundMoney(amountNeeded)
  const next: TradeException[] = []
  let consumed = 0

  for (const tpe of [...tradeExceptions].sort((a, b) => a.expiresSeason - b.expiresSeason)) {
    if (remaining <= 0) {
      next.push(tpe)
      continue
    }

    if (tpe.amount <= remaining) {
      consumed = roundMoney(consumed + tpe.amount)
      remaining = roundMoney(remaining - tpe.amount)
      continue
    }

    consumed = roundMoney(consumed + remaining)
    next.push({
      ...tpe,
      amount: roundMoney(tpe.amount - remaining),
    })
    remaining = 0
  }

  return { tradeExceptions: next, amountConsumed: consumed }
}

export function getAvailableTpeAmount(tradeExceptions: TradeException[]): number {
  return roundMoney(tradeExceptions.reduce((sum, tpe) => sum + tpe.amount, 0))
}
