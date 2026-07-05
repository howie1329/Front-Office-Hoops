import type { LeagueRecord, Rng } from "@workspace/shared/types"

import { createRng } from "../rng"
import type { LeagueCommand } from "./types"

export function commandRng(league: LeagueRecord, command: LeagueCommand): Rng {
  const { baseSeed, season } = league.seasonState

  switch (command.type) {
    case "beginOffseason":
      return createRng(`${baseSeed}:offseason:${season}`)
    case "completeReSignings":
      return createRng(`${baseSeed}:ai-re-sign:${season}`)
    case "advanceToFreeAgency":
      return createRng(`${baseSeed}:fa-pool:${season}`)
    case "completeFreeAgency":
      return createRng(`${baseSeed}:ai-fa:${season}`)
    case "startNextSeason":
      return createRng(`${baseSeed}:season:${season + 1}`)
    default:
      return createRng(`${baseSeed}:${command.type}:${season}`)
  }
}
