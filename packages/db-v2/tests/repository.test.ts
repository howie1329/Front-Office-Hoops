import { beforeEach, describe, expect, it, vi } from "vitest"

import { createFoundationLeague } from "@workspace/domain-v2"

import {
  LeagueRepositoryError,
  V2LeagueRepository,
  getDb,
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
    const preview = await repository.previewImport(exported)

    expect(imported).toEqual(league)
    expect(preview).toMatchObject({
      status: "ready",
      documentId: league.metadata.id,
    })
  })

  it("does not save invalid documents", async () => {
    await expect(repository.save({} as never)).rejects.toThrow(
      LeagueRepositoryError,
    )
    expect(await repository.list()).toEqual([])
  })

  it("preserves the last good document when a replacement save fails", async () => {
    const original = createFoundationLeague({
      id: "league-recovery",
      name: "Original",
    })
    const replacement = createFoundationLeague({
      id: "league-recovery",
      name: "Replacement",
    })

    await repository.save(original)

    const putSpy = vi
      .spyOn(getDb().leagues, "put")
      .mockRejectedValueOnce(new Error("disk full"))

    await expect(repository.save(replacement)).rejects.toThrow("disk full")
    putSpy.mockRestore()

    expect((await repository.load(original.metadata.id))?.metadata.name).toBe(
      "Original",
    )
  })

  it("removes documents by id", async () => {
    const league = createFoundationLeague({ id: "league-delete" })
    await repository.save(league)

    await repository.remove(league.metadata.id)

    expect(await repository.load(league.metadata.id)).toBeNull()
  })
})
