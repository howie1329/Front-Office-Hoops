import type { Rng, RotationEntry } from "@workspace/shared/types"

import type { TeamStatComponents } from "../allocatePlayerStats"
import {
  averageRatings,
  clamp,
  ratingFactor,
  rotationQuality,
  round,
} from "./ratingHelpers"
import type { SegmentModifiers } from "./types"

export function buildScoringComponents({
  possessions,
  offense,
  defense,
  modifiers,
  rng,
}: {
  possessions: number
  offense: RotationEntry[]
  defense: RotationEntry[]
  modifiers: SegmentModifiers
  rng: Rng
}): TeamStatComponents {
  const off = averageRatings(offense)
  const def = averageRatings(defense)
  const quality = rotationQuality(offense)
  const benchDrag =
    clamp((quality.bench - quality.starters) / 80, -0.14, 0.04) *
    modifiers.benchDragMultiplier
  const staminaFactor = ratingFactor(off.stamina)
  const defenseFactor = ratingFactor(def.defense)
  const defensiveIqFactor = ratingFactor(def.defensiveIQ)

  const tovRate = clamp(
    0.138 -
      ratingFactor(
        off.passing + off.ballHandling * 0.4 + off.offensiveIQ * 0.2,
      ) *
        0.018 +
      defenseFactor * 0.015 +
      defensiveIqFactor * 0.01 +
      modifiers.tovRateShift +
      rng.normal(0, 0.008),
    0.09,
    0.18,
  )

  const perimeterSkill =
    off.threePoint + (off.threePoint - off.inside) * 0.35 + off.offensiveIQ * 0.1
  const tpaRate = clamp(
    0.38 +
      ratingFactor(perimeterSkill) * 0.055 +
      modifiers.tpaRateShift +
      rng.normal(0, 0.025),
    0.27,
    0.52,
  )

  const ftaRate = clamp(
    0.22 +
      ratingFactor(off.inside) * 0.03 -
      defenseFactor * 0.012 -
      defensiveIqFactor * 0.008 +
      modifiers.ftaRateShift +
      rng.normal(0, 0.015),
    0.14,
    0.34,
  )

  const tov = round(possessions * tovRate)
  const fta = round(possessions * ftaRate)
  const fga = Math.max(1, round(possessions - tov - fta * 0.32 + 2))
  const tpa = clamp(round(fga * tpaRate), 0, Math.max(0, fga - 1))
  const twoPa = fga - tpa

  const twoPct = clamp(
    0.555 +
      ratingFactor(off.inside) * 0.03 +
      ratingFactor(off.midRange) * 0.02 +
      ratingFactor(off.passing) * 0.012 -
      defenseFactor * 0.035 -
      defensiveIqFactor * 0.015 +
      staminaFactor * 0.008 +
      benchDrag -
      modifiers.fatiguePenalty +
      modifiers.efficiencyShift +
      rng.normal(0, 0.018),
    0.44,
    0.62,
  )

  const threePct = clamp(
    0.375 +
      ratingFactor(off.threePoint) * 0.038 +
      ratingFactor(off.offensiveIQ) * 0.012 -
      defenseFactor * 0.015 -
      defensiveIqFactor * 0.008 +
      staminaFactor * 0.006 +
      benchDrag * 0.55 -
      modifiers.fatiguePenalty * 0.8 +
      modifiers.efficiencyShift * 0.9 +
      rng.normal(0, 0.022),
    0.28,
    0.45,
  )

  const ftPct = clamp(
    0.76 + ratingFactor(off.freeThrow) * 0.025,
    0.68,
    0.86,
  )

  const twoPm = clamp(round(twoPa * twoPct), 0, twoPa)
  const tpm = clamp(round(tpa * threePct), 0, tpa)
  const ftm = clamp(round(fta * ftPct), 0, fta)
  const fgm = twoPm + tpm
  const points = twoPm * 2 + tpm * 3 + ftm + modifiers.homeCourtPoints

  const ast = clamp(
    round(
      fgm *
        (0.58 +
          ratingFactor(off.passing + off.ballHandling * 0.35) * 0.06 +
          rng.normal(0, 0.025)),
    ),
    0,
    fgm,
  )

  const stl = round(
    possessions *
      clamp(
        0.073 + defenseFactor * 0.01 + defensiveIqFactor * 0.008,
        0.05,
        0.1,
      ),
  )

  const blk = round(
    twoPa *
      clamp(0.07 + defenseFactor * 0.012 + defensiveIqFactor * 0.01, 0.035, 0.1),
  )

  return {
    points,
    fgm,
    fga,
    tpm,
    tpa,
    ftm,
    fta,
    orb: 0,
    drb: 0,
    ast,
    stl,
    blk,
    tov,
  }
}

export function addRebounds(
  team: TeamStatComponents,
  opponent: TeamStatComponents,
  teamRotation: RotationEntry[],
  opponentRotation: RotationEntry[],
  rng: Rng,
) {
  const teamReb = averageRatings(teamRotation).rebounding
  const oppReb = averageRatings(opponentRotation).rebounding
  const teamMisses = team.fga - team.fgm
  const oppMisses = opponent.fga - opponent.fgm
  const orbRate = clamp(
    0.25 +
      ratingFactor(teamReb) * 0.025 -
      ratingFactor(oppReb) * 0.02 +
      rng.normal(0, 0.012),
    0.18,
    0.34,
  )
  const oppOrbRate = clamp(
    0.25 +
      ratingFactor(oppReb) * 0.025 -
      ratingFactor(teamReb) * 0.02 +
      rng.normal(0, 0.012),
    0.18,
    0.34,
  )

  team.orb = round(teamMisses * orbRate)
  opponent.orb = round(oppMisses * oppOrbRate)
  team.drb = Math.max(0, oppMisses - opponent.orb)
  opponent.drb = Math.max(0, teamMisses - team.orb)
}
