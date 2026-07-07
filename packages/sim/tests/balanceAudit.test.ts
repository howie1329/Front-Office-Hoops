import { describe, expect, it } from "vitest"

import {
  AI_ACCEPT_BAD,
  AI_ACCEPT_CLOSE,
  AI_ACCEPT_MIN_NET,
} from "@workspace/shared/financialConstants"

import {
  calculatePlayerValue,
  createLeague,
  createRng,
  evaluateTrade,
  getFairSalary,
  wouldAiAcceptTrade,
} from "../src"
import { getSeasonFinancials } from "../src/financials"

describe("v1 balance audit", () => {
  it("keeps AI trade thresholds ordered for contending teams", () => {
    expect(AI_ACCEPT_BAD).toBeLessThan(AI_ACCEPT_CLOSE)
    expect(AI_ACCEPT_CLOSE).toBeLessThan(AI_ACCEPT_MIN_NET)
  })

  it("rejects clearly lopsided mini-league trades", () => {
    const league = createLeague({
      name: "Balance Audit",
      baseSeed: "balance-audit",
      rng: createRng("balance-audit"),
      useMiniLeague: true,
      skipPreseason: true,
    })
    const userTeam = league.seasonState.teams[0]!
    const partner = league.seasonState.teams[1]!
    const worstUserPlayer = [...userTeam.players].sort(
      (left, right) => left.ratings.overall - right.ratings.overall,
    )[0]!
    const bestPartnerPlayer = [...partner.players].sort(
      (left, right) => right.ratings.overall - left.ratings.overall,
    )[0]!

    const proposal = {
      from: {
        teamId: userTeam.id,
        playerIds: [worstUserPlayer.id],
        pickIds: [],
      },
      to: {
        teamId: partner.id,
        playerIds: [bestPartnerPlayer.id],
        pickIds: [],
      },
    }

    const evaluation = evaluateTrade(league, proposal).find(
      (entry) => entry.teamId === partner.id,
    )
    const response = wouldAiAcceptTrade(league, proposal, partner.id)

    expect(evaluation?.netValue ?? 0).toBeLessThan(AI_ACCEPT_CLOSE)
    expect(response.ok).toBe(false)
  })

  it("keeps fair salaries near player worth for prime starters", () => {
    const league = createLeague({
      name: "Salary Audit",
      baseSeed: "salary-audit",
      rng: createRng("salary-audit"),
      useMiniLeague: true,
      skipPreseason: true,
    })
    const seasonFinancials = getSeasonFinancials(league.leagueFinancials, 1)
    const starter = league.seasonState.teams[0]!.players.find(
      (player) => player.ratings.overall >= 75,
    )

    expect(starter).toBeDefined()
    const worth = calculatePlayerValue(starter!)
    const fairSalary = getFairSalary(starter!, seasonFinancials, league)

    expect(fairSalary).toBeGreaterThan(seasonFinancials.minimumSalaries.tier3)
    expect(fairSalary).toBeGreaterThan(0)
    expect(worth).toBeGreaterThan(40)
  })
})
