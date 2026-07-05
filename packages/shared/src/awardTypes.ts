export type SeasonAwardType =
  | "mvp"
  | "dpoy"
  | "roy"
  | "finals_mvp"
  | "all_league_first"
  | "all_defense_first"

export type SeasonAward = {
  id: string
  season: number
  type: SeasonAwardType
  playerId: string
  teamId: string
  rank: number
}
