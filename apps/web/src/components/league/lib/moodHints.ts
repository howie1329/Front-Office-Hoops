import type { PlayerMood } from "@workspace/shared/types"

type MoodDimension = keyof PlayerMood

const MOOD_LABELS: Record<MoodDimension, string> = {
  money: "Money",
  winning: "Winning",
  loyalty: "Loyalty",
  fame: "Fame",
}

function moodHint(dimension: MoodDimension, value: number): string {
  switch (dimension) {
    case "money":
      if (value >= 65) return "Salary-driven in negotiations"
      if (value <= 35) return "Flexible on pay for the right fit"
      return "Balanced on contract demands"
    case "winning":
      if (value >= 65) return "Prioritizes contender fit"
      if (value <= 35) return "Open to rebuilding situations"
      return "Weighs role and opportunity"
    case "loyalty":
      if (value >= 65) return "Strong re-sign lean with current team"
      if (value <= 35) return "Likely to shop the market"
      return "Mixed on staying vs. leaving"
    case "fame":
      if (value >= 65) return "Market visibility matters"
      if (value <= 35) return "Comfortable in low-profile roles"
      return "Moderate spotlight preference"
  }
}

export type MoodHintRow = {
  label: string
  value: number
  hint: string
}

export function getPlayerMoodHints(
  mood: PlayerMood,
  options: {
    isOwnRoster: boolean
    teamScoutingLevel: number
  },
): MoodHintRow[] | null {
  if (options.isOwnRoster || options.teamScoutingLevel >= 8) {
    return (Object.keys(MOOD_LABELS) as MoodDimension[]).map((dimension) => ({
      label: MOOD_LABELS[dimension],
      value: mood[dimension],
      hint: moodHint(dimension, mood[dimension]),
    }))
  }

  if (options.teamScoutingLevel >= 5) {
    const dominant = (Object.keys(MOOD_LABELS) as MoodDimension[]).sort(
      (left, right) => mood[right] - mood[left],
    )[0]!

    return [
      {
        label: MOOD_LABELS[dominant],
        value: mood[dominant],
        hint: `${moodHint(dominant, mood[dominant])} (primary motivation)`,
      },
    ]
  }

  return null
}
