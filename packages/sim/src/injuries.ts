import type {
  Player,
  PlayerGameStats,
  PlayerInjury,
  Rng,
  TeamWithRoster,
} from "@workspace/shared/types"

const BASE_INJURY_RISK = 0.006
const MIN_ACTIVE_FOR_NEW_INJURIES = 8

const MINOR_INJURIES = [
  "minor soreness",
  "ankle tweak",
  "back tightness",
  "wrist sprain",
] as const

const MODERATE_INJURIES = [
  "ankle sprain",
  "hamstring strain",
  "knee soreness",
  "shoulder strain",
] as const

const MAJOR_INJURIES = [
  "severe ankle sprain",
  "knee sprain",
  "foot fracture",
  "back injury",
] as const

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function calculateInjuryRisk(player: Player, minutes: number): number {
  const minutesRisk = Math.max(0, minutes - 28) * 0.0005
  const ageRisk = Math.max(0, player.age - 30) * 0.0004
  const staminaRisk = Math.max(0, 60 - player.ratings.stamina) * 0.0002

  return clamp(
    BASE_INJURY_RISK + minutesRisk + ageRisk + staminaRisk,
    0.003,
    0.025
  )
}

function pickDescription(pool: readonly string[], rng: Rng): string {
  return pool[rng.int(0, pool.length - 1)]!
}

export function rollInjury(rng: Rng): PlayerInjury {
  const roll = rng.next()

  if (roll < 0.65) {
    return {
      type: "minor",
      gamesRemaining: rng.int(1, 3),
      description: pickDescription(MINOR_INJURIES, rng),
    }
  }

  if (roll < 0.93) {
    return {
      type: "moderate",
      gamesRemaining: rng.int(4, 14),
      description: pickDescription(MODERATE_INJURIES, rng),
    }
  }

  return {
    type: "major",
    gamesRemaining: rng.int(15, 45),
    description: pickDescription(MAJOR_INJURIES, rng),
  }
}

export function advanceInjuriesForDay(
  teams: TeamWithRoster[]
): TeamWithRoster[] {
  return teams.map((team) => ({
    ...team,
    players: team.players.map((player) => {
      if (!player.injury || player.status !== "injured") {
        return player
      }

      const gamesRemaining = player.injury.gamesRemaining - 1
      if (gamesRemaining <= 0) {
        return {
          ...player,
          status: "active",
          injury: null,
        }
      }

      return {
        ...player,
        injury: {
          ...player.injury,
          gamesRemaining,
        },
      }
    }),
  }))
}

export function applyPostGameInjuriesToTeam(
  team: TeamWithRoster,
  playerStats: PlayerGameStats[],
  rng: Rng,
  riskMultiplier = 1,
): TeamWithRoster {
  const activeCount = team.players.filter(
    (player) => player.status === "active"
  ).length
  if (activeCount < MIN_ACTIVE_FOR_NEW_INJURIES) {
    return team
  }

  const statsByPlayerId = new Map(
    playerStats.map((line) => [line.playerId, line])
  )

  return {
    ...team,
    players: team.players.map((player) => {
      if (player.status !== "active") {
        return player
      }

      const line = statsByPlayerId.get(player.id)
      if (!line || line.minutes <= 0) {
        return player
      }

      if (rng.next() >= calculateInjuryRisk(player, line.minutes) * riskMultiplier) {
        return player
      }

      return {
        ...player,
        status: "injured",
        injury: rollInjury(rng),
      }
    }),
  }
}

export function applyPostGameInjuries(
  teams: TeamWithRoster[],
  gameTeams: {
    homeTeamId: string
    awayTeamId: string
    homePlayerStats: PlayerGameStats[]
    awayPlayerStats: PlayerGameStats[]
  },
  rng: Rng,
  options?: {
    homeRiskMultiplier?: number
    awayRiskMultiplier?: number
  },
): TeamWithRoster[] {
  return teams.map((team) => {
    if (team.id === gameTeams.homeTeamId) {
      return applyPostGameInjuriesToTeam(
        team,
        gameTeams.homePlayerStats,
        rng,
        options?.homeRiskMultiplier ?? 1,
      )
    }

    if (team.id === gameTeams.awayTeamId) {
      return applyPostGameInjuriesToTeam(
        team,
        gameTeams.awayPlayerStats,
        rng,
        options?.awayRiskMultiplier ?? 1,
      )
    }

    return team
  })
}
