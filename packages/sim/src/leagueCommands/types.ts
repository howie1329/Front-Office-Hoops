import type { AdvanceTarget } from "./advanceTypes"
import type { FreeAgentOffer, TradeProposal } from "@workspace/shared/types"

export type { AdvanceTarget } from "./advanceTypes"

export type LeagueCommand =
  | { type: "advance"; target: AdvanceTarget }
  | { type: "simDay" }
  | { type: "simWeek" }
  | { type: "simSeason" }
  | { type: "beginRegularSeason" }
  | { type: "skipRemainingExhibitions" }
  | { type: "beginPlayoffs" }
  | { type: "beginOffseason" }
  | { type: "completeReSignings" }
  | { type: "advanceToDraft" }
  | { type: "prepareDraft" }
  | { type: "makeDraftPick"; prospectId: string }
  | { type: "simAiPick" }
  | { type: "simToUserPick" }
  | { type: "advanceToFreeAgency" }
  | { type: "completeFreeAgency" }
  | { type: "releasePlayer"; playerId: string }
  | { type: "signFreeAgent"; playerId: string; offer: FreeAgentOffer }
  | { type: "executeTrade"; proposal: TradeProposal }
  | { type: "acceptTradeOffer"; offerId: string }
  | { type: "rejectTradeOffer"; offerId: string }
  | { type: "simulateCurrentPlayoffRound" }
  | { type: "simulatePlayoffs" }
  | { type: "startNextSeason" }

export type PhaseGatedCommand = Extract<
  LeagueCommand,
  | { type: "beginRegularSeason" }
  | { type: "beginPlayoffs" }
  | { type: "beginOffseason" }
  | { type: "completeReSignings" }
  | { type: "advanceToDraft" }
  | { type: "prepareDraft" }
  | { type: "advanceToFreeAgency" }
  | { type: "completeFreeAgency" }
  | { type: "startNextSeason" }
>

export function getPhaseActionForCommand(
  command: PhaseGatedCommand
):
  | "beginRegularSeason"
  | "beginPlayoffs"
  | "beginOffseason"
  | "simAiReSignings"
  | "proceedToDraft"
  | "prepareDraft"
  | "proceedToFreeAgency"
  | "simAiFreeAgency"
  | "startNextSeason" {
  switch (command.type) {
    case "beginRegularSeason":
      return "beginRegularSeason"
    case "beginPlayoffs":
      return "beginPlayoffs"
    case "beginOffseason":
      return "beginOffseason"
    case "completeReSignings":
      return "simAiReSignings"
    case "advanceToDraft":
      return "proceedToDraft"
    case "prepareDraft":
      return "prepareDraft"
    case "advanceToFreeAgency":
      return "proceedToFreeAgency"
    case "completeFreeAgency":
      return "simAiFreeAgency"
    case "startNextSeason":
      return "startNextSeason"
  }
}
