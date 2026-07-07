import { describe, expect, it } from "vitest"

import {
  applyDraftSelections,
  createLeague,
  createRng,
  findPlayer,
  findPlayerTeam,
  makeDraftPick,
  prepareDraft,
  releasePlayerFromTeam,
} from "../src"
import { advanceToDraftPhase } from "../src/offseason/phases"
import { beginOffseason } from "../src/beginOffseason"
import { beginPlayoffs } from "../src/beginPlayoffs"
import { simulatePlayoffs } from "../src/simulatePlayoffs"
import { simulateSeason } from "../src/simulateSeason"
import { pastStaffPhaseState } from "./helpers/offseason"

function createDraftReadyLeague() {
  const league = createLeague({ skipPreseason: true,
    name: "Ledger Draft Test",
    baseSeed: "ledger-draft",
    rng: createRng("ledger-draft"),
    useMiniLeague: true,
    userTeamId: "t_baltimore_foundry",
  })

  let state = simulateSeason(league.seasonState)
  state = beginPlayoffs(state)
  state = simulatePlayoffs(state)
  state = beginOffseason(state)
  state = advanceToDraftPhase(pastStaffPhaseState(state, league))
  state = prepareDraft(state, league.draftPickAssets)

  return {
    ...league,
    seasonState: state,
  }
}

describe("rosterLedger", () => {
  it("finds players on rosters and in the free agent pool", () => {
    const league = createLeague({ skipPreseason: true,
      name: "Ledger Lookup",
      baseSeed: "ledger-lookup",
      rng: createRng("ledger-lookup"),
      useMiniLeague: true,
    })

    const rosterPlayer = league.seasonState.teams[0]!.players[0]!
    const poolPlayer = league.freeAgentPool[0]!

    expect(findPlayer(league, rosterPlayer.id)).toEqual(rosterPlayer)
    expect(findPlayerTeam(league, rosterPlayer.id)?.id).toBe(
      league.seasonState.teams[0]!.id
    )
    expect(findPlayer(league, poolPlayer.id)).toEqual(poolPlayer)
    expect(findPlayerTeam(league, poolPlayer.id)).toBeNull()
  })

  it("releases a player with contract waiver and log entry", () => {
    const league = createLeague({ skipPreseason: true,
      name: "Ledger Release",
      baseSeed: "ledger-release",
      rng: createRng("ledger-release"),
      useMiniLeague: true,
      userTeamId: "t_baltimore_foundry",
    })

    const team = league.seasonState.teams.find(
      (entry) => entry.id === league.userTeamId
    )!
    const player = team.players[team.players.length - 1]!
    const contractId = player.activeContractId

    const updated = releasePlayerFromTeam(league, {
      teamId: team.id,
      playerId: player.id,
    })

    expect(
      updated.seasonState.teams
        .find((entry) => entry.id === team.id)
        ?.players.some((entry) => entry.id === player.id)
    ).toBe(false)
    expect(updated.freeAgentPool.some((entry) => entry.id === player.id)).toBe(
      true
    )
    expect(updated.leagueLog.at(-1)?.type).toBe("release")
    if (contractId) {
      expect(
        updated.contracts.find((entry) => entry.id === contractId)?.status
      ).toBe("waived")
    }
  })

  it("applies draft selections with rookie contracts and logs", () => {
    const league = createDraftReadyLeague()
    const pick = league.seasonState.draftState?.order[0]
    const prospectId = league.seasonState.draftState?.prospects[0]?.id

    expect(pick).toBeDefined()
    expect(prospectId).toBeDefined()

    const result = makeDraftPick(
      league.seasonState,
      prospectId!,
      league.freeAgentPool
    )
    const updated = applyDraftSelections(league, league, result)

    expect(updated.seasonState.draftState?.selections).toHaveLength(1)
    expect(
      updated.contracts.some(
        (contract) =>
          contract.playerId ===
          updated.seasonState.draftState?.selections[0]?.playerId
      )
    ).toBe(true)
    expect(updated.leagueLog.some((entry) => entry.type === "draft_selection")).toBe(
      true
    )
  })

  it("is idempotent when no new draft selections are added", () => {
    const league = createDraftReadyLeague()
    const unchanged = applyDraftSelections(league, league, {
      seasonState: league.seasonState,
      freeAgentPool: league.freeAgentPool,
    })

    expect(unchanged.leagueLog).toEqual(league.leagueLog)
  })
})
