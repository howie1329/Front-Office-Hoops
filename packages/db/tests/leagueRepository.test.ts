import { beforeEach, describe, expect, it } from "vitest"

import { SAVE_VERSION } from "@workspace/shared/leagueTypes"
import type { LeagueRecord } from "@workspace/shared/types"
import { createLeague, createRng } from "@workspace/sim"

import { resetDbForTests } from "../src/db"
import {
  getLeague,
  getMostRecentLeague,
  listLeagues,
  saveLeague,
} from "../src/leagueRepository"

function makeLeague(id: string, name: string): LeagueRecord {
  return createLeague({
    id,
    name,
    baseSeed: `seed-${id}`,
    rng: createRng(`schedule:seed-${id}`),
  })
}

describe("leagueRepository", () => {
  beforeEach(async () => {
    await resetDbForTests()
  })

  it("round-trips a league record", async () => {
    const league = makeLeague("league_a", "League A")
    const saved = await saveLeague(league)
    const loaded = await getLeague(league.id)

    expect(loaded).toEqual(saved)
    expect(loaded?.saveVersion).toBe(SAVE_VERSION)
    expect(loaded?.seasonState.schedule.length).toBe(30)
  })

  it("returns the most recent league by updatedAt", async () => {
    await saveLeague(makeLeague("league_old", "Older"))
    await new Promise((resolve) => setTimeout(resolve, 5))
    await saveLeague(makeLeague("league_new", "Newer"))

    const recent = await getMostRecentLeague()
    expect(recent?.id).toBe("league_new")
  })

  it("lists leagues sorted by updatedAt descending", async () => {
    await saveLeague(makeLeague("league_old", "Older"))
    await new Promise((resolve) => setTimeout(resolve, 5))
    await saveLeague(makeLeague("league_new", "Newer"))

    const list = await listLeagues()
    expect(list.map((row) => row.id)).toEqual(["league_new", "league_old"])
  })

  it("bumps updatedAt when overwriting the same id", async () => {
    const league = makeLeague("league_a", "League A")
    const first = await saveLeague(league)

    await new Promise((resolve) => setTimeout(resolve, 5))

    const second = await saveLeague({
      ...first,
      name: "Renamed League",
    })

    expect(second.updatedAt > first.updatedAt).toBe(true)
    expect((await getLeague(league.id))?.name).toBe("Renamed League")
  })
})
