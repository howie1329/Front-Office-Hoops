import type { Contract } from "@workspace/shared/contractTypes"
import type { TeamMode } from "@workspace/shared/financialTypes"
import type { Player } from "@workspace/shared/types"

import { getYearsRemaining } from "../financials/payroll"

export type PlayerValueBreakdown = {
  talentValue: number
  upsideValue: number
  ageRisk: number
  archetypeValue: number
  roleScarcityValue: number
  total: number
}

export type ContractAssetValueBreakdown = {
  playerValue: number
  expectedSalary: number
  actualSalary: number
  yearsRemaining: number
  surplusValue: number
  riskPenalty: number
  total: number
}

function upsideValue(player: Player): number {
  const upside = Math.max(0, player.ratings.potential - player.ratings.overall)
  if (player.age <= 21) {
    return upside * 0.65
  }
  if (player.age <= 24) {
    return upside * 0.45
  }
  if (player.age <= 27) {
    return upside * 0.2
  }
  return 0
}

function ageRisk(player: Player): number {
  if (player.age <= 29) {
    return 0
  }
  if (player.ratings.overall >= 78) {
    return Math.max(0, player.age - 32) * 0.8
  }
  return Math.max(0, player.age - 29) * 1.5
}

function archetypeValue(player: Player): number {
  const { shooting, inside, passing, rebounding, defense, stamina, usage } =
    player.ratings

  switch (player.archetype) {
    case "lead_guard":
      return passing >= 68 && shooting >= 62 ? 3 : passing >= 64 ? 1.5 : 0
    case "scoring_guard":
      return shooting >= 68 && usage >= 18 ? 2.5 : shooting >= 64 ? 1 : -0.5
    case "three_and_d_wing":
      return shooting >= 64 && defense >= 64
        ? 4
        : shooting >= 60 && defense >= 60
          ? 2
          : -1
    case "slasher":
      return inside >= 66 && stamina >= 62 ? 2 : inside >= 62 ? 1 : -0.5
    case "point_forward":
      return passing >= 64 && rebounding >= 58 ? 3 : passing >= 62 ? 1.5 : 0
    case "stretch_big":
      return shooting >= 62 && rebounding >= 58
        ? 3.5
        : shooting >= 60
          ? 1.5
          : -1
    case "rim_protector":
      return defense >= 66 && rebounding >= 64 ? 3.5 : defense >= 64 ? 1.5 : 0
    case "post_scorer":
      return inside >= 68 && usage >= 17 ? 2 : inside >= 64 ? 1 : -0.5
    case "rebounding_big":
      return rebounding >= 68 ? 2 : rebounding >= 64 ? 1 : -0.5
    case "defensive_specialist":
      return defense >= 70 ? 2.5 : defense >= 66 ? 1 : -1
    case "bench_scorer":
      return player.ratings.overall >= 68 ? 1.5 : 0
    case "raw_athlete":
      return player.age <= 22 &&
        player.ratings.potential - player.ratings.overall >= 14
        ? 2
        : -1
  }
}

function roleScarcityValue(player: Player): number {
  if (
    player.archetype === "three_and_d_wing" ||
    player.archetype === "stretch_big" ||
    player.archetype === "lead_guard" ||
    player.archetype === "rim_protector"
  ) {
    return 1.5
  }

  if (
    player.archetype === "defensive_specialist" &&
    player.ratings.defense >= 70
  ) {
    return 1
  }

  return 0
}

export function getPlayerValueBreakdown(player: Player): PlayerValueBreakdown {
  const talentValue = player.ratings.overall
  const upside = upsideValue(player)
  const risk = ageRisk(player)
  const archetype = archetypeValue(player)
  const scarcity = roleScarcityValue(player)

  return {
    talentValue,
    upsideValue: upside,
    ageRisk: risk,
    archetypeValue: archetype,
    roleScarcityValue: scarcity,
    total: talentValue + upside + archetype + scarcity - risk,
  }
}

export function calculatePlayerValue(player: Player): number {
  return getPlayerValueBreakdown(player).total
}

export function calculateContractValue(player: Player): number {
  const breakdown = getPlayerValueBreakdown(player)
  const currentValue = player.ratings.overall * 0.9
  const upside = breakdown.upsideValue * 0.45
  const risk = breakdown.ageRisk * 1.4
  return (
    currentValue +
    upside +
    breakdown.archetypeValue * 0.8 +
    breakdown.roleScarcityValue -
    risk
  )
}

export function calculateRosterKeepValue(
  player: Player,
  mode: TeamMode
): number {
  const currentValue = player.ratings.overall
  const upside = Math.max(0, player.ratings.potential - player.ratings.overall)
  const archetype = archetypeValue(player) + roleScarcityValue(player)

  switch (mode) {
    case "selling":
      return currentValue * 0.75 + upside * 0.8 + archetype - ageRisk(player)
    case "buying":
      return currentValue + upside * 0.25 + archetype - ageRisk(player) * 0.7
    case "contending":
      return currentValue * 1.1 + archetype * 0.8 - Math.max(0, player.age - 33)
  }
}

export function getContractAssetValueBreakdown({
  player,
  contract,
  expectedSalary,
  mode = "buying",
}: {
  player: Player
  contract: Contract | undefined
  expectedSalary: number
  mode?: TeamMode
}): ContractAssetValueBreakdown {
  const actualSalary = contract?.yearlySalaries[0] ?? expectedSalary
  const yearsRemaining = contract ? getYearsRemaining(contract) : 0
  const playerValue = calculatePlayerValue(player)
  const salaryDelta = expectedSalary - actualSalary
  const yearsMultiplier = Math.max(1, yearsRemaining)
  const surplusValue = salaryDelta * Math.sqrt(yearsMultiplier)

  let riskPenalty = 0
  if (salaryDelta < 0) {
    riskPenalty +=
      Math.abs(salaryDelta) * Math.max(0, yearsRemaining - 1) * 0.35
  }
  if (player.age >= 32 && yearsRemaining >= 3) {
    riskPenalty += (player.age - 31) * 1.2
  }
  if (mode === "contending" && player.ratings.overall >= 76) {
    riskPenalty *= 0.55
  }
  if (mode === "selling") {
    riskPenalty *= 1.15
  }

  return {
    playerValue,
    expectedSalary,
    actualSalary,
    yearsRemaining,
    surplusValue,
    riskPenalty,
    total: playerValue + surplusValue - riskPenalty,
  }
}
