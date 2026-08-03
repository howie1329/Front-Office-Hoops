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

  it("lists the selected team in a league summary", async () => {
    const league = createFoundationLeague({ id: "league-team" })
    league.state.userTeamId = "team:01"
    league.entities.teams["team:01"] = {
      id: "team:01",
      name: "Harbor City",
    }

    await repository.save(league)

    expect(await repository.list()).toEqual([
      expect.objectContaining({ teamName: "Harbor City" }),
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
      LeagueRepositoryError
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
      "Original"
    )
  })

  it("round-trips and removes a validated recovery checkpoint", async () => {
    const league = createFoundationLeague({ id: "league-checkpoint" })
    const checkpoint = {
      id: "league-checkpoint:command-1",
      leagueId: league.metadata.id,
      commandId: "command-1",
      currentDate: league.state.calendar.currentDate,
      completedGames: 0,
      createdAt: "2026-08-02T00:00:00.000Z",
      league,
    }

    await repository.saveCheckpoint(checkpoint)

    expect(
      await repository.loadCheckpoint(league.metadata.id, checkpoint.commandId)
    ).toEqual(checkpoint)

    await repository.removeCheckpoint(league.metadata.id, checkpoint.commandId)

    expect(
      await repository.loadCheckpoint(league.metadata.id, checkpoint.commandId)
    ).toBeNull()
  })

  it("removes documents by id", async () => {
    const league = createFoundationLeague({ id: "league-delete" })
    await repository.save(league)

    await repository.remove(league.metadata.id)

    expect(await repository.load(league.metadata.id)).toBeNull()
  })
})
