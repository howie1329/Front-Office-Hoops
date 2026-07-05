import { ROSTER_MAX, ROSTER_MIN } from "@workspace/shared/constants"
import type {
  Contract,
  DraftPickAsset,
  LeagueRecord,
  Player,
  TeamMode,
  TeamWithRoster,
  TradeEvaluation,
  TradeProposal,
  TradeResult,
  TradeValidationResult,
} from "@workspace/shared/types"

import { deriveTeamOverall } from "./playerRatings"
import { getContractAssetValueBreakdown } from "./playerValue"
import { getSeasonFinancials } from "./financials/capMath"
import {
  getCurrentSalary,
  getPlayerContract,
  getTeamPayroll,
  getYearsRemaining,
} from "./financials/payroll"
import { buildFairSalary } from "./financials/ai/offers"
import { canTradeOnDate } from "./calendar"
import { createLeagueLogEntry } from "./leagueLog"

const SALARY_MATCH_MULTIPLIER = 1.25
const SALARY_MATCH_BUFFER = 0.1
const AI_ACCEPT_TOLERANCE = 4

type TradeContext = {
  fromTeam: TeamWithRoster
  toTeam: TeamWithRoster
  fromPlayers: Player[]
  toPlayers: Player[]
  fromPicks: DraftPickAsset[]
  toPicks: DraftPickAsset[]
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function findTeam(
  league: LeagueRecord,
  teamId: string
): TeamWithRoster | undefined {
  return league.seasonState.teams.find((team) => team.id === teamId)
}

function findPlayers(team: TeamWithRoster, playerIds: string[]): Player[] {
  const ids = new Set(playerIds)
  return team.players.filter((player) => ids.has(player.id))
}

function findPicks(
  league: LeagueRecord,
  teamId: string,
  pickIds: string[]
): DraftPickAsset[] {
  const ids = new Set(pickIds)
  return league.draftPickAssets.filter(
    (pick) => ids.has(pick.id) && pick.currentTeamId === teamId
  )
}

function getTeamMode(league: LeagueRecord, teamId: string): TeamMode {
  return (
    league.teamFinancials.find((entry) => entry.teamId === teamId)?.strategy
      .mode ?? "buying"
  )
}

function getContext(
  league: LeagueRecord,
  proposal: TradeProposal
): TradeContext | TradeValidationResult {
  if (proposal.from.teamId === proposal.to.teamId) {
    return { ok: false, reason: "Trade teams must be different" }
  }

  const fromIds = unique(proposal.from.playerIds)
  const toIds = unique(proposal.to.playerIds)
  const fromPickIds = unique(proposal.from.pickIds ?? [])
  const toPickIds = unique(proposal.to.pickIds ?? [])
  if (
    fromIds.length === 0 &&
    toIds.length === 0 &&
    fromPickIds.length === 0 &&
    toPickIds.length === 0
  ) {
    return { ok: false, reason: "Trade must include at least one asset" }
  }
  if (
    fromIds.length !== proposal.from.playerIds.length ||
    toIds.length !== proposal.to.playerIds.length ||
    fromPickIds.length !== (proposal.from.pickIds ?? []).length ||
    toPickIds.length !== (proposal.to.pickIds ?? []).length
  ) {
    return { ok: false, reason: "Trade contains duplicate assets" }
  }

  const fromTeam = findTeam(league, proposal.from.teamId)
  const toTeam = findTeam(league, proposal.to.teamId)
  if (!fromTeam || !toTeam) {
    return { ok: false, reason: "Trade team not found" }
  }

  const fromPlayers = findPlayers(fromTeam, fromIds)
  const toPlayers = findPlayers(toTeam, toIds)
  const fromPicks = findPicks(league, fromTeam.id, fromPickIds)
  const toPicks = findPicks(league, toTeam.id, toPickIds)
  if (
    fromPlayers.length !== fromIds.length ||
    toPlayers.length !== toIds.length
  ) {
    return { ok: false, reason: "Trade player not found on expected team" }
  }
  if (
    fromPicks.length !== fromPickIds.length ||
    toPicks.length !== toPickIds.length
  ) {
    return { ok: false, reason: "Trade pick not found on expected team" }
  }

  return { fromTeam, toTeam, fromPlayers, toPlayers, fromPicks, toPicks }
}

function validatePlayerContracts(
  league: LeagueRecord,
  players: Player[]
): TradeValidationResult {
  for (const player of players) {
    if (player.status === "free_agent") {
      return { ok: false, reason: "Free agents cannot be traded" }
    }

    const contract = getPlayerContract(league.contracts, player)
    if (!contract || contract.status !== "active") {
      return { ok: false, reason: "All traded players need active contracts" }
    }
  }

  return { ok: true }
}

function validateRosterSizes(context: TradeContext): TradeValidationResult {
  const fromRosterSize =
    context.fromTeam.players.length -
    context.fromPlayers.length +
    context.toPlayers.length
  const toRosterSize =
    context.toTeam.players.length -
    context.toPlayers.length +
    context.fromPlayers.length

  if (fromRosterSize < ROSTER_MIN || toRosterSize < ROSTER_MIN) {
    return {
      ok: false,
      reason: "Trade would leave a team below the roster minimum",
    }
  }
  if (fromRosterSize > ROSTER_MAX || toRosterSize > ROSTER_MAX) {
    return { ok: false, reason: "Trade would put a team over the roster limit" }
  }

  return { ok: true }
}

function sumSalary(league: LeagueRecord, players: Player[]): number {
  return players.reduce(
    (sum, player) =>
      sum + getCurrentSalary(getPlayerContract(league.contracts, player)),
    0
  )
}

function canAbsorbIncomingSalary({
  payroll,
  salaryCap,
  outgoingSalary,
  incomingSalary,
}: {
  payroll: number
  salaryCap: number
  outgoingSalary: number
  incomingSalary: number
}): boolean {
  const capRoomAfterOutgoing = Math.max(
    0,
    salaryCap - (payroll - outgoingSalary)
  )
  if (capRoomAfterOutgoing >= incomingSalary) {
    return true
  }

  return (
    incomingSalary <=
    outgoingSalary * SALARY_MATCH_MULTIPLIER + SALARY_MATCH_BUFFER
  )
}

function validateSalaryMatching(
  league: LeagueRecord,
  context: TradeContext
): TradeValidationResult {
  const seasonFinancials = getSeasonFinancials(
    league.leagueFinancials,
    league.seasonState.season
  )
  const fromOutgoing = sumSalary(league, context.fromPlayers)
  const fromIncoming = sumSalary(league, context.toPlayers)
  const toOutgoing = sumSalary(league, context.toPlayers)
  const toIncoming = sumSalary(league, context.fromPlayers)

  const fromCanTrade = canAbsorbIncomingSalary({
    payroll: getTeamPayroll(context.fromTeam.id, league.contracts),
    salaryCap: seasonFinancials.salaryCap,
    outgoingSalary: fromOutgoing,
    incomingSalary: fromIncoming,
  })
  if (!fromCanTrade) {
    return { ok: false, reason: "Trade fails salary matching for sending team" }
  }

  const toCanTrade = canAbsorbIncomingSalary({
    payroll: getTeamPayroll(context.toTeam.id, league.contracts),
    salaryCap: seasonFinancials.salaryCap,
    outgoingSalary: toOutgoing,
    incomingSalary: toIncoming,
  })
  if (!toCanTrade) {
    return {
      ok: false,
      reason: "Trade fails salary matching for receiving team",
    }
  }

  return { ok: true }
}

export function validateTrade(
  league: LeagueRecord,
  proposal: TradeProposal
): TradeValidationResult {
  if (!canTradeOnDate(league.seasonState)) {
    return { ok: false, reason: "Trades are closed until the offseason" }
  }

  const context = getContext(league, proposal)
  if ("ok" in context) {
    return context
  }

  const contractsValid = validatePlayerContracts(league, [
    ...context.fromPlayers,
    ...context.toPlayers,
  ])
  if (!contractsValid.ok) {
    return contractsValid
  }

  const rostersValid = validateRosterSizes(context)
  if (!rostersValid.ok) {
    return rostersValid
  }

  return validateSalaryMatching(league, context)
}

function getTeamWinPct(league: LeagueRecord, teamId: string): number {
  const standing = league.seasonState.standings.find(
    (entry) => entry.teamId === teamId
  )
  if (!standing) {
    return 0.5
  }

  const games = standing.wins + standing.losses
  return games === 0 ? 0.5 : standing.wins / games
}

function rosterFitValue(
  team: TeamWithRoster,
  player: Player,
  mode: TeamMode
): number {
  const positionCount = team.players.filter(
    (entry) => entry.position === player.position
  ).length
  const archetypeCount = team.players.filter(
    (entry) => entry.archetype === player.archetype
  ).length
  let value = 0

  if (positionCount <= 1) {
    value += mode === "contending" ? 4 : 2.5
  } else if (positionCount >= 4) {
    value -= mode === "selling" ? 0.5 : 2
  }

  if (
    player.archetype === "three_and_d_wing" ||
    player.archetype === "rim_protector" ||
    player.archetype === "lead_guard" ||
    player.archetype === "stretch_big"
  ) {
    value += archetypeCount === 0 ? 2 : 0.75
  }

  return value
}

function strategyPlayerAdjustment(
  mode: TeamMode,
  player: Player,
  contract: Contract | undefined
): number {
  const salary = getCurrentSalary(contract)
  const yearsRemaining = getYearsRemaining(contract)
  const upside = Math.max(0, player.ratings.potential - player.ratings.overall)
  const isExpiring = yearsRemaining <= 1
  const longExpensiveDeal = yearsRemaining >= 3 && salary >= 15

  switch (mode) {
    case "selling":
      return (
        upside * 0.45 +
        (player.age <= 24 ? 5 : 0) +
        (isExpiring ? 5 : 0) -
        (player.age >= 31 ? 6 : 0) -
        (longExpensiveDeal ? 8 : 0)
      )
    case "buying":
      return (
        (player.ratings.overall >= 72 ? 4 : 0) +
        (salary <= 12 && player.ratings.overall >= 68 ? 3 : 0) -
        (longExpensiveDeal && player.ratings.overall < 74 ? 4 : 0)
      )
    case "contending":
      return (
        (player.ratings.overall >= 76 ? 9 : 0) +
        (player.ratings.overall >= 70 ? 4 : 0) -
        (player.age <= 22 && player.ratings.overall < 68 ? 5 : 0) -
        upside * 0.15
      )
  }
}

function valuePlayerForTeam(
  league: LeagueRecord,
  team: TeamWithRoster,
  player: Player
): number {
  const seasonFinancials = getSeasonFinancials(
    league.leagueFinancials,
    league.seasonState.season
  )
  const mode = getTeamMode(league, team.id)
  const contract = getPlayerContract(league.contracts, player)
  const expectedSalary = buildFairSalary(player, seasonFinancials)
  const baseValue = getContractAssetValueBreakdown({
    player,
    contract,
    expectedSalary,
    mode,
  }).total

  return (
    baseValue +
    strategyPlayerAdjustment(mode, player, contract) +
    rosterFitValue(team, player, mode)
  )
}

function strategyPickMultiplier(mode: TeamMode, pick: DraftPickAsset): number {
  switch (mode) {
    case "selling":
      return pick.round === 1 ? 1.35 : 1.2
    case "buying":
      return pick.round === 1 ? 0.95 : 0.9
    case "contending":
      return pick.season <= 2 ? 0.8 : 0.65
  }
}

function valuePickForTeam(
  league: LeagueRecord,
  teamId: string,
  pick: DraftPickAsset
): number {
  const mode = getTeamMode(league, teamId)
  const winPct = getTeamWinPct(league, pick.originalTeamId)
  const teamQualityDiscount =
    pick.round === 1 ? (1 - winPct) * 28 : (1 - winPct) * 7
  const baseValue = pick.round === 1 ? 18 : 5
  const yearsAway = Math.max(0, pick.season - (league.seasonState.season + 1))
  const distanceMultiplier = Math.max(0.55, 1 - yearsAway * 0.12)

  return (
    (baseValue + teamQualityDiscount) *
    distanceMultiplier *
    strategyPickMultiplier(mode, pick)
  )
}

function valuePlayersForTeam(
  league: LeagueRecord,
  team: TeamWithRoster,
  players: Player[]
): number {
  return players.reduce(
    (sum, player) => sum + valuePlayerForTeam(league, team, player),
    0
  )
}

function valuePicksForTeam(
  league: LeagueRecord,
  teamId: string,
  picks: DraftPickAsset[]
): number {
  return picks.reduce(
    (sum, pick) => sum + valuePickForTeam(league, teamId, pick),
    0
  )
}

export function evaluateTrade(
  league: LeagueRecord,
  proposal: TradeProposal
): TradeEvaluation[] {
  const context = getContext(league, proposal)
  if ("ok" in context) {
    return []
  }

  const fromIncomingValue =
    valuePlayersForTeam(league, context.fromTeam, context.toPlayers) +
    valuePicksForTeam(league, context.fromTeam.id, context.toPicks)
  const fromOutgoingValue =
    valuePlayersForTeam(league, context.fromTeam, context.fromPlayers) +
    valuePicksForTeam(league, context.fromTeam.id, context.fromPicks)
  const toIncomingValue =
    valuePlayersForTeam(league, context.toTeam, context.fromPlayers) +
    valuePicksForTeam(league, context.toTeam.id, context.fromPicks)
  const toOutgoingValue =
    valuePlayersForTeam(league, context.toTeam, context.toPlayers) +
    valuePicksForTeam(league, context.toTeam.id, context.toPicks)

  return [
    {
      teamId: context.fromTeam.id,
      incomingValue: fromIncomingValue,
      outgoingValue: fromOutgoingValue,
      netValue: fromIncomingValue - fromOutgoingValue,
    },
    {
      teamId: context.toTeam.id,
      incomingValue: toIncomingValue,
      outgoingValue: toOutgoingValue,
      netValue: toIncomingValue - toOutgoingValue,
    },
  ]
}

export function wouldAiAcceptTrade(
  league: LeagueRecord,
  proposal: TradeProposal,
  aiTeamId: string
): TradeValidationResult {
  const validation = validateTrade(league, proposal)
  if (!validation.ok) {
    return validation
  }

  const evaluation = evaluateTrade(league, proposal).find(
    (entry) => entry.teamId === aiTeamId
  )
  if (!evaluation) {
    return { ok: false, reason: "AI team is not part of this trade" }
  }

  if (evaluation.netValue < -AI_ACCEPT_TOLERANCE) {
    const mode = getTeamMode(league, aiTeamId)
    if (mode === "selling") {
      return { ok: false, reason: "They want draft picks or cap relief" }
    }
    if (mode === "contending") {
      return { ok: false, reason: "They need more win-now value" }
    }
    return { ok: false, reason: "Other team rejects the trade value" }
  }

  return { ok: true }
}

function tradePlayer(
  player: Player,
  fromTeamId: string,
  toTeamId: string
): Player {
  if (player.teamId !== fromTeamId) {
    return player
  }

  return {
    ...player,
    teamId: toTeamId,
    seasonsWithTeam: 0,
  }
}

function updateTeamPlayers(
  team: TeamWithRoster,
  outgoingIds: Set<string>,
  incomingPlayers: Player[]
): TeamWithRoster {
  const players = [
    ...team.players.filter((player) => !outgoingIds.has(player.id)),
    ...incomingPlayers,
  ]

  return {
    ...team,
    players,
    overall: deriveTeamOverall(players),
  }
}

function tradeContract(
  contract: Contract,
  playerIds: Set<string>,
  newTeamId: string
): Contract {
  if (!playerIds.has(contract.playerId) || contract.status !== "active") {
    return contract
  }

  return {
    ...contract,
    teamId: newTeamId,
  }
}

function tradePick(
  pick: DraftPickAsset,
  pickIds: Set<string>,
  newTeamId: string
): DraftPickAsset {
  if (!pickIds.has(pick.id)) {
    return pick
  }

  return {
    ...pick,
    currentTeamId: newTeamId,
  }
}

function createTradeHistoryEntry(
  league: LeagueRecord,
  proposal: TradeProposal,
  context: TradeContext
) {
  const evaluations = evaluateTrade(league, proposal)
  const fromEvaluation = evaluations.find(
    (entry) => entry.teamId === context.fromTeam.id
  )
  const toEvaluation = evaluations.find(
    (entry) => entry.teamId === context.toTeam.id
  )

  return {
    id: `trade_${league.seasonState.season}_${league.seasonState.currentDay}_${league.tradeHistory.length + 1}`,
    season: league.seasonState.season,
    day: league.seasonState.currentDay,
    phase: league.seasonState.phase,
    createdAt: new Date().toISOString(),
    teams: [
      {
        teamId: context.fromTeam.id,
        sentPlayerIds: context.fromPlayers.map((player) => player.id),
        receivedPlayerIds: context.toPlayers.map((player) => player.id),
        sentPickIds: context.fromPicks.map((pick) => pick.id),
        receivedPickIds: context.toPicks.map((pick) => pick.id),
        outgoingSalary: sumSalary(league, context.fromPlayers),
        incomingSalary: sumSalary(league, context.toPlayers),
        netValue: fromEvaluation?.netValue ?? 0,
      },
      {
        teamId: context.toTeam.id,
        sentPlayerIds: context.toPlayers.map((player) => player.id),
        receivedPlayerIds: context.fromPlayers.map((player) => player.id),
        sentPickIds: context.toPicks.map((pick) => pick.id),
        receivedPickIds: context.fromPicks.map((pick) => pick.id),
        outgoingSalary: sumSalary(league, context.toPlayers),
        incomingSalary: sumSalary(league, context.fromPlayers),
        netValue: toEvaluation?.netValue ?? 0,
      },
    ],
  }
}

export function executeTrade(
  league: LeagueRecord,
  proposal: TradeProposal
): LeagueRecord {
  const validation = validateTrade(league, proposal)
  if (!validation.ok) {
    throw new Error(validation.reason)
  }

  const context = getContext(league, proposal)
  if ("ok" in context) {
    throw new Error(context.ok ? "Invalid trade context" : context.reason)
  }

  const fromIds = new Set(context.fromPlayers.map((player) => player.id))
  const toIds = new Set(context.toPlayers.map((player) => player.id))
  const fromPickIds = new Set(context.fromPicks.map((pick) => pick.id))
  const toPickIds = new Set(context.toPicks.map((pick) => pick.id))
  const playersToFrom = context.toPlayers.map((player) =>
    tradePlayer(player, context.toTeam.id, context.fromTeam.id)
  )
  const playersToTo = context.fromPlayers.map((player) =>
    tradePlayer(player, context.fromTeam.id, context.toTeam.id)
  )

  const tradeHistoryEntry = createTradeHistoryEntry(league, proposal, context)
  const logEntry = createLeagueLogEntry({
    league,
    type: "trade",
    payload: {
      fromTeamId: context.fromTeam.id,
      toTeamId: context.toTeam.id,
      fromPlayerIds: context.fromPlayers.map((player) => player.id),
      toPlayerIds: context.toPlayers.map((player) => player.id),
      fromPickIds: context.fromPicks.map((pick) => pick.id),
      toPickIds: context.toPicks.map((pick) => pick.id),
    },
  })

  return {
    ...league,
    contracts: league.contracts.map((contract) => {
      const tradedFrom = tradeContract(contract, fromIds, context.toTeam.id)
      return tradeContract(tradedFrom, toIds, context.fromTeam.id)
    }),
    draftPickAssets: league.draftPickAssets.map((pick) => {
      const tradedFrom = tradePick(pick, fromPickIds, context.toTeam.id)
      return tradePick(tradedFrom, toPickIds, context.fromTeam.id)
    }),
    tradeHistory: [...league.tradeHistory, tradeHistoryEntry],
    leagueLog: [...league.leagueLog, logEntry],
    seasonState: {
      ...league.seasonState,
      teams: league.seasonState.teams.map((team) => {
        if (team.id === context.fromTeam.id) {
          return updateTeamPlayers(team, fromIds, playersToFrom)
        }
        if (team.id === context.toTeam.id) {
          return updateTeamPlayers(team, toIds, playersToTo)
        }
        return team
      }),
    },
  }
}

export function proposeTrade(
  league: LeagueRecord,
  proposal: TradeProposal,
  aiTeamId?: string
): TradeResult {
  const validation = aiTeamId
    ? wouldAiAcceptTrade(league, proposal, aiTeamId)
    : validateTrade(league, proposal)
  if (!validation.ok) {
    throw new Error(validation.reason)
  }

  return {
    proposal,
    evaluations: evaluateTrade(league, proposal),
  }
}
