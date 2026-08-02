import type {
  PlayerAvailability,
  SeasonCheckpointReport,
  SeasonFixture,
  SeasonRunProgress,
  SeasonRunResult,
} from "@workspace/domain-v2"

import { simulateGameMatchup } from "./gameSimulation"
import { createSeasonGameFixture } from "./seasonFixture"
import { aggregateSeasonProduction } from "./production"
import { calculateUniversalPlayerValues } from "./playerValue"

export type SeasonRunnerOptions = {
  onProgress?: (progress: SeasonRunProgress) => void
  onCheckpoint?: (checkpoint: SeasonCheckpointReport) => void
  shouldCancel?: () => boolean
}

function cloneAvailability(
  availability: Record<string, PlayerAvailability>
): Record<string, PlayerAvailability> {
  return structuredClone(availability)
}

function createCheckpoint(
  fixture: SeasonFixture,
  games: SeasonRunResult["games"],
  gamesPerTeam: number,
  evaluationPoint: "preseason" | "checkpoint" | "final"
): SeasonCheckpointReport {
  const aggregation = aggregateSeasonProduction(fixture, games, gamesPerTeam)
  return {
    gamesPerTeam,
    gamesCompleted: games.filter((game) => game.status === "completed").length,
    playerProduction: aggregation.players,
    teamProduction: aggregation.teams,
    leagueSummary: aggregation.league,
    values: calculateUniversalPlayerValues(
      fixture,
      aggregation,
      fixture.config.value,
      gamesPerTeam,
      gamesPerTeam === 0
        ? "preseason"
        : evaluationPoint === "final"
          ? "final"
          : "checkpoint"
    ),
  }
}

function updateAvailabilityAfterGame(
  availability: Record<string, PlayerAvailability>,
  activePlayerIds: Set<string>,
  injuredPlayerIds: Set<string>,
  injuryEvents: Array<{ playerId: string; gamesRemaining: number }>
): void {
  for (const [playerId, player] of Object.entries(availability)) {
    if (
      !activePlayerIds.has(playerId) ||
      player.available ||
      injuredPlayerIds.has(playerId)
    ) {
      continue
    }
    player.gamesRemaining = Math.max(0, player.gamesRemaining - 1)
    if (player.gamesRemaining === 0) {
      player.available = true
      player.restriction = "none"
      delete player.minutesLimit
    }
  }
  for (const event of injuryEvents) {
    const player = availability[event.playerId]
    if (!player) continue
    player.available = false
    player.gamesRemaining = Math.max(1, event.gamesRemaining)
    player.restriction = "none"
    delete player.minutesLimit
  }
}

function checkpointTargets(target: number): number[] {
  return [0, 10, 25, 41, 82].filter((value) => value <= target)
}

function allTeamsReached(
  counts: Record<string, number>,
  teamIds: string[],
  target: number
): boolean {
  return teamIds.every((teamId) => (counts[teamId] ?? 0) >= target)
}

export function runSeason(
  fixture: SeasonFixture,
  options: SeasonRunnerOptions = {}
): SeasonRunResult {
  const teamIds = Object.keys(fixture.teams)
  const games: SeasonRunResult["games"] = []
  const failures: SeasonRunResult["failures"] = []
  const availability = cloneAvailability(fixture.availability)
  const gamesPerTeamCount = Object.fromEntries(teamIds.map((id) => [id, 0]))
  const checkpoints: SeasonCheckpointReport[] = []
  const target = fixture.config.gamesPerTeam
  const targets = checkpointTargets(target)
  const reached = new Set<number>()

  const preseason = createCheckpoint(fixture, games, 0, "preseason")
  checkpoints.push(preseason)
  reached.add(0)
  options.onCheckpoint?.(preseason)

  for (const entry of fixture.schedule) {
    if (options.shouldCancel?.()) {
      return {
        status: "cancelled",
        fixture,
        games,
        checkpoints,
        finalAvailability: availability,
        failures,
      }
    }

    const gameFixture = createSeasonGameFixture(
      fixture,
      entry,
      availability,
      `${fixture.seed}:${entry.id}`
    )
    const result = simulateGameMatchup(gameFixture)
    games.push(result)
    if (result.status !== "completed") {
      failures.push({ scheduleEntry: entry, fixture: gameFixture, result })
    } else {
      gamesPerTeamCount[entry.homeTeamId] =
        (gamesPerTeamCount[entry.homeTeamId] ?? 0) + 1
      gamesPerTeamCount[entry.awayTeamId] =
        (gamesPerTeamCount[entry.awayTeamId] ?? 0) + 1
      const injuryEvents = result.events.map((event) => ({
        playerId: event.playerId,
        gamesRemaining: event.gamesRemaining,
      }))
      const activePlayerIds = new Set([
        ...(fixture.rosters[entry.homeTeamId] ?? []),
        ...(fixture.rosters[entry.awayTeamId] ?? []),
      ])
      updateAvailabilityAfterGame(
        availability,
        activePlayerIds,
        new Set(injuryEvents.map((event) => event.playerId)),
        injuryEvents
      )
    }

    const completedGamesPerTeam = Math.min(...Object.values(gamesPerTeamCount))
    options.onProgress?.({
      gamesCompleted: games.length,
      gamesTotal: fixture.schedule.length,
      gamesPerTeam: completedGamesPerTeam,
      checkpointGamesPerTeam:
        targets.find((value) => value > completedGamesPerTeam) ?? target,
      label: `Simulating ${entry.awayTeamId} at ${entry.homeTeamId}`,
    })

    for (const checkpoint of targets) {
      if (
        reached.has(checkpoint) ||
        !allTeamsReached(gamesPerTeamCount, teamIds, checkpoint)
      ) {
        continue
      }
      const checkpointReport = createCheckpoint(
        fixture,
        games,
        checkpoint,
        checkpoint === target ? "final" : "checkpoint"
      )
      checkpoints.push(checkpointReport)
      reached.add(checkpoint)
      options.onCheckpoint?.(checkpointReport)
    }
  }

  if (!reached.has(target)) {
    const final = createCheckpoint(fixture, games, target, "final")
    checkpoints.push(final)
    reached.add(target)
    options.onCheckpoint?.(final)
  }

  return {
    status: failures.length > 0 ? "failed" : "completed",
    fixture,
    games,
    checkpoints,
    finalAvailability: availability,
    failures,
  }
}
