import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  createFoundationLeague,
  type GameSimulationConfig,
} from "@workspace/domain-v2"

import {
  LeagueRepositoryError,
  V2LeagueRepository,
  getDb,
  resetDbForTests,
} from "../src"

describe("V2LeagueRepository", () => {
  const repository = new V2LeagueRepository()

  function createCustomGameConfig(): GameSimulationConfig {
    return {
      version: 2,
      presetId: "custom",
      environment: {
        pace: 80,
        scoringEnvironment: 50,
        gameVariance: 50,
        talentSeparation: 50,
        homeCourtAdvantage: 50,
      },
      offense: {
        threePointRate: 50,
        rimRate: 50,
        midrangeRate: 50,
        shotSelectionDiscipline: 50,
        starUsage: 50,
        ballMovement: 50,
        isolationRate: 50,
        transitionRate: 50,
        offensiveRebounding: 50,
      },
      defense: {
        pressure: 50,
        helpDefense: 50,
        switching: 50,
        doubleTeamRate: 50,
        turnoverPressure: 50,
        foulDiscipline: 50,
      },
      rotation: {
        adherence: 50,
        benchUsage: 50,
        starterWorkload: 50,
        fatigueImpact: 50,
      },
      coaching: {
        influence: 50,
        paceInfluence: 50,
        shotSelectionInfluence: 50,
        defensiveInfluence: 50,
      },
      injuries: {
        frequency: "off",
        severity: "minor",
        maxGamesOut: 6,
        inGameInjuries: false,
      },
      overtime: {
        enabled: false,
        segmentMinutes: 5,
        maxSegments: 6,
      },
    }
  }

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

  it("persists custom game settings through save, load, export, and import", async () => {
    const league = createFoundationLeague({ id: "league-custom-settings" })
    league.settings.gameConfig = createCustomGameConfig()

    await repository.save(league)

    expect((await repository.load(league.metadata.id))?.settings.gameConfig).toEqual(
      league.settings.gameConfig
    )

    const imported = await repository.import(
      await repository.export(league.metadata.id)
    )
    expect(imported.settings.gameConfig).toEqual(league.settings.gameConfig)
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
