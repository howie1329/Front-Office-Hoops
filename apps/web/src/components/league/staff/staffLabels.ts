import type {
  CoachingPace,
  CoachingRotation,
  DefensiveScheme,
  OffensiveScheme,
  StaffRole,
} from "@workspace/shared/types"

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  head_coach: "Head coach",
  offensive_coordinator: "Offensive coordinator",
  defensive_coordinator: "Defensive coordinator",
  scouting_head: "Scouting head",
}

export const OFFENSIVE_SCHEME_LABELS: Record<OffensiveScheme, string> = {
  attack_rim: "Attack the rim",
  perimeter: "Perimeter offense",
  balanced: "Balanced offense",
  post_hub: "Post hub",
  pace_space: "Pace and space",
}

export const DEFENSIVE_SCHEME_LABELS: Record<DefensiveScheme, string> = {
  drop_coverage: "Drop coverage",
  switch_everything: "Switch everything",
  zone_23: "2-3 zone",
  full_court_press: "Full-court press",
  aggressive_help: "Aggressive help",
}

export const COACHING_PACE_LABELS: Record<CoachingPace, string> = {
  slow: "Slow",
  balanced: "Balanced",
  fast: "Fast",
}

export const COACHING_ROTATION_LABELS: Record<CoachingRotation, string> = {
  tight: "Tight",
  standard: "Standard",
  deep: "Deep",
}

export const STAFF_ROLES: StaffRole[] = [
  "head_coach",
  "offensive_coordinator",
  "defensive_coordinator",
  "scouting_head",
]

export function formatStaffRole(role: StaffRole): string {
  return STAFF_ROLE_LABELS[role]
}

export function formatOffensiveScheme(scheme: OffensiveScheme): string {
  return OFFENSIVE_SCHEME_LABELS[scheme]
}

export function formatDefensiveScheme(scheme: DefensiveScheme): string {
  return DEFENSIVE_SCHEME_LABELS[scheme]
}

export function formatCoachingPace(pace: CoachingPace): string {
  return COACHING_PACE_LABELS[pace]
}

export function formatCoachingRotation(rotation: CoachingRotation): string {
  return COACHING_ROTATION_LABELS[rotation]
}
