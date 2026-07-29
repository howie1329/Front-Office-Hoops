import { beforeEach, describe, expect, it } from "vitest"

import { createFoundationLeague } from "@workspace/domain-v2"

import {
  LeagueRepositoryError,
  V2LeagueRepository,
  resetDbForTests,
} from "../src"

describe("V2LeagueRepository", () => {
  const repository = new V2LeagueRepository()

  beforeEach(async () => {
    await resetDbForTests()
  })

  it("saves and loads a v2 document", async () => {
    const league = createFoundationLeague({ id: "league-a", name: "League A" })

    await repository.save(league)

    expect(await repository.load(league.metadata.id)).toEqual(league)
  })

  it("lists documents by metadata update time", async () => {
    const older = createFoundationLeague({
      id: "league-old",
      name: "Older",
      now: "2026-07-29T00:00:00.000Z",
    })
    const newer = createFoundationLeague({
      id: "league-new",
      name: "Newer",
      now: "2026-07-30T00:00:00.000Z",
    })

    await repository.save(older)
    await repository.save(newer)

    expect((await repository.list()).map((row) => row.id)).toEqual([
      "league-new",
      "league-old",
    ])
  })

  it("round-trips JSON export and import", async () => {
    const league = createFoundationLeague({ id: "league-export" })
    await repository.save(league)

    const exported = await repository.export(league.metadata.id)
    const imported = await repository.import(exported)

    expect(imported).toEqual(league)
  })

  it("does not save invalid documents", async () => {
    await expect(repository.save({} as never)).rejects.toThrow(
      LeagueRepositoryError,
    )
    expect(await repository.list()).toEqual([])
  })

  it("removes documents by id", async () => {
    const league = createFoundationLeague({ id: "league-delete" })
    await repository.save(league)

    await repository.remove(league.metadata.id)

    expect(await repository.load(league.metadata.id)).toBeNull()
  })
})
