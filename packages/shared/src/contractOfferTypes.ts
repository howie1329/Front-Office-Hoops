import type { SigningException } from "./contractTypes"

export type ContractCandidateType = "player" | "staff"

export type ContractMarketPhase =
  | "re_signing"
  | "staff"
  | "free_agency"
  | "extension"

export type ContractOfferStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "withdrawn"
  | "expired"

export type ContractOffer = {
  id: string
  candidateType: ContractCandidateType
  candidateId: string
  teamId: string
  phase: ContractMarketPhase
  years: number
  firstYearSalary: number
  status: ContractOfferStatus
  createdDay: number
  resolvedDay?: number
  signingException?: SigningException
  decisionReason?: string
}

export type ReSigningNegotiationStatus = "open" | "accepted" | "failed"

export type ReSigningNegotiation = {
  candidateType: ContractCandidateType
  candidateId: string
  teamId: string
  phase: ContractMarketPhase
  attemptsUsed: number
  maxAttempts: number
  status: ReSigningNegotiationStatus
}
