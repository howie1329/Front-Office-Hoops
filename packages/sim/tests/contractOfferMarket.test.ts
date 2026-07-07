import { describe, expect, it } from "vitest"

import type { Contract, LeagueRecord } from "@workspace/shared/types"
import {
  advanceFreeAgencyMarketDay,
  advanceStaffMarketDay,
  createLeague,
  createRng,
  getExternalFreeAgents,
  getExtensionBounds,
  getPlayerOfferAttemptsRemaining,
  getPlayerContractMarketValue,
  getReSigningAttemptsRemaining,
  getStaffContractMarketValue,
  isPlayerOfferBlocked,
  resetPlayerOfferNegotiations,
  getTeamExpiredFreeAgents,
  submitPlayerContractOffer,
  submitPlayerExtensionOffer,
  submitStaffContractOffer,
} from "../src"
import { processOffseasonFinancials } from "../src/financials"
import {
  calculateMaxSalary,
  calculateMinSalary,
  getSeasonFinancials,
} from "../src/financials/capMath"
import { fireStaff } from "../src/staff/fireStaff"
import { resolveContractMarketDay } from "../src/contracts/offerMarket"

function legalStrongSalary(league: ReturnType<typeof openReSigningLeague>, playerId: string) {
  const player = league.freeAgentPool.find((entry) => entry.id === playerId)!
  const market = getPlayerContractMarketValue(league, player)
  const seasonFinancials = getSeasonFinancials(
    league.leagueFinancials,
    league.seasonState.season,
  )
  const maxSalary = calculateMaxSalary(
    seasonFinancials.salaryCap,
    player.yearsOfService,
  )
  return Math.min(market.highSalary, maxSalary)
}

function legalMinimumSalary(league: ReturnType<typeof openReSigningLeague>, playerId: string) {
  const player = league.freeAgentPool.find((entry) => entry.id === playerId)!
  const seasonFinancials = getSeasonFinancials(
    league.leagueFinancials,
    league.seasonState.season,
  )
  return calculateMinSalary(seasonFinancials, player.yearsOfService)
}

function openReSigningLeague() {
  const league = createLeague({
    skipPreseason: true,
    name: "Re-signing Market",
    baseSeed: "re-signing-market",
    rng: createRng("re-signing-market"),
    useMiniLeague: true,
    userTeamId: "t_baltimore_foundry",
  })
  const teamId = league.userTeamId!
  const player = league.seasonState.teams
    .find((team) => team.id === teamId)!
    .players.sort((a, b) => b.ratings.overall - a.ratings.overall)[0]!
  const expiringContract = league.contracts.find(
    (contract) => contract.playerId === player.id,
  )!

  return processOffseasonFinancials(
    {
      ...league,
      contracts: league.contracts.map((contract) =>
        contract.id === expiringContract.id
          ? { ...contract, yearlySalaries: [contract.yearlySalaries[0]!] }
          : contract,
      ),
      seasonState: {
        ...league.seasonState,
        phase: "offseason",
        offseasonPhase: "re_signing",
      },
    },
    createRng("re-signing-open"),
  )
}

function withExtensionLeague(): LeagueRecord {
  const league = createLeague({
    skipPreseason: true,
    name: "Extension Offer Market",
    baseSeed: "extension-offer-market",
    rng: createRng("extension-offer-market"),
    useMiniLeague: true,
    userTeamId: "t_baltimore_foundry",
  })
  const teamId = league.userTeamId!
  const player = league.seasonState.teams.find((team) => team.id === teamId)!
    .players[0]!
  const contract: Contract = {
    id: "extension_offer_contract",
    playerId: player.id,
    teamId,
    startSeason: 1,
    endSeason: 3,
    yearlySalaries: [30, 30, 30],
    contractType: "standard",
    signingException: "bird",
    status: "active",
    signedSeason: 1,
  }

  return {
    ...league,
    contracts: [
      ...league.contracts.filter((entry) => entry.playerId !== player.id),
      contract,
    ],
    seasonState: {
      ...league.seasonState,
      season: 3,
      phase: "preseason",
      teams: league.seasonState.teams.map((team) =>
        team.id === teamId
          ? {
              ...team,
              players: team.players.map((entry) =>
                entry.id === player.id
                  ? { ...entry, activeContractId: contract.id }
                  : entry,
              ),
            }
          : team,
      ),
    },
  }
}

