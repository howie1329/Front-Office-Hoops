import type { DraftProspect, TeamWithRoster } from "@workspace/shared/types"

export function aiSelectProspect(
  team: TeamWithRoster,
  prospects: DraftProspect[],
): DraftProspect {
  if (prospects.length === 0) {
    throw new Error("No prospects available for AI draft selection")
  }

  const positionCounts = new Map<string, number>()
  for (const player of team.players) {
    positionCounts.set(player.position, (positionCounts.get(player.position) ?? 0) + 1)
  }

  const scored = prospects.map((prospect) => {
    const positionCount = positionCounts.get(prospect.position) ?? 0
    const needBonus = positionCount < 2 ? 2 : 0
    return {
      prospect,
      score: prospect.ratings.potential + needBonus,
    }
  })

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }
    return a.prospect.id.localeCompare(b.prospect.id)
  })

  return scored[0]!.prospect
}
