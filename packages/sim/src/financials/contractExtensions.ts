import type { Contract } from "@workspace/shared/contractTypes"
import type { ExtensionOffer, LeagueRecord } from "@workspace/shared/types"

import { createLeagueLogEntry, appendLeagueLog } from "../leagueLog"
import { findPlayer, findPlayerTeam } from "../roster/ledger"
import {
  buildSalaryCurve,
  createContractId,
  estimateSalaryFromValue,
} from "./contracts/createContract"
import {
  calculateMaxSalary,
  calculateMinSalary,
  calculateSeasonFinancials,
  getSeasonFinancials,
  roundMoney,
} from "./capMath"
import { getPlayerContract, getYearsRemaining } from "./payroll"
import { getProjectedPlayerValueBreakdown } from "../playerValue/projectedValue"

const EXTENSION_RAISE_PCT = 0.08
const EXTENSION_MAX_FIRST_YEAR_MULTIPLIER = 1.4
const EXTENSION_MAX_TOTAL_YEARS = 5
const EXTENSION_MIN_NEW_YEARS = 1
const EXTENSION_MAX_NEW_YEARS = 4

export type { ExtensionOffer }

export type ExtensionBounds = {
  minYears: number
  maxYears: number
  minSalary: number
  maxSalary: number
}

export type ExtensionValidationResult =
  | { ok: true }
  | { ok: false; reason: string }

export function getExtensionMarketSalary(
  league: LeagueRecord,
  playerId: string,
): number | null {
  const player = findPlayer(league, playerId)
  if (!player) return null
  const contract = getPlayerContract(league.contracts, player)
  if (!contract) return null
  const yearsRemaining = getYearsRemaining(contract)
  const targetSeason = league.seasonState.season + yearsRemaining
  const financials =
    league.leagueFinancials.bySeason[targetSeason] ??
    calculateSeasonFinancials(
      league.leagueFinancials.baseCap,
      league.leagueFinancials.growthRate,
      targetSeason,
    )
  const projection = getProjectedPlayerValueBreakdown(player)
  const projectedOverall =
    projection.projectedSeasons[
      Math.min(yearsRemaining, projection.projectedSeasons.length - 1)
    ]?.projectedOverall ?? player.ratings.overall
  return estimateSalaryFromValue(
    projectedOverall,
    player.yearsOfService + yearsRemaining,
    financials,
  )
}

function getCurrentSeason(league: LeagueRecord): number {
  return league.seasonState.season
}

function getOriginalContractYears(contract: Contract): number {
  return contract.endSeason - contract.startSeason + 1
}

function getSeasonsOnContract(contract: Contract, season: number): number {
  return Math.max(0, season - contract.startSeason)
}

function hasRookieScaleOptionsExercised(contract: Contract): boolean {
  const teamOptions =
    contract.options?.filter((option) => option.type === "team") ?? []
  return teamOptions.length >= 2
}

function isRookieScaleExtensionEligible(
  contract: Contract,
  yearsRemaining: number,
): boolean {
  return (
    contract.contractType === "rookie_scale" &&
    yearsRemaining === 1 &&
    hasRookieScaleOptionsExercised(contract)
  )
}

function isVeteranExtensionEligible(
  contract: Contract,
  season: number,
): boolean {
  const originalYears = getOriginalContractYears(contract)

  if (originalYears <= 2) {
    return false
  }

  const seasonsOnContract = getSeasonsOnContract(contract, season)

  if (originalYears <= 4) {
    return seasonsOnContract >= 2
  }

  return seasonsOnContract >= 3
}

export function isExtensionWindowOpen(
  league: LeagueRecord,
  yearsRemaining: number,
): boolean {
  const { phase, offseasonPhase } = league.seasonState

  if (phase === "playoffs" || phase === "complete") {
    return false
  }

  if (yearsRemaining === 1) {
    return (
      phase === "preseason" ||
      phase === "regular" ||
      phase === "offseason"
    )
  }

  if (phase === "preseason") {
    return true
  }

  if (phase === "offseason") {
    return (offseasonPhase ?? "re_signing") === "re_signing"
  }

  return false
}

export function getExtensionEligibilityReason(
  league: LeagueRecord,
  teamId: string,
  playerId: string,
): ExtensionValidationResult {
  const team = findPlayerTeam(league, playerId)
  if (!team || team.id !== teamId) {
    return { ok: false, reason: "Player is not on this team" }
  }

  const player = findPlayer(league, playerId)
  if (!player) {
    return { ok: false, reason: "Player not found" }
  }

  const contract = getPlayerContract(league.contracts, player)
  if (!contract || contract.status !== "active") {
    return { ok: false, reason: "Player has no active contract" }
  }

  const yearsRemaining = getYearsRemaining(contract)
  if (yearsRemaining <= 0) {
    return { ok: false, reason: "Contract has expired" }
  }

  if (!isExtensionWindowOpen(league, yearsRemaining)) {
    return {
      ok: false,
      reason:
        yearsRemaining > 1
          ? "Extensions with multiple years remaining are only available before the regular season"
          : "Extensions are not available during the playoffs",
    }
  }

  const rookieEligible = isRookieScaleExtensionEligible(contract, yearsRemaining)
  const veteranEligible = isVeteranExtensionEligible(
    contract,
    getCurrentSeason(league),
  )

  if (!rookieEligible && !veteranEligible) {
    if (contract.contractType === "rookie_scale") {
      return {
        ok: false,
        reason: "Rookie scale extensions require the final contract year",
      }
    }

    const originalYears = getOriginalContractYears(contract)
    if (originalYears <= 2) {
      return { ok: false, reason: "Contracts shorter than three years cannot be extended" }
    }

    return {
      ok: false,
      reason: "Player is not yet eligible for a veteran extension",
    }
  }

  return { ok: true }
}

