import { RATING_MAX, RATING_MIN } from "@workspace/shared/constants"
import type { PlayerPosition, Rng } from "@workspace/shared/types"

type PhysicalProfile = {
  heightInches: number
  weightLbs: number
  wingspanInches: number
  reachRating: number
}

const POSITION_PHYSICAL: Record<
  PlayerPosition,
  { heightMean: number; heightStd: number; bmiMean: number; bmiStd: number }
> = {
  PG: { heightMean: 74, heightStd: 1.5, bmiMean: 22.5, bmiStd: 1.2 },
  SG: { heightMean: 76, heightStd: 1.5, bmiMean: 23.0, bmiStd: 1.2 },
  SF: { heightMean: 78, heightStd: 1.5, bmiMean: 23.5, bmiStd: 1.2 },
  PF: { heightMean: 80, heightStd: 1.5, bmiMean: 24.5, bmiStd: 1.3 },
  C: { heightMean: 82, heightStd: 1.8, bmiMean: 25.5, bmiStd: 1.4 },
}

function inchesToMeters(inches: number): number {
  return inches * 0.0254
}

function poundsToKg(lbs: number): number {
  return lbs * 0.453592
}

function bmiFrom(heightInches: number, weightLbs: number): number {
  const meters = inchesToMeters(heightInches)
  const kg = poundsToKg(weightLbs)
  return kg / (meters * meters)
}

function weightFromBmi(heightInches: number, bmi: number): number {
  const meters = inchesToMeters(heightInches)
  const kg = bmi * meters * meters
  return Math.round(kg / 0.453592)
}

function deriveReachRating(
  heightInches: number,
  wingspanInches: number,
): number {
  const wingspanAdvantage = wingspanInches - heightInches
  const raw = 52 + heightInches * 0.55 + wingspanAdvantage * 4
  return Math.round(Math.max(RATING_MIN, Math.min(RATING_MAX, raw)))
}

export function generatePhysicalProfile(
  position: PlayerPosition,
  rng: Rng,
): PhysicalProfile {
  const spec = POSITION_PHYSICAL[position]
  const heightInches = Math.round(
    Math.max(
      spec.heightMean - 4,
      Math.min(spec.heightMean + 4, rng.normal(spec.heightMean, spec.heightStd)),
    ),
  )
  const bmi = Math.max(
    20,
    Math.min(30, rng.normal(spec.bmiMean, spec.bmiStd)),
  )
  const weightLbs = Math.max(
    170,
    Math.min(290, weightFromBmi(heightInches, bmi)),
  )
  const wingspanInches = Math.round(
    heightInches + rng.normal(1.5, 1.2) + rng.int(-1, 1),
  )

  return {
    heightInches,
    weightLbs,
    wingspanInches,
    reachRating: deriveReachRating(heightInches, wingspanInches),
  }
}

export function physicalReboundModifier(profile: PhysicalProfile): number {
  const heightBonus = (profile.heightInches - 76) * 0.02
  const reachBonus = (profile.reachRating - 55) * 0.004
  return 1 + heightBonus + reachBonus
}

export function physicalBlockModifier(profile: PhysicalProfile): number {
  const reachBonus = (profile.reachRating - 55) * 0.006
  const wingspanBonus = (profile.wingspanInches - profile.heightInches) * 0.03
  return 1 + reachBonus + wingspanBonus
}

export function physicalDefenseModifier(profile: PhysicalProfile): number {
  const reachBonus = (profile.reachRating - 55) * 0.003
  const weightBonus = (profile.weightLbs - 220) * 0.001
  return 1 + reachBonus + Math.min(0.08, weightBonus)
}

export function physicalInsideModifier(profile: PhysicalProfile): number {
  const sizeBonus = (profile.heightInches - 76) * 0.015
  const weightBonus = (profile.weightLbs - 220) * 0.002
  return 1 + sizeBonus + Math.min(0.1, weightBonus)
}

export { deriveReachRating, bmiFrom }
