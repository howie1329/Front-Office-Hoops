export type StaffContractStatus = "active" | "expired" | "fired"

export type StaffContract = {
  id: string
  staffId: string
  teamId: string
  startSeason: number
  endSeason: number
  yearlySalaries: number[]
  status: StaffContractStatus
  signedSeason: number
}
