import { describe, expect, it } from "vitest"

import type { Player } from "@workspace/shared/types"

import { createLeague, createRng, releasePlayer } from "../src"
import { selectAiCutCandidate } from "../src/roster/rosterManagement"
import {
  getPlayerRoleNeedBonus,
  getRosterRoleCounts,
  getScarceRolePenalty,
} from "../src/roster/rosterBalance"

function makePlayer(overrides: Partial<Player> = {}): Player {
  const id = overrides.id ?? "p_test"
  return {
    id,
    teamId: "t_test",
    firstName: "Test",
    lastName: id,
    age: 27,
    peakAge: 29,
    heightInches: 78,
    weightLbs: 210,
    position: "SG",
    ratings: {
      overall: 76,
      potential: 76,
      shooting: 76,
      inside: 76,
      passing: 76,
      rebounding: 76,
      defense: 76,
      stamina: 76,
      usage: 20,
    },
    tags: [],
    status: "active",
    injury: null,
    draftInfo: null,
    activeContractId: null,
    seasonsWithTeam: 2,
    yearsOfService: 2,
    ...overrides,
    archetype: overrides.archetype ?? "scoring_guard",
  }
}

function ratings(
  overrides: Partial<Player["ratings"]> = {}
): Player["ratings"] {
  return {
    ...makePlayer().ratings,
    ...overrides,
  }
}

describe("roster management", () => {
  it("blocks releases that would leave fewer than six players", () => {
    const league = createLeague({ skipPreseason: true,
      name: "Roster Floor",
      baseSeed: "roster-floor",
      rng: createRng("roster-floor"),
      useMiniLeague: true,
    })
    const team = {
      ...league.seasonState.teams[0]!,
      players: league.seasonState.teams[0]!.players.slice(0, 6),
    }

    expect(() =>
      releasePlayer([team], [], {
        teamId: team.id,
        playerId: team.players[0]!.id,
      })
    ).toThrow("minimum roster")
  })

  it("blocks releases that would remove the last player at a position", () => {
    const league = createLeague({ skipPreseason: true,
      name: "Position Floor",
      baseSeed: "position-floor",
      rng: createRng("position-floor"),
      useMiniLeague: true,
    })
    const team = league.seasonState.teams[0]!
    const onlyCenter = team.players.find((player) => player.position === "C")!
    const players = team.players.filter(
      (player) => player.position !== "C" || player.id === onlyCenter.id
    )

    expect(() =>
      releasePlayer([{ ...team, players }], [], {
        teamId: team.id,
        playerId: onlyCenter.id,
      })
    ).toThrow("position coverage")
  })

  it("tracks grouped roster role counts and needs", () => {
    const league = createLeague({ skipPreseason: true,
      name: "Role Counts",
      baseSeed: "role-counts",
      rng: createRng("role-counts"),
      useMiniLeague: true,
    })
    const players = league.seasonState.teams[0]!.players
    const counts = getRosterRoleCounts(players)

    expect(counts.guards).toBeGreaterThan(0)
    expect(counts.wings).toBeGreaterThan(0)
    expect(counts.bigs).toBeGreaterThan(0)
  })

  it("rewards needed roles and protects scarce roles", () => {
    const league = createLeague({ skipPreseason: true,
      name: "Role Needs",
      baseSeed: "role-needs",
      rng: createRng("role-needs"),
      useMiniLeague: true,
    })
    const team = league.seasonState.teams[0]!
    const guardsOnly = team.players.filter(
      (player) => player.position === "PG" || player.position === "SG"
    )
    const big = team.players.find((player) => player.position === "C")!

    expect(getPlayerRoleNeedBonus(guardsOnly, big)).toBeGreaterThan(0)
    expect(getScarceRolePenalty([...guardsOnly, big], big)).toBeGreaterThan(0)
  })

  it("changes cut preference by team mode", () => {
    const protectedCore = [
      makePlayer({
        id: "pg",
        position: "PG",
        ratings: ratings({ overall: 82, potential: 82 }),
      }),
      makePlayer({
        id: "sf",
        position: "SF",
        ratings: ratings({ overall: 82, potential: 82 }),
      }),
      makePlayer({
        id: "pf",
        position: "PF",
        ratings: ratings({ overall: 82, potential: 82 }),
      }),
      makePlayer({
        id: "c",
        position: "C",
        ratings: ratings({ overall: 82, potential: 82 }),
      }),
      makePlayer({
        id: "sg",
        position: "SG",
        ratings: ratings({ overall: 82, potential: 82 }),
      }),
      makePlayer({
        id: "bench",
        position: "PG",
        ratings: ratings({ overall: 80, potential: 80 }),
      }),
    ]
    const oldContributor = makePlayer({
      id: "old",
      age: 34,
      position: "SG",
      ratings: ratings({ overall: 72, potential: 72 }),
    })
    const youngUpside = makePlayer({
      id: "young",
      age: 20,
      position: "SG",
      ratings: ratings({ overall: 68, potential: 88 }),
    })
    const roster = [...protectedCore, oldContributor, youngUpside]

    expect(selectAiCutCandidate(roster, "selling").id).toBe("old")
    expect(selectAiCutCandidate(roster, "contending").id).toBe("young")
  })
})
