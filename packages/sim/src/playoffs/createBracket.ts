import type { PlayoffRound, PlayoffSeries } from "@workspace/shared/types"

import type { SeededTeam } from "./seedTeams"

function createSeries(
  id: string,
  season: number,
  round: PlayoffRound,
  higher: SeededTeam,
  lower: SeededTeam,
): PlayoffSeries {
  return {
    id,
    season,
    round,
    conferenceId: higher.conferenceId ?? lower.conferenceId,
    higherSeedTeamId: higher.teamId,
    lowerSeedTeamId: lower.teamId,
    higherSeed: higher.seed,
    lowerSeed: lower.seed,
    winsHigher: 0,
    winsLower: 0,
  }
}

function firstRoundPairings(seeds: SeededTeam[]): [SeededTeam, SeededTeam][] {
  if (seeds.length !== 8) {
    throw new Error(`Expected 8 seeds for conference bracket, got ${seeds.length}`)
  }

  return [
    [seeds[0]!, seeds[7]!],
    [seeds[3]!, seeds[4]!],
    [seeds[1]!, seeds[6]!],
    [seeds[2]!, seeds[5]!],
  ]
}

function createConferenceFirstRound(
  season: number,
  conferenceId: "east" | "west",
  seeds: SeededTeam[],
): PlayoffSeries[] {
  const conferenceSeeds = seeds
    .filter((seed) => seed.conferenceId === conferenceId)
    .sort((a, b) => a.seed - b.seed)

  return firstRoundPairings(conferenceSeeds).map(([higher, lower], index) =>
    createSeries(
      `po_${season}_${conferenceId}_r1_${index}`,
      season,
      1,
      higher,
      lower,
    ),
  )
}

export function createInitialPlayoffSeries(
  season: number,
  teamCount: number,
  seeded: SeededTeam[],
): PlayoffSeries[] {
  if (teamCount === 30) {
    return [
      ...createConferenceFirstRound(season, "east", seeded),
      ...createConferenceFirstRound(season, "west", seeded),
    ]
  }

  if (teamCount === 6) {
    const ordered = [...seeded].sort((a, b) => a.seed - b.seed)
    return [
      createSeries(`po_${season}_sf_0`, season, 1, ordered[0]!, ordered[3]!),
      createSeries(`po_${season}_sf_1`, season, 1, ordered[1]!, ordered[2]!),
    ]
  }

  throw new Error(`Unsupported playoff bracket for ${teamCount} teams`)
}

export function createSeriesFromWinners(
  id: string,
  season: number,
  round: PlayoffRound,
  conferenceId: "east" | "west" | undefined,
  higherWinner: { teamId: string; seed: number },
  lowerWinner: { teamId: string; seed: number },
): PlayoffSeries {
  const higher: SeededTeam = {
    teamId: higherWinner.teamId,
    seed: higherWinner.seed,
    conferenceId,
  }
  const lower: SeededTeam = {
    teamId: lowerWinner.teamId,
    seed: lowerWinner.seed,
    conferenceId,
  }

  return createSeries(id, season, round, higher, lower)
}
