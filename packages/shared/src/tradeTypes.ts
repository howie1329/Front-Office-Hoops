export type TradeSide = {
  teamId: string
  playerIds: string[]
  pickIds?: string[]
}

export type TradeProposal = {
  from: TradeSide
  to: TradeSide
}

export type TradeValidationResult = { ok: true } | { ok: false; reason: string }

export type TradeEvaluation = {
  teamId: string
  incomingValue: number
  outgoingValue: number
  netValue: number
}

export type TradeResult = {
  proposal: TradeProposal
  evaluations: TradeEvaluation[]
}

export type TradeHistoryTeamEntry = {
  teamId: string
  sentPlayerIds: string[]
  receivedPlayerIds: string[]
  sentPickIds: string[]
  receivedPickIds: string[]
  outgoingSalary: number
  incomingSalary: number
  netValue: number
}

export type TradeHistoryEntry = {
  id: string
  season: number
  day: number
  phase: string
  createdAt: string
  teams: TradeHistoryTeamEntry[]
}

export type PendingTradeOfferStatus = "pending" | "accepted" | "rejected" | "expired"

export type PendingTradeOffer = {
  id: string
  fromTeamId: string
  toTeamId: string
  proposal: TradeProposal
  createdDay: number
  expiresDay: number
  status: PendingTradeOfferStatus
  initiatorTeamId: string
}
