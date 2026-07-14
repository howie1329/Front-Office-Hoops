import { describe, expect, it } from "vitest"

import type { Contract, LeagueRecord } from "@workspace/shared/types"
import { createLeague, createRng } from "../src"
import {
  canExtendContract,
  extendContract,
  getExtensionEligibilityReason,
} from "../src/financials/contractExtensions"
import { deriveTeamDefense, deriveTeamOffense } from "../src/playerRatings"

function makeLeague(): LeagueRecord {
  return createLeague({
    name: "Extension Test",
    baseSeed: "extension-test",
    rng: createRng("extension-test"),
    useMiniLeague: true,
  })
}

function withUserTeamContract(
  league: LeagueRecord,
  contract: Partial<Contract> & Pick<Contract, "playerId" | "yearlySalaries">,
): LeagueRecord {
  const userTeamId = league.seasonState.teams[0]!.id
  const player = league.seasonState.teams[0]!.players[0]!
  const fullContract: Contract = {
    id: contract.id ?? "c_test",
    playerId: contract.playerId,
    teamId: userTeamId,
    startSeason: contract.startSeason ?? 1,
    endSeason: contract.endSeason ?? 4,
    yearlySalaries: contract.yearlySalaries,
    guaranteedSalaries:
      contract.guaranteedSalaries ?? [...contract.yearlySalaries],
    contractType: contract.contractType ?? "standard",
    signingException: contract.signingException ?? "bird",
    status: contract.status ?? "active",
    signedSeason: contract.signedSeason ?? 1,
    options: contract.options,
  }

  return {
    ...league,
    userTeamId,
    contracts: [
      ...league.contracts.filter((entry) => entry.playerId !== player.id),
      fullContract,
    ],
    seasonState: {
      ...league.seasonState,
      season: 3,
      phase: "preseason",
      teams: league.seasonState.teams.map((team, index) =>
        index === 0
          ? {
              ...team,
              players: team.players.map((entry) =>
                entry.id === player.id
                  ? { ...entry, activeContractId: fullContract.id }
                  : entry,
              ),
            }
          : team,
      ),
    },
  }
}

describe("contractExtensions", () => {
  it("derives team offense and defense ratings", () => {
    const league = makeLeague()
    const players = league.seasonState.teams[0]!.players
    expect(deriveTeamOffense(players)).toBeGreaterThan(0)
    expect(deriveTeamDefense(players)).toBeGreaterThan(0)
  })

  it("allows veteran extensions in the preseason window", () => {
    const league = withUserTeamContract(makeLeague(), {
      playerId: makeLeague().seasonState.teams[0]!.players[0]!.id,
      yearlySalaries: [12, 12, 12],
      startSeason: 1,
      endSeason: 3,
      signedSeason: 1,
    })

    const playerId = league.seasonState.teams[0]!.players[0]!.id
    const eligibility = getExtensionEligibilityReason(
      league,
      league.userTeamId!,
      playerId,
    )

    expect(eligibility.ok).toBe(true)
  })

  it("extends a contract by appending new salary years", () => {
    const base = makeLeague()
    const playerId = base.seasonState.teams[0]!.players[0]!.id
    const league = withUserTeamContract(base, {
      playerId,
      yearlySalaries: [10, 10, 10],
      startSeason: 1,
      endSeason: 3,
      signedSeason: 1,
    })

    const offer = { years: 2, firstYearSalary: 14 }
    expect(
      canExtendContract(league, league.userTeamId!, playerId, offer).ok,
    ).toBe(true)

    const updated = extendContract(league, league.userTeamId!, playerId, offer)
    const contract = updated.contracts.find((entry) => entry.playerId === playerId)

    expect(contract?.yearlySalaries).toHaveLength(5)
    expect(contract?.yearlySalaries[3]).toBe(14)
    expect(contract?.endSeason).toBe(5)
  })
})
