import type { LeagueDocument, PlayerEntity } from "@workspace/domain-v2"

import { createEconomySnapshot } from "./economy"
import { STANDARD_ECONOMY_CONFIG } from "./marketConfig"
import { getPlayerCurrentAbility } from "./playerGeneration"

export type CurrentFreeAgentProjection = {
  playerId: string
  overall: number
  potential: number
  expectedAnnualSalary: number
  lowAnnualSalary: number
  highAnnualSalary: number
  expectedYears: number
  expectedTotalValue: number
}

export type FreeAgencyWindowStatus = {
  open: boolean
  label: string
  detail: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundMoney(value: number): number {
  return Math.round(value / 100_000) * 100_000
}

function expectedYears(player: PlayerEntity, overall: number): number {
  const potentialGap = Math.max(
    0,
    player.profile.development.potential - player.profile.development.rating
  )

  if (player.age <= 27 && (overall >= 65 || potentialGap >= 12)) return 4
  if (player.age <= 30 && (overall >= 55 || potentialGap >= 8)) return 3
  if (player.age <= 33 && overall >= 45) return 2
  return 1
}

export function projectCurrentFreeAgent(
  player: PlayerEntity,
  season = 1
): CurrentFreeAgentProjection {
  const economy = createEconomySnapshot(season, STANDARD_ECONOMY_CONFIG)
  const overall = Math.round(getPlayerCurrentAbility(player))
  const potential = Math.round(player.profile.development.potential)
  const potentialGap = Math.max(
    0,
    potential - player.profile.development.rating
  )
  const talentSignal = clamp(overall + potentialGap * 0.35, 25, 100)
  const normalizedTalent = clamp((talentSignal - 35) / 55, 0, 1)
  const ageMultiplier = player.age >= 33 ? 0.82 : player.age <= 27 ? 1.05 : 1
  const expectedAnnualSalary = roundMoney(
    economy.minimumSalary +
      normalizedTalent *
        (economy.maximumSalary - economy.minimumSalary) *
        0.32 *
        ageMultiplier
  )
  const years = expectedYears(player, overall)

  return {
    playerId: player.id,
    overall,
    potential,
    expectedAnnualSalary,
    lowAnnualSalary: Math.max(
      economy.minimumSalary,
      roundMoney(expectedAnnualSalary * 0.9)
    ),
    highAnnualSalary: Math.min(
      economy.maximumSalary,
      roundMoney(expectedAnnualSalary * 1.1)
    ),
    expectedYears: years,
    expectedTotalValue: expectedAnnualSalary * years,
  }
}

export function getCurrentFreeAgents(league: LeagueDocument): PlayerEntity[] {
  return Object.values(league.entities.players).filter(
    (player) => player.leagueStatus.kind === "free-agent"
  )
}

export function projectCurrentFreeAgents(
  league: LeagueDocument
): CurrentFreeAgentProjection[] {
  return getCurrentFreeAgents(league).map((player) =>
    projectCurrentFreeAgent(player, league.state.season)
  )
}

export function getFreeAgencyWindowStatus(
  league: LeagueDocument
): FreeAgencyWindowStatus {
  if (
    league.state.phase === "regular-season" &&
    league.state.calendar.currentDate <
      league.state.calendar.milestones.playoffsStart
  ) {
    return {
      open: true,
      label: "Open",
      detail: "Regular-season signings",
    }
  }

  if (
    league.state.phase === "offseason" &&
    league.state.offseasonPhase?.startsWith("free-agency-")
  ) {
    return {
      open: true,
      label: "Open",
      detail: "Offseason free agency",
    }
  }

  if (league.state.phase === "playoffs") {
    return {
      open: false,
      label: "Closed",
      detail: "Playoffs have started",
    }
  }

  if (league.state.phase === "offseason") {
    return {
      open: false,
      label: "Closed",
      detail: "Free agency is not open",
    }
  }

  return {
    open: false,
    label: "Closed",
    detail: "Signings open with the regular season",
  }
}
