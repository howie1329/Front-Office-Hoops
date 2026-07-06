import type { LeagueRecord, Rng } from "@workspace/shared/types"

import { createRng } from "../rng"
import type { LeagueCommand } from "./types"

export function commandRng(league: LeagueRecord, command: LeagueCommand): Rng {
  const { baseSeed, season } = league.seasonState
  const nonce = league.rngNonce ?? 0

  switch (command.type) {
    case "beginOffseason":
      return createRng(`${baseSeed}:offseason:${season}:nonce:${nonce}`)
    case "completeReSignings":
      return createRng(`${baseSeed}:ai-re-sign:${season}:nonce:${nonce}`)
    case "advanceToFreeAgency":
      return createRng(`${baseSeed}:fa-pool:${season}:nonce:${nonce}`)
    case "completeFreeAgency":
      return createRng(`${baseSeed}:ai-fa:${season}:nonce:${nonce}`)
    case "startNextSeason":
      return createRng(`${baseSeed}:season:${season + 1}:nonce:${nonce}`)
    default:
      return createRng(`${baseSeed}:${command.type}:${season}:nonce:${nonce}`)
  }
}
