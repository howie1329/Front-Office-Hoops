import {
  createPlayerContractFixture,
  type GameCoachingProfile,
  type GameMatchupFixture,
  type GameSimulationConfig,
  type PlayerEntity,
} from "@workspace/domain-v2"
import { createStandardGameSimulationConfig } from "@workspace/sim-v2"

export type CalibrationFixtureOptions = {
  asymmetricTalent?: boolean
  coaching?: Partial<Record<"home" | "away", Partial<GameCoachingProfile>>>
  manualTargets?: boolean
  injuries?: boolean
}

function createPlayer(
  id: string,
  teamId: string,
  ability: number
): PlayerEntity {
  const player = createPlayerContractFixture({
    id,
    identity: { firstName: id, lastName: "Calibration" },
    leagueStatus: { kind: "rostered", teamId },
  })
  const value = Math.max(20, Math.min(100, ability))
  return {
    ...player,
    profile: {
      ...player.profile,
      skills: {
        shooting: value,
        finishing: value,
        passing: value,
        handling: value,
        rebounding: value,
        defense: value,
        basketballIQ: value,
        stamina: value,
      },
    },
  }
}

function createCoachingProfile(
  overrides: Partial<GameCoachingProfile> = {}
): GameCoachingProfile {
  return {
    pace: 50,
    offensiveStyle: 50,
    defensivePressure: 50,
    shotSelection: 50,
    rotationDepth: 50,
    ...overrides,
  }
}

export function createCalibrationFixture(
  seed: string,
  options: CalibrationFixtureOptions = {}
): GameMatchupFixture {
  const config = createStandardGameSimulationConfig()
  config.injuries = {
    ...config.injuries,
    frequency: options.injuries ? "frequent" : "off",
    inGameInjuries: Boolean(options.injuries),
  }
  const teamIds = ["home", "away"] as const
  const players = Object.fromEntries(
    teamIds.flatMap((teamId) =>
      Array.from({ length: 8 }, (_, index) => {
        const id = teamId + "-" + (index + 1)
        const baseAbility = options.asymmetricTalent
          ? teamId === "home"
            ? index === 0
              ? 98
              : 82
            : index === 0
              ? 58
              : 52
          : index === 0
            ? 92
            : 62
        return [id, createPlayer(id, teamId, baseAbility)]
      })
    )
  )
  const coaching = Object.fromEntries(
    teamIds.map((teamId) => [
      teamId,
      createCoachingProfile(options.coaching?.[teamId]),
    ])
  )
  const rotations = Object.fromEntries(
    teamIds.map((teamId) => {
      const playerIds = Object.keys(players).filter((id) =>
        id.startsWith(teamId + "-")
      )
      return [
        teamId,
        {
          starters: playerIds.slice(0, 5),
          depthOrder: playerIds,
          targetMinutes: Object.fromEntries(
            playerIds.map((playerId, index) => [
              playerId,
              options.manualTargets
                ? index < 5
                  ? 36 - index
                  : 3 + index
                : index < 5
                  ? 32
                  : 8,
            ])
          ),
        },
      ]
    })
  )

  return {
    version: 1,
    source: { kind: "manual", id: "calibration-sensitivity", version: 1 },
    seed,
    homeTeamId: "home",
    awayTeamId: "away",
    teams: {
      home: { id: "home", name: "Home Team" },
      away: { id: "away", name: "Away Team" },
    },
    players,
    rotations,
    availability: Object.fromEntries(
      Object.keys(players).map((playerId) => [
        playerId,
        { available: true, gamesRemaining: 0, restriction: "none" as const },
      ])
    ),
    coaching,
    config,
  }
}

export function createStandardCalibrationFixture(
  seed: string
): GameMatchupFixture {
  return createCalibrationFixture(seed)
}

export function createCoachCalibrationFixture(
  seed: string
): GameMatchupFixture {
  return createCalibrationFixture(seed, {
    coaching: {
      home: {
        pace: 82,
        offensiveStyle: 76,
        defensivePressure: 80,
        shotSelection: 78,
      },
      away: {
        pace: 25,
        offensiveStyle: 30,
        defensivePressure: 25,
        shotSelection: 28,
      },
    },
  })
}

export function createTalentCalibrationFixture(
  seed: string
): GameMatchupFixture {
  return createCalibrationFixture(seed, { asymmetricTalent: true })
}

export function createRotationCalibrationFixture(
  seed: string
): GameMatchupFixture {
  return createCalibrationFixture(seed, { manualTargets: true })
}

export function createInjuryCalibrationFixture(
  seed: string
): GameMatchupFixture {
  return createCalibrationFixture(seed, { injuries: true })
}