describe("contract offer market", () => {
  it("accepts strong re-signing offers immediately", () => {
    const league = openReSigningLeague()
    const teamId = league.userTeamId!
    const player = getTeamExpiredFreeAgents(league, teamId)[0]!

    const signed = submitPlayerContractOffer(league, teamId, player.id, {
      years: 3,
      firstYearSalary: legalStrongSalary(league, player.id),
    })

    expect(
      signed.seasonState.teams
        .find((team) => team.id === teamId)!
        .players.some((entry) => entry.id === player.id),
    ).toBe(true)
    expect(
      signed.contractOffers.find((offer) => offer.candidateId === player.id)
        ?.status,
    ).toBe("accepted")
  })

  it("locks re-signing after three declined offers", () => {
    let league = openReSigningLeague()
    const teamId = league.userTeamId!
    const player = getTeamExpiredFreeAgents(league, teamId)[0]!

    for (let attempt = 0; attempt < 3; attempt += 1) {
      league = submitPlayerContractOffer(league, teamId, player.id, {
        years: 1,
        firstYearSalary: legalMinimumSalary(league, player.id),
      })
    }

    expect(getReSigningAttemptsRemaining(league, player.id, teamId)).toBe(0)
    expect(() =>
      submitPlayerContractOffer(league, teamId, player.id, {
        years: 3,
        firstYearSalary: legalStrongSalary(league, player.id),
      }),
    ).toThrow(/no longer negotiate/)
  })

  it("accepts strong player extension offers", () => {
    const league = withExtensionLeague()
    const teamId = league.userTeamId!
    const player = league.seasonState.teams.find((team) => team.id === teamId)!
      .players[0]!
    const bounds = getExtensionBounds(league, player.id)!

    const extended = submitPlayerExtensionOffer(league, teamId, player.id, {
      years: bounds.maxYears,
      firstYearSalary: bounds.maxSalary,
    })
    const contract = extended.contracts.find(
      (entry) => entry.playerId === player.id && entry.status === "active",
    )

    expect(contract?.yearlySalaries.length).toBeGreaterThan(3)
    expect(
      extended.contractOffers.find((offer) => offer.phase === "extension")
        ?.status,
    ).toBe("accepted")
  })

  it("locks extension talks after three declined offers until reset", () => {
    let league = withExtensionLeague()
    const teamId = league.userTeamId!
    const player = league.seasonState.teams.find((team) => team.id === teamId)!
      .players[0]!
    const bounds = getExtensionBounds(league, player.id)!

    for (let attempt = 0; attempt < 3; attempt += 1) {
      league = submitPlayerExtensionOffer(league, teamId, player.id, {
        years: bounds.minYears,
        firstYearSalary: bounds.minSalary,
      })
    }

    expect(
      getPlayerOfferAttemptsRemaining(league, player.id, teamId, "extension"),
    ).toBe(0)
    expect(isPlayerOfferBlocked(league, player.id, teamId, "extension")).toBe(true)
    expect(() =>
      submitPlayerExtensionOffer(league, teamId, player.id, {
        years: bounds.maxYears,
        firstYearSalary: bounds.maxSalary,
      }),
    ).toThrow(/extension/)

    const reset = resetPlayerOfferNegotiations(league, ["extension"])
    expect(isPlayerOfferBlocked(reset, player.id, teamId, "extension")).toBe(false)
  })

  it("resolves staff offers through the market day", () => {
    let league = createLeague({
      skipPreseason: true,
      name: "Staff Offer Market",
      baseSeed: "staff-offer-market",
      rng: createRng("staff-offer-market"),
      useMiniLeague: true,
      userTeamId: "t_baltimore_foundry",
    })
    const teamId = league.userTeamId!
    league = {
      ...league,
      seasonState: {
        ...league.seasonState,
        phase: "offseason",
        offseasonPhase: "staff",
      },
    }

    const incumbent = league.staff.find(
      (entry) => entry.teamId === teamId && entry.role === "scouting_head",
    )!
    const fired = fireStaff(league, teamId, incumbent.id)
    expect(fired.ok).toBe(true)
    if (!fired.ok) {
      return
    }
    league = fired.league

    const candidate = league.staff.find(
      (entry) => entry.teamId === null && entry.role === "scouting_head",
    )!
    const market = getStaffContractMarketValue(candidate)

    const offered = submitStaffContractOffer(league, teamId, candidate.id, {
      years: 3,
      firstYearSalary: market.highSalary,
    })
    const resolved = advanceStaffMarketDay(offered, createRng("staff-resolve"))

    expect(
      resolved.staff.find((entry) => entry.id === candidate.id)?.teamId,
    ).toBe(teamId)
    expect(
      resolved.contractOffers.find((offer) => offer.candidateId === candidate.id)
        ?.status,
    ).toBe("accepted")
  })

  it("resolves free-agent offers through the market day", () => {
    let league = createLeague({
      skipPreseason: true,
      name: "Free Agent Offer Market",
      baseSeed: "fa-offer-market",
      rng: createRng("fa-offer-market"),
      useMiniLeague: true,
      userTeamId: "t_baltimore_foundry",
    })
    const teamId = league.userTeamId!
    const userTeam = league.seasonState.teams.find((team) => team.id === teamId)!
    league = {
      ...league,
      contracts: league.contracts.filter((contract) => contract.teamId !== teamId),
      seasonState: {
        ...league.seasonState,
        phase: "offseason",
        offseasonPhase: "free_agency",
        teams: league.seasonState.teams.map((team) =>
          team.id === teamId ? { ...team, players: userTeam.players.slice(0, 14) } : team,
        ),
      },
    }

    const player = getExternalFreeAgents(league, teamId).sort(
      (a, b) => b.ratings.overall - a.ratings.overall,
    )[0]!
    const market = getPlayerContractMarketValue(league, player)
    const seasonFinancials = getSeasonFinancials(
      league.leagueFinancials,
      league.seasonState.season,
    )
    const maxSalary = calculateMaxSalary(
      seasonFinancials.salaryCap,
      player.yearsOfService,
    )

    const offered = submitPlayerContractOffer(league, teamId, player.id, {
      years: 3,
      firstYearSalary: Math.min(market.highSalary, maxSalary),
    })
    const resolved = advanceFreeAgencyMarketDay(offered, createRng("fa-resolve"))

    expect(
      resolved.seasonState.teams
        .find((team) => team.id === teamId)!
        .players.some((entry) => entry.id === player.id),
    ).toBe(true)
    expect(
      resolved.contractOffers.find((offer) => offer.candidateId === player.id)
        ?.status,
    ).toBe("accepted")
  })

  it("locks free-agent offers after three declined offers until reset", () => {
    let league = createLeague({
      skipPreseason: true,
      name: "Free Agent Offer Lockout",
      baseSeed: "fa-offer-lockout",
      rng: createRng("fa-offer-lockout"),
      useMiniLeague: true,
      userTeamId: "t_baltimore_foundry",
    })
    const teamId = league.userTeamId!
    const userTeam = league.seasonState.teams.find((team) => team.id === teamId)!
    league = {
      ...league,
      contracts: league.contracts.filter((contract) => contract.teamId !== teamId),
      seasonState: {
        ...league.seasonState,
        phase: "offseason",
        offseasonPhase: "free_agency",
        teams: league.seasonState.teams.map((team) =>
          team.id === teamId
            ? { ...team, players: userTeam.players.slice(0, 14) }
            : team,
        ),
      },
    }

    const player = getExternalFreeAgents(league, teamId).sort(
      (a, b) => b.ratings.overall - a.ratings.overall,
    )[0]!
    const seasonFinancials = getSeasonFinancials(
      league.leagueFinancials,
      league.seasonState.season,
    )
    const lowOffer = {
      years: 1,
      firstYearSalary: calculateMinSalary(seasonFinancials, player.yearsOfService),
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      league = submitPlayerContractOffer(league, teamId, player.id, lowOffer)
      league = resolveContractMarketDay(league, "free_agency")
    }

    expect(
      getPlayerOfferAttemptsRemaining(league, player.id, teamId, "free_agency"),
    ).toBe(0)
    expect(isPlayerOfferBlocked(league, player.id, teamId, "free_agency")).toBe(true)
    expect(() =>
      submitPlayerContractOffer(league, teamId, player.id, lowOffer),
    ).toThrow(/another offer/)

    const reset = resetPlayerOfferNegotiations(league, ["free_agency"])
    expect(isPlayerOfferBlocked(reset, player.id, teamId, "free_agency")).toBe(false)
  })
})
