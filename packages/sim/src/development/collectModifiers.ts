import { computeVeteranMentorshipModifier } from "./modifiers/veteranMentorship"
import { computeRoleMinutesModifier } from "./modifiers/roleMinutes"
import type { DevelopmentContext, DevelopmentModifier } from "./types"

export function collectModifiers(context: DevelopmentContext): DevelopmentModifier[] {
  const modifiers: DevelopmentModifier[] = []
  const veteranModifier = computeVeteranMentorshipModifier(context)
  const roleMinutesModifier = computeRoleMinutesModifier(context)

  if (veteranModifier) {
    modifiers.push(veteranModifier)
  }
  if (roleMinutesModifier) {
    modifiers.push(roleMinutesModifier)
  }

  return modifiers
}
