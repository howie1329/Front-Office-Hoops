import type { DraftPickAsset, LeagueRecord, Player, TeamMode, TeamWithRoster } from "@workspace/shared/types"

import { getPickValueFromCache } from "./draft/pickValues"
import { getSeasonFinancials } from "./financials/capMath"
import { getPlayerContract } from "./financials/payroll"
import { getTeamFinancialPosition } from "./financials/teamFinancialPosition"
import { getContractValueBreakdown } from "./playerValue/contractValue"
import { getProjectedPlayerValueBreakdown } from "./playerValue/projectedValue"
import { selectRotation } from "./selectRotation"
import { estimateTeamDefFactor, estimateTeamOffFactor } from "./teamStrength"

const ROTATION_VALUE_PER_OVERALL = 1.5
const ROTATION_FACTOR_VALUE = 8
const DOMINATED_PLAYER_VALUE_GAP = 6
const DOMINANCE_COMPENSATION_THRESHOLD = 12
const DOMINANCE_PENALTY = 25

export type TeamTradeUtilityBreakdown = {
  incomingAssetValue: number
  outgoingAssetValue: number
  rotationDelta: number
  rosterBalanceDelta: number
  strategyDelta: number
  dominancePenalty: number
  total: number
  reasons: string[]
}

export type TeamTradeUtilityInput = {
  league: LeagueRecord
  team: TeamWithRoster
  outgoingPlayers: Player[]
  incomingPlayers: Player[]
  outgoingPicks: DraftPickAsset[]
  incomingPicks: DraftPickAsset[]
}

function modeFor(league: LeagueRecord, teamId: string): TeamMode {
  return league.teamFinancials.find((entry) => entry.teamId === teamId)?.strategy.mode ?? "buying"
}

function bundle(values: number[]): number {
  if (values.length === 0) return 0
  // A package improves an offer, but cannot linearly turn replacement players into a star.
  return Math.sqrt(values.reduce((sum, value) => sum + Math.max(0, value) ** 2, 0))
}

function playerAssetValue(league: LeagueRecord, team: TeamWithRoster, player: Player): { total: number; financial: number; projected: ReturnType<typeof getProjectedPlayerValueBreakdown> } {
  const projected = getProjectedPlayerValueBreakdown(player, { league })
  const financialSeason = league.leagueFinancials.currentCapSeason
  const financials = getSeasonFinancials(league.leagueFinancials, financialSeason)
  const contract = getPlayerContract(league.contracts, player)
  const finance = league.teamFinancials.find((entry) => entry.teamId === team.id)
  const position = getTeamFinancialPosition(
    league,
    team.id,
    financialSeason,
  )
  const existingSalary =
    contract?.teamId === team.id ? (contract.yearlySalaries[0] ?? 0) : 0
  const financial = getContractValueBreakdown({
    player,
    contract,
    seasonFinancials: financials,
    leagueFinancials: league.leagueFinancials,
    receivingTeamFinancials: finance,
    receivingTeamPayroll: position.taxPayroll - existingSalary,
    projectedPlayerValue: projected,
  }).total
  return { total: projected.total + financial, financial, projected }
}

function pickValue(league: LeagueRecord, teamId: string, pick: DraftPickAsset): number {
  return getPickValueFromCache(pick, league.draftClassCache, league, teamId, modeFor(league, teamId))
}

function rotationValue(players: Player[]): number {
  const rotation = selectRotation(players)
  const totalMinutes = rotation.reduce((sum, entry) => sum + entry.minutes, 0) || 1
  const overall = rotation.reduce((sum, entry) => sum + entry.player.ratings.overall * entry.minutes, 0) / totalMinutes
  return overall * ROTATION_VALUE_PER_OVERALL +
    (estimateTeamOffFactor(rotation) + estimateTeamDefFactor(rotation)) * ROTATION_FACTOR_VALUE
}

