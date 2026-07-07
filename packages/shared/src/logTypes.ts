export type LeagueLogEntryType =
  | "trade"
  | "signing"
  | "release"
  | "draft_selection"
  | "award"
  | "owner_goal"
  | "owner_trust"
  | "option"
  | "contract_extension"

export type LeagueLogEntry = {
  id: string
  season: number
  day: number
  dateLabel: string
  type: LeagueLogEntryType
  teamId?: string
  playerId?: string
  payload: Record<string, string | number | boolean | string[] | number[]>
  createdAt: string
}
