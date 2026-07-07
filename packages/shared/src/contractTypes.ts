export type ContractType =
  | "standard"
  | "rookie_scale"
  | "minimum"
  | "non_guaranteed"

export type SigningException =
  | "cap_room"
  | "bird"
  | "early_bird"
  | "non_bird"
  | "mle_non_taxpayer"
  | "mle_taxpayer"
  | "mle_room"
  | "minimum"
  | "rookie_scale"

export type ContractOption = {
  yearIndex: number
  type: "team" | "player"
}

export type ContractStatus = "active" | "expired" | "waived" | "declined"

export type Contract = {
  id: string
  playerId: string
  teamId: string
  startSeason: number
  endSeason: number
  yearlySalaries: number[]
  contractType: ContractType
  signingException: SigningException
  options?: ContractOption[]
  status: ContractStatus
  signedSeason: number
  tradableAfterDay?: number | null
}

export type FreeAgentOffer = {
  years: number
  firstYearSalary: number
  signingException?: SigningException
}
