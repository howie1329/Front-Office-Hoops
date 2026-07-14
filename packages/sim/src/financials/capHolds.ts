import type { BirdRightsType, LeagueRecord, Player } from "@workspace/shared/types"

import { createLeagueLogEntry } from "../leagueLog"
import { calculateMaxSalary, getSeasonFinancials, roundMoney } from "./capMath"
import { deriveBirdRights } from "./birdRights"

const HOLD_MULTIPLIER: Record<Exclude<BirdRightsType, "none">, number> = {
  non_bird: 1.2,
  early_bird: 1.3,
  bird: 1.5,
}

export function getActiveCapHold(
  league: LeagueRecord,
  teamId: string,
  playerId: string,
  season: number,
) {
  return league.teamFinancials
    .find((entry) => entry.teamId === teamId)
    ?.capHolds.find(
      (hold) =>
        hold.playerId === playerId &&
        hold.season === season &&
        hold.status === "active",
    )
}

export function addCapHoldForPlayer(
  league: LeagueRecord,
  player: Player,
  teamId: string,
  priorSalary: number,
  season: number,
): LeagueRecord {
  const rightsType = deriveBirdRights(player.seasonsWithTeam)
  if (rightsType === "none") {
    return league
  }
  const financials = getSeasonFinancials(league.leagueFinancials, season)
  const amount = roundMoney(
    Math.min(
      priorSalary * HOLD_MULTIPLIER[rightsType],
      calculateMaxSalary(financials.salaryCap, player.yearsOfService),
    ),
  )

  return {
    ...league,
    teamFinancials: league.teamFinancials.map((entry) =>
      entry.teamId !== teamId
        ? entry
        : {
            ...entry,
            capHolds: [
              ...entry.capHolds.filter(
                (hold) => !(hold.playerId === player.id && hold.season === season),
              ),
              {
                id: `hold_${teamId}_${player.id}_${season}`,
                playerId: player.id,
                teamId,
                season,
                amount,
                rightsType,
                status: "active" as const,
              },
            ],
          },
    ),
  }
}

export function clearCapHoldsForPlayer(
  league: LeagueRecord,
  playerId: string,
): LeagueRecord {
  return {
    ...league,
    teamFinancials: league.teamFinancials.map((entry) => ({
      ...entry,
      capHolds: entry.capHolds.filter((hold) => hold.playerId !== playerId),
    })),
  }
}

export function renouncePlayerRights(
  league: LeagueRecord,
  teamId: string,
  playerId: string,
): LeagueRecord {
  const season = league.seasonState.season + 1
  const hold = getActiveCapHold(league, teamId, playerId, season)
  if (!hold) {
    throw new Error("No active cap hold exists for this player")
  }

  const updated: LeagueRecord = {
    ...league,
    teamFinancials: league.teamFinancials.map((entry) =>
      entry.teamId !== teamId
        ? entry
        : {
            ...entry,
            capHolds: entry.capHolds.map((candidate) =>
              candidate.id === hold.id
                ? { ...candidate, status: "renounced" as const }
                : candidate,
            ),
          },
    ),
  }

  return {
    ...updated,
    leagueLog: [
      ...updated.leagueLog,
      createLeagueLogEntry({
        league: updated,
        type: "rights_renounced",
        teamId,
        playerId,
        payload: { amount: hold.amount, rightsType: hold.rightsType },
      }),
    ],
  }
}
