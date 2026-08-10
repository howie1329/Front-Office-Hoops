import { describe, expect, it } from "vitest"

import { validateLeagueDocument } from "@workspace/league-schema"

import { createLeague, executeLeagueCommand, projectTeamFinance } from "../src"

function createTestLeague() {
  return createLeague({
    id: "release-player-league",
    name: "Release Player League",
    seed: "release-player-seed",
    mode: "deterministic-lab",
    createdWithEntropy: false,
    now: "2026-08-02T00:00:00.000Z",
  }).document
}

describe("release player command", () => {
  it("moves a player to free agency and preserves the remaining salary as dead money", () => {
    const league = createTestLeague()
    const teamId = "team:01"
    const playerId = league.entities.teams[teamId]?.rosterPlayerIds?.[0]
    const contract = Object.values(league.entities.contracts).find(
      (candidate) => candidate.playerId === playerId
    )

    expect(playerId).toBeDefined()
    expect(contract).toBeDefined()

    const annualSalary = Array.isArray(contract?.annualSalary)
      ? contract.annualSalary.filter(
          (salary): salary is number => typeof salary === "number"
        )
      : []
    const before = projectTeamFinance(league, teamId, 2)

    const result = executeLeagueCommand({
      requestId: "request-release-player",
      command: {
        type: "ReleasePlayer",
        commandId: "command-release-player",
        teamId,
        playerId: playerId!,
      },
      league,
    })

    expect(result.status).toBe("completed")
    expect(result.events[0]?.summary).toContain("Released")
    expect(result.league).toBeDefined()

    const releasedLeague = result.league!
    const releasedPlayer = releasedLeague.entities.players[playerId!]
    const releasedContract = Object.values(
      releasedLeague.entities.contracts
    ).find((candidate) => candidate.playerId === playerId)
    const after = projectTeamFinance(releasedLeague, teamId, 2)

    expect(releasedPlayer?.leagueStatus).toEqual({ kind: "free-agent" })
    expect(
      releasedLeague.entities.teams[teamId]?.rosterPlayerIds
    ).not.toContain(playerId)
    expect(releasedLeague.state.rotations?.[teamId]?.starters).not.toContain(
      playerId
    )
    expect(releasedLeague.state.rotations?.[teamId]?.depthOrder).not.toContain(
      playerId
    )
    expect(releasedContract?.status).toBe("released")
    expect(releasedContract?.releasedFromTeamId).toBe(teamId)
    expect(after.seasons[0]?.deadMoney).toBe(annualSalary[0])
    expect(after.seasons[1]?.deadMoney).toBe(annualSalary[1])
    expect(after.seasons[0]?.payroll).toBe(before.seasons[0]?.payroll)
    expect(
      releasedLeague.projections.payroll.find((row) => row.teamId === teamId)
        ?.payroll
    ).toBe(after.seasons[0]?.payroll)
    expect(validateLeagueDocument(releasedLeague)).toMatchObject({
      valid: true,
    })
  })

  it("rejects releasing a player who is no longer on the roster", () => {
    const league = createTestLeague()
    const teamId = "team:01"
    const playerId = league.entities.teams[teamId]?.rosterPlayerIds?.[0]!
    const first = executeLeagueCommand({
      requestId: "request-release-player-first",
      command: {
        type: "ReleasePlayer",
        commandId: "command-release-player-first",
        teamId,
        playerId,
      },
      league,
    })

    const second = executeLeagueCommand({
      requestId: "request-release-player-second",
      command: {
        type: "ReleasePlayer",
        commandId: "command-release-player-second",
        teamId,
        playerId,
      },
      league: first.league!,
    })

    expect(second.status).toBe("rejected")
    expect(second.reason?.code).toBe("player_not_on_roster")
  })

  it("infers dead money for legacy release snapshots without a status field", () => {
    const league = createTestLeague()
    const teamId = "team:01"
    const playerId = league.entities.teams[teamId]?.rosterPlayerIds?.[0]!
    const contract = Object.values(league.entities.contracts).find(
      (candidate) => candidate.playerId === playerId
    )!
    const annualSalary = Array.isArray(contract.annualSalary)
      ? contract.annualSalary.filter(
          (salary): salary is number => typeof salary === "number"
        )
      : []
    const legacyLeague = structuredClone(league)

    legacyLeague.entities.teams[teamId]!.rosterPlayerIds =
      legacyLeague.entities.teams[teamId]!.rosterPlayerIds?.filter(
        (rosteredPlayerId) => rosteredPlayerId !== playerId
      )
    legacyLeague.entities.players[playerId]!.leagueStatus = {
      kind: "free-agent",
    }
    const legacyContract = Object.values(legacyLeague.entities.contracts).find(
      (candidate) => candidate.playerId === playerId
    )!
    delete legacyContract.status

    const projection = projectTeamFinance(legacyLeague, teamId, 2)

    expect(projection.seasons[0]?.deadMoney).toBe(annualSalary[0])
    expect(projection.seasons[1]?.deadMoney).toBe(annualSalary[1])
  })
})
