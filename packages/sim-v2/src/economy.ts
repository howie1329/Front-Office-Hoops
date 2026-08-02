import type {
  EconomyConfig,
  EconomySnapshot,
  RookieScaleEntry,
} from "@workspace/domain-v2"

import { STANDARD_ECONOMY_CONFIG } from "./marketConfig"

function roundMoney(value: number): number {
  return Math.round(value / 10_000) * 10_000
}

function grow(value: number, rate: number): number {
  return roundMoney(value * (1 + rate))
}

function createRookieScale(
  maximumSalary: number,
  rookieScale: number
): RookieScaleEntry[] {
  return Array.from({ length: 60 }, (_, index) => {
    const slot = index + 1
    const discount = Math.max(0.25, 1 - (slot - 1) * 0.012)
    return {
      slot,
      salary: Math.max(
        roundMoney(rookieScale * discount),
        roundMoney(maximumSalary * 0.04)
      ),
    }
  })
}

export function createEconomySnapshot(
  season = 1,
  config: EconomyConfig = STANDARD_ECONOMY_CONFIG
): EconomySnapshot {
  if (!Number.isInteger(season) || season < 1) {
    throw new RangeError("Economy season must be a positive integer.")
  }

  let softCap = config.growth.softCap
  let taxLine = config.growth.taxLine
  let hardCapLine = config.growth.hardCapLine
  let minimumSalary = config.growth.minimumSalary
  let maximumSalary = config.growth.maximumSalary
  let rookieScale = config.growth.rookieScale

  for (let currentSeason = 1; currentSeason < season; currentSeason += 1) {
    softCap = grow(softCap, config.annualGrowth.softCap)
    taxLine = grow(taxLine, config.annualGrowth.taxLine)
    hardCapLine = grow(hardCapLine, config.annualGrowth.hardCapLine)
    minimumSalary = grow(minimumSalary, config.annualGrowth.minimumSalary)
    maximumSalary = grow(maximumSalary, config.annualGrowth.maximumSalary)
    rookieScale = grow(rookieScale, config.annualGrowth.rookieScale)
  }

  return {
    version: 1,
    season,
    config: structuredClone(config),
    softCap,
    taxLine,
    hardCapLine,
    minimumSalary,
    maximumSalary,
    minimumTeamSalary: roundMoney(
      softCap * (config.minimumTeamSalaryPercent / 100)
    ),
    rookieScale: createRookieScale(maximumSalary, rookieScale),
    hardCapTriggered: false,
  }
}

export function getRookieScaleSalary(
  economy: EconomySnapshot,
  draftSlot: number
): number {
  return (
    economy.rookieScale.find((entry) => entry.slot === draftSlot)?.salary ??
    economy.minimumSalary
  )
}

export function calculateLuxuryTaxExposure(
  payroll: number,
  economy: EconomySnapshot
): number {
  return Math.max(0, payroll - economy.taxLine)
}

export function calculateCapRoom(
  payroll: number,
  economy: EconomySnapshot
): number {
  return Math.max(0, economy.softCap - payroll)
}

export function calculateHardCapRoom(
  payroll: number,
  economy: EconomySnapshot
): number {
  return Math.max(0, economy.hardCapLine - payroll)
}
