import type { FreeAgentOffer, TradeProposal } from "@workspace/shared/types"

export type LeagueCommand =
  | { type: "simDay" }
  | { type: "simWeek" }
  | { type: "simSeason" }
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
  | { type: "simulatePlayoffs" }
  | { type: "startNextSeason" }

export type PhaseGatedCommand = Extract<
  LeagueCommand,
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
  | "beginPlayoffs"
  | "beginOffseason"
  | "simAiReSignings"
  | "proceedToDraft"
  | "prepareDraft"
  | "proceedToFreeAgency"
  | "simAiFreeAgency"
  | "startNextSeason" {
  switch (command.type) {
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
