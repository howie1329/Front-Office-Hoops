import { computeVeteranMentorshipModifier } from "./modifiers/veteranMentorship"
import type { DevelopmentContext, DevelopmentModifier } from "./types"

export function collectModifiers(context: DevelopmentContext): DevelopmentModifier[] {
  const modifiers: DevelopmentModifier[] = []
  const veteranModifier = computeVeteranMentorshipModifier(context)

  if (veteranModifier) {
    modifiers.push(veteranModifier)
  }

  return modifiers
}