export function getExtensionBounds(
  league: LeagueRecord,
  playerId: string,
): ExtensionBounds | null {
  const player = findPlayer(league, playerId)
  if (!player) {
    return null
  }

  const contract = getPlayerContract(league.contracts, player)
  if (!contract || contract.status !== "active") {
    return null
  }

  const seasonFinancials = getSeasonFinancials(
    league.leagueFinancials,
    getCurrentSeason(league),
  )
  const yearsRemaining = getYearsRemaining(contract)
  const currentSalary = contract.yearlySalaries[0] ?? 0
  const minSalary = calculateMinSalary(seasonFinancials, player.yearsOfService)
  const maxSalary = Math.min(
    calculateMaxSalary(
      seasonFinancials.salaryCap,
      player.yearsOfService,
    ),
    roundMoney(
      Math.max(currentSalary, seasonFinancials.averageSalary) *
        EXTENSION_MAX_FIRST_YEAR_MULTIPLIER,
    ),
  )
  const maxNewYears = Math.max(
    EXTENSION_MIN_NEW_YEARS,
    Math.min(
      EXTENSION_MAX_NEW_YEARS,
      EXTENSION_MAX_TOTAL_YEARS - yearsRemaining,
    ),
  )

  return {
    minYears: EXTENSION_MIN_NEW_YEARS,
    maxYears: maxNewYears,
    minSalary,
    maxSalary,
  }
}

export function canExtendContract(
  league: LeagueRecord,
  teamId: string,
  playerId: string,
  offer: ExtensionOffer,
): ExtensionValidationResult {
  const eligibility = getExtensionEligibilityReason(league, teamId, playerId)
  if (!eligibility.ok) {
    return eligibility
  }

  const bounds = getExtensionBounds(league, playerId)
  if (!bounds) {
    return { ok: false, reason: "Unable to calculate extension bounds" }
  }

  if (offer.years < bounds.minYears || offer.years > bounds.maxYears) {
    return {
      ok: false,
      reason: `Extension must be between ${bounds.minYears} and ${bounds.maxYears} new years`,
    }
  }

  if (
    offer.firstYearSalary < bounds.minSalary ||
    offer.firstYearSalary > bounds.maxSalary
  ) {
    return {
      ok: false,
      reason: `First-year salary must be between ${bounds.minSalary.toFixed(1)}M and ${bounds.maxSalary.toFixed(1)}M`,
    }
  }

  return { ok: true }
}

export function extendContract(
  league: LeagueRecord,
  teamId: string,
  playerId: string,
  offer: ExtensionOffer,
): LeagueRecord {
  const validation = canExtendContract(league, teamId, playerId, offer)
  if (!validation.ok) {
    throw new Error(validation.reason)
  }

  const player = findPlayer(league, playerId)
  if (!player) {
    throw new Error("Player not found")
  }

  const contract = getPlayerContract(league.contracts, player)
  if (!contract) {
    throw new Error("Player has no active contract")
  }

  const extensionSalaries = buildSalaryCurve(
    offer.firstYearSalary,
    offer.years,
    EXTENSION_RAISE_PCT,
  )
  const updatedContract: Contract = {
    ...contract,
    id: createContractId(playerId, contract.endSeason + 1),
    yearlySalaries: [...contract.yearlySalaries, ...extensionSalaries],
    guaranteedSalaries: [
      ...contract.guaranteedSalaries,
      ...extensionSalaries,
    ],
    endSeason: contract.endSeason + offer.years,
  }

  const contracts = league.contracts.map((entry) =>
    entry.id === contract.id ? updatedContract : entry,
  )

  const teams = league.seasonState.teams.map((team) => ({
    ...team,
    players: team.players.map((entry) =>
      entry.id === playerId
        ? { ...entry, activeContractId: updatedContract.id }
        : entry,
    ),
  }))

  const withLog = appendLeagueLog(
    {
      ...league,
      contracts,
      seasonState: {
        ...league.seasonState,
        teams,
      },
    },
    [
      createLeagueLogEntry({
        league: {
          ...league,
          contracts,
          seasonState: {
            ...league.seasonState,
            teams,
          },
        },
        type: "contract_extension",
        teamId,
        playerId,
        payload: {
          years: offer.years,
          firstYearSalary: offer.firstYearSalary,
        },
      }),
    ],
  )

  return withLog
}