function rosterBalance(players: Player[]): number {
  const rotation = selectRotation(players)
  const positionCounts = new Map<string, number>()
  const archetypeCounts = new Map<string, number>()
  for (const entry of rotation) {
    positionCounts.set(entry.player.position, (positionCounts.get(entry.player.position) ?? 0) + 1)
    archetypeCounts.set(entry.player.archetype, (archetypeCounts.get(entry.player.archetype) ?? 0) + 1)
  }
  const coverage = ["PG", "SG", "SF", "PF", "C"].reduce(
    (score, position) => score + ((positionCounts.get(position) ?? 0) === 0 ? -2 : 0),
    0,
  )
  const redundancy = [...archetypeCounts.values()].reduce((score, count) => score + Math.max(0, count - 3) * -0.5, 0)
  return coverage + redundancy
}

export function evaluateTeamTradeUtility(input: TeamTradeUtilityInput): TeamTradeUtilityBreakdown {
  const { league, team, outgoingPlayers, incomingPlayers, outgoingPicks, incomingPicks } = input
  const outgoingIds = new Set(outgoingPlayers.map((player) => player.id))
  const postTradePlayers = [...team.players.filter((player) => !outgoingIds.has(player.id)), ...incomingPlayers]
  const incomingAssets = incomingPlayers.map((player) => playerAssetValue(league, team, player))
  const outgoingAssets = outgoingPlayers.map((player) => playerAssetValue(league, team, player))
  const incomingAssetValue = bundle(incomingAssets.map((asset) => asset.total)) + bundle(incomingPicks.map((pick) => pickValue(league, team.id, pick)))
  const outgoingAssetValue = bundle(outgoingAssets.map((asset) => asset.total)) + bundle(outgoingPicks.map((pick) => pickValue(league, team.id, pick)))
  const rotationDelta = rotationValue(postTradePlayers) - rotationValue(team.players)
  const rosterBalanceDelta = rosterBalance(postTradePlayers) - rosterBalance(team.players)
  const mode = modeFor(league, team.id)
  const incomingPickValue = bundle(incomingPicks.map((pick) => pickValue(league, team.id, pick)))
  const strategyDelta = mode === "selling"
    ? incomingPickValue * 0.12
    : mode === "contending"
      ? Math.max(0, rotationDelta) * 0.5
      : 0
  const reasons: string[] = []
  if (rotationDelta > 0.5) reasons.push("improves projected rotation")
  if (rotationDelta < -0.5) reasons.push("lowers projected rotation")

  const currentRotationIds = new Set(selectRotation(team.players).filter((entry) => entry.minutes >= 20).map((entry) => entry.player.id))
  const dominated = outgoingPlayers.some((outgoingPlayer, index) => {
    const outgoing = outgoingAssets[index]!
    if (!currentRotationIds.has(outgoingPlayer.id)) return false
    return incomingPlayers.some((incomingPlayer, incomingIndex) => {
      const incoming = incomingAssets[incomingIndex]!
      const sameRole = incomingPlayer.position === outgoingPlayer.position && incomingPlayer.archetype === outgoingPlayer.archetype
      const worseFuture = incoming.projected.projectedSeasons[1]!.projectedOverall <= outgoing.projected.projectedSeasons[1]!.projectedOverall
      return sameRole && incoming.projected.total <= outgoing.projected.total - DOMINATED_PLAYER_VALUE_GAP && worseFuture
    })
  })
  const contractRelief = Math.max(0, bundle(incomingAssets.map((asset) => asset.financial)) - bundle(outgoingAssets.map((asset) => asset.financial)))
  const compensation = incomingPickValue + contractRelief
  const dominancePenalty = dominated && compensation < DOMINANCE_COMPENSATION_THRESHOLD ? -DOMINANCE_PENALTY : 0
  if (dominancePenalty) reasons.push("replaces a core player with an older, lower-value same-role player without enough compensation")
  const total = incomingAssetValue - outgoingAssetValue + rotationDelta + rosterBalanceDelta + strategyDelta + dominancePenalty

  return { incomingAssetValue, outgoingAssetValue, rotationDelta, rosterBalanceDelta, strategyDelta, dominancePenalty, total, reasons }
}
