import type { DraftInfo, DraftProspect, DraftPick, Player } from "@workspace/shared/types"

export function convertProspectToPlayer(
  prospect: DraftProspect,
  pick: DraftPick,
  draftInfo: DraftInfo,
): Player {
  return {
    id: `p_draft_${draftInfo.year}_${draftInfo.overallPick}`,
    teamId: pick.teamId,
    firstName: prospect.firstName,
    lastName: prospect.lastName,
    age: prospect.age,
    peakAge: prospect.peakAge,
    heightInches: prospect.heightInches,
    weightLbs: prospect.weightLbs,
    position: prospect.position,
    ratings: { ...prospect.ratings },
    tags: [...prospect.tags],
    status: "active",
    injury: null,
    draftInfo,
    activeContractId: null,
    seasonsWithTeam: 0,
    yearsOfService: 0,
  }
}

export function convertProspectToFreeAgent(prospect: DraftProspect): Player {
  return {
    id: `p_fa_${prospect.id}`,
    teamId: null,
    firstName: prospect.firstName,
    lastName: prospect.lastName,
    age: prospect.age,
    peakAge: prospect.peakAge,
    heightInches: prospect.heightInches,
    weightLbs: prospect.weightLbs,
    position: prospect.position,
    ratings: { ...prospect.ratings },
    tags: [...prospect.tags],
    status: "free_agent",
    injury: null,
    draftInfo: null,
    activeContractId: null,
    seasonsWithTeam: 0,
    yearsOfService: Math.max(0, prospect.age - 19),
  }
}
