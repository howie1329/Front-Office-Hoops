import type { Player, SeasonState, TeamWithRoster } from "@workspace/shared/types"

import { deriveTeamOverall, recalculatePlayerRatings } from "../playerRatings"
import { completeDraftIfNeeded } from "./completeDraft"
import { convertProspectToPlayer } from "./convertProspect"
import { getCurrentDraftPick } from "./prepareDraft"

function addPlayerToTeam(
  teams: TeamWithRoster[],
  teamId: string,
  player: Player,
): TeamWithRoster[] {
  return teams.map((team) => {
    if (team.id !== teamId) {
      return team
    }

    const roster = [...team.players, player]
    const players = roster.map((entry) => ({
      ...entry,
      ratings: recalculatePlayerRatings(entry, roster),
    }))

    return {
      ...team,
      players,
      overall: deriveTeamOverall(players),
    }
  })
}

export function makeDraftPick(
  state: SeasonState,
  prospectId: string,
  freeAgentPool: Player[] = [],
): { seasonState: SeasonState; freeAgentPool: Player[] } {
  const draftState = state.draftState
  if (!draftState || draftState.completed) {
    throw new Error("Draft is not in progress")
  }

  const currentPick = getCurrentDraftPick(state)
  if (!currentPick) {
    throw new Error("No current draft pick")
  }

  const prospect = draftState.prospects.find((entry) => entry.id === prospectId)
  if (!prospect) {
    throw new Error(`Prospect not available: ${prospectId}`)
  }

  const draftInfo = {
    year: draftState.year,
    round: currentPick.round,
    overallPick: currentPick.overallPick,
    originalTeamId: currentPick.teamId,
  }
  const player = convertProspectToPlayer(prospect, currentPick, draftInfo)
  const teams = addPlayerToTeam(state.teams, currentPick.teamId, player)
  const order = draftState.order.map((pick, index) =>
    index === draftState.currentPickIndex ? { ...pick, playerId: player.id } : pick,
  )
  const selections = [
    ...draftState.selections,
    {
      overallPick: currentPick.overallPick,
      round: currentPick.round,
      teamId: currentPick.teamId,
      playerId: player.id,
      prospectId: prospect.id,
    },
  ]

  const nextState: SeasonState = {
    ...state,
    teams,
    draftState: {
      ...draftState,
      prospects: draftState.prospects.filter((entry) => entry.id !== prospect.id),
      order,
      selections,
      currentPickIndex: draftState.currentPickIndex + 1,
    },
  }

  return completeDraftIfNeeded(nextState, freeAgentPool)
}
