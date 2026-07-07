import { ROSTER_MAX, ROSTER_MIN } from "@workspace/shared/constants"
import {
  AI_ACCEPT_BAD,
  AI_ACCEPT_CLOSE,
  AI_ACCEPT_MIN_NET,
  AI_TRADE_MAX_IMBALANCE,
  AI_TRADE_OFFER_EXPIRY_DAYS,
  CONTENDING_TRADE_FIT_TOLERANCE,
  TRADE_MORATORIUM_GAMES,
  TRADE_VALUE_EXPONENT,
} from "@workspace/shared/financialConstants"
import type {
  Contract,
  DraftPickAsset,
  LeagueRecord,
  PendingTradeOffer,
  Player,
  Rng,
  TeamMode,
  TeamWithRoster,
  TradeEvaluation,
  TradeProposal,
  TradeResult,
  TradeValidationResult,
} from "@workspace/shared/types"

import { canTradeOnDate } from "./calendar"
import { getPickValueFromCache } from "./draft/pickValues"
import { getSeasonFinancials } from "./financials/capMath"
import { buildFairSalary } from "./financials/ai/offers"
import {
  consumeTradeExceptions,
  createTradeException,
  getAvailableTpeAmount,
} from "./financials/tradeExceptions"
import {
  getCurrentSalary,
  getPlayerContract,
  getTeamPayroll,
  getYearsRemaining,
} from "./financials/payroll"
import { createLeagueLogEntry } from "./leagueLog"
import { deriveTeamOverall } from "./playerRatings"
import { getContractAssetValueBreakdown } from "./playerValue"
import {
  findPlayersOnTeam,
  findTeam,
} from "./roster/ledger"

const SALARY_MATCH_MULTIPLIER = 1.25
const SALARY_MATCH_BUFFER = 0.1
const INCOMING_INJURY_DISCOUNT = 0.85

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

function findPicks(
  league: LeagueRecord,
  teamId: string,
  pickIds: string[],
): DraftPickAsset[] {
  const ids = new Set(pickIds)
  return league.draftPickAssets.filter(
    (pick) => ids.has(pick.id) && pick.currentTeamId === teamId,
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
  proposal: TradeProposal,
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

  const fromPlayers = findPlayersOnTeam(fromTeam, fromIds)
  const toPlayers = findPlayersOnTeam(toTeam, toIds)
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
  players: Player[],
): TradeValidationResult {
  for (const player of players) {
    if (player.status !== "active") {
      return { ok: false, reason: "Only active players can be traded" }
    }

    const contract = getPlayerContract(league.contracts, player)
    if (!contract || contract.status !== "active") {
      return { ok: false, reason: "All traded players need active contracts" }
    }

    if (
      contract.tradableAfterDay != null &&
      contract.tradableAfterDay > league.seasonState.currentDay
    ) {
      return { ok: false, reason: "Player is in trade moratorium period" }
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
    0,
  )
}

function getMaxAbsorbableIncomingSalary({
  payroll,
  salaryCap,
  outgoingSalary,
  tradeExceptions,
}: {
  payroll: number
  salaryCap: number
  outgoingSalary: number
  tradeExceptions: LeagueRecord["teamFinancials"][number]["tradeExceptions"]
}): number {
  const capRoomAfterOutgoing = Math.max(
    0,
    salaryCap - (payroll - outgoingSalary),
  )
  const baseMatch =
    outgoingSalary * SALARY_MATCH_MULTIPLIER + SALARY_MATCH_BUFFER
  return capRoomAfterOutgoing + baseMatch + getAvailableTpeAmount(tradeExceptions)
}

function canAbsorbIncomingSalary({
  payroll,
  salaryCap,
  outgoingSalary,
  incomingSalary,
  tradeExceptions,
}: {
  payroll: number
  salaryCap: number
  outgoingSalary: number
  incomingSalary: number
  tradeExceptions: LeagueRecord["teamFinancials"][number]["tradeExceptions"]
}): boolean {
  return (
    incomingSalary <=
    getMaxAbsorbableIncomingSalary({
      payroll,
      salaryCap,
      outgoingSalary,
      tradeExceptions,
    })
  )
}

function validateSalaryMatching(
  league: LeagueRecord,
  context: TradeContext,
): TradeValidationResult {
  const seasonFinancials = getSeasonFinancials(
    league.leagueFinancials,
    league.seasonState.season,
  )
  const fromOutgoing = sumSalary(league, context.fromPlayers)
  const fromIncoming = sumSalary(league, context.toPlayers)
  const toOutgoing = sumSalary(league, context.toPlayers)
  const toIncoming = sumSalary(league, context.fromPlayers)

  const fromFinance = league.teamFinancials.find(
    (entry) => entry.teamId === context.fromTeam.id,
  )
  const toFinance = league.teamFinancials.find(
    (entry) => entry.teamId === context.toTeam.id,
  )

  const fromCanTrade = canAbsorbIncomingSalary({
    payroll: getTeamPayroll(context.fromTeam.id, league.contracts),
    salaryCap: seasonFinancials.salaryCap,
    outgoingSalary: fromOutgoing,
    incomingSalary: fromIncoming,
    tradeExceptions: fromFinance?.tradeExceptions ?? [],
  })
  if (!fromCanTrade) {
    return { ok: false, reason: "Trade fails salary matching for sending team" }
  }

  const toCanTrade = canAbsorbIncomingSalary({
    payroll: getTeamPayroll(context.toTeam.id, league.contracts),
    salaryCap: seasonFinancials.salaryCap,
    outgoingSalary: toOutgoing,
    incomingSalary: toIncoming,
    tradeExceptions: toFinance?.tradeExceptions ?? [],
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
  proposal: TradeProposal,
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

function rosterFitValue(
  team: TeamWithRoster,
  player: Player,
  mode: TeamMode,
): number {
  const positionCount = team.players.filter(
    (entry) => entry.position === player.position,
  ).length
  const archetypeCount = team.players.filter(
    (entry) => entry.archetype === player.archetype,
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
  contract: Contract | undefined,
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
  player: Player,
  options: { incoming?: boolean } = {},
): number {
  const seasonFinancials = getSeasonFinancials(
    league.leagueFinancials,
    league.seasonState.season,
  )
  const mode = getTeamMode(league, team.id)
  const contract = getPlayerContract(league.contracts, player)
  const expectedSalary = buildFairSalary(player, seasonFinancials, league)
  let value =
    getContractAssetValueBreakdown({
      player,
      contract,
      expectedSalary,
      mode,
    }).total +
    strategyPlayerAdjustment(mode, player, contract) +
    rosterFitValue(team, player, mode)

  if (options.incoming && (player.status === "injured" || player.injury)) {
    value *= INCOMING_INJURY_DISCOUNT
  }

  return value
}

function valuePickForTeam(
  league: LeagueRecord,
  teamId: string,
  pick: DraftPickAsset,
): number {
  const mode = getTeamMode(league, teamId)
  return getPickValueFromCache(
    pick,
    league.draftClassCache,
    league,
    teamId,
    mode,
  )
}

function bundleAssetValues(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  const bundled = values.reduce(
    (sum, value) => sum + Math.max(0, value) ** TRADE_VALUE_EXPONENT,
    0,
  )
  return bundled ** (1 / TRADE_VALUE_EXPONENT)
}

function valuePlayersForTeam(
  league: LeagueRecord,
  team: TeamWithRoster,
  players: Player[],
  options: { incoming?: boolean } = {},
): number {
  return bundleAssetValues(
    players.map((player) =>
      valuePlayerForTeam(league, team, player, options),
    ),
  )
}

function valuePicksForTeam(
  league: LeagueRecord,
  teamId: string,
  picks: DraftPickAsset[],
): number {
  return bundleAssetValues(
    picks.map((pick) => valuePickForTeam(league, teamId, pick)),
  )
}

export function evaluateTrade(
  league: LeagueRecord,
  proposal: TradeProposal,
): TradeEvaluation[] {
  const context = getContext(league, proposal)
  if ("ok" in context) {
    return []
  }

  const fromIncomingValue =
    valuePlayersForTeam(league, context.fromTeam, context.toPlayers, {
      incoming: true,
    }) + valuePicksForTeam(league, context.fromTeam.id, context.toPicks)
  const fromOutgoingValue =
    valuePlayersForTeam(league, context.fromTeam, context.fromPlayers) +
    valuePicksForTeam(league, context.fromTeam.id, context.fromPicks)
  const toIncomingValue =
    valuePlayersForTeam(league, context.toTeam, context.fromPlayers, {
      incoming: true,
    }) + valuePicksForTeam(league, context.toTeam.id, context.fromPicks)
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

function getAiAcceptThreshold(mode: TeamMode): number {
  switch (mode) {
    case "selling":
      return AI_ACCEPT_BAD
    case "contending":
      return AI_ACCEPT_CLOSE + CONTENDING_TRADE_FIT_TOLERANCE
    case "buying":
      return AI_ACCEPT_MIN_NET
  }
}

function aiRejectReason(mode: TeamMode): string {
  switch (mode) {
    case "selling":
      return "They want draft picks or cap relief"
    case "contending":
      return "They need more win-now value"
    case "buying":
      return "Other team rejects the trade value"
  }
}

export function wouldAiAcceptTrade(
  league: LeagueRecord,
  proposal: TradeProposal,
  aiTeamId: string,
): TradeValidationResult {
  const validation = validateTrade(league, proposal)
  if (!validation.ok) {
    return validation
  }

  const evaluation = evaluateTrade(league, proposal).find(
    (entry) => entry.teamId === aiTeamId,
  )
  if (!evaluation) {
    return { ok: false, reason: "AI team is not part of this trade" }
  }

  const mode = getTeamMode(league, aiTeamId)
  if (evaluation.netValue < getAiAcceptThreshold(mode)) {
    return { ok: false, reason: aiRejectReason(mode) }
  }

  return { ok: true }
}

function tradePlayer(
  player: Player,
  fromTeamId: string,
  toTeamId: string,
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
  incomingPlayers: Player[],
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
  newTeamId: string,
  tradableAfterDay: number,
): Contract {
  if (!playerIds.has(contract.playerId) || contract.status !== "active") {
    return contract
  }

  return {
    ...contract,
    teamId: newTeamId,
    tradableAfterDay,
  }
}

function tradePick(
  pick: DraftPickAsset,
  pickIds: Set<string>,
  newTeamId: string,
): DraftPickAsset {
  if (!pickIds.has(pick.id)) {
    return pick
  }

  return {
    ...pick,
    currentTeamId: newTeamId,
  }
}

function applyTradeExceptionsForTeam({
  teamId,
  outgoingSalary,
  incomingSalary,
  teamFinancials,
}: {
  teamId: string
  outgoingSalary: number
  incomingSalary: number
  teamFinancials: LeagueRecord["teamFinancials"]
}): LeagueRecord["teamFinancials"] {
  const gap = Math.max(0, incomingSalary - outgoingSalary)
  if (gap <= 0) {
    return teamFinancials
  }

  return teamFinancials.map((entry) => {
    if (entry.teamId !== teamId) {
      return entry
    }

    const consumed = consumeTradeExceptions(entry.tradeExceptions, gap)
    return {
      ...entry,
      tradeExceptions: consumed.tradeExceptions,
    }
  })
}

function createOutgoingTradeExceptions({
  teamId,
  outgoingSalary,
  incomingSalary,
  teamFinancials,
  season,
}: {
  teamId: string
  outgoingSalary: number
  incomingSalary: number
  teamFinancials: LeagueRecord["teamFinancials"]
  season: number
}): LeagueRecord["teamFinancials"] {
  const unmatched = Math.max(0, outgoingSalary - incomingSalary)
  if (unmatched <= 0) {
    return teamFinancials
  }

  return teamFinancials.map((entry) => {
    if (entry.teamId !== teamId) {
      return entry
    }

    return {
      ...entry,
      tradeExceptions: [
        ...entry.tradeExceptions,
        createTradeException({
          teamId,
          amount: unmatched,
          season,
          description: "Created from salary-mismatch trade",
        }),
      ],
    }
  })
}

function createTradeHistoryEntry(
  league: LeagueRecord,
  proposal: TradeProposal,
  context: TradeContext,
) {
  const evaluations = evaluateTrade(league, proposal)
  const fromEvaluation = evaluations.find(
    (entry) => entry.teamId === context.fromTeam.id,
  )
  const toEvaluation = evaluations.find(
    (entry) => entry.teamId === context.toTeam.id,
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
  proposal: TradeProposal,
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
    tradePlayer(player, context.toTeam.id, context.fromTeam.id),
  )
  const playersToTo = context.fromPlayers.map((player) =>
    tradePlayer(player, context.fromTeam.id, context.toTeam.id),
  )
  const tradableAfterDay =
    league.seasonState.currentDay + TRADE_MORATORIUM_GAMES

  const fromOutgoingSalary = sumSalary(league, context.fromPlayers)
  const fromIncomingSalary = sumSalary(league, context.toPlayers)
  const toOutgoingSalary = sumSalary(league, context.toPlayers)
  const toIncomingSalary = sumSalary(league, context.fromPlayers)

  let teamFinancials = league.teamFinancials
  teamFinancials = applyTradeExceptionsForTeam({
    teamId: context.fromTeam.id,
    outgoingSalary: fromOutgoingSalary,
    incomingSalary: fromIncomingSalary,
    teamFinancials,
  })
  teamFinancials = applyTradeExceptionsForTeam({
    teamId: context.toTeam.id,
    outgoingSalary: toOutgoingSalary,
    incomingSalary: toIncomingSalary,
    teamFinancials,
  })
  teamFinancials = createOutgoingTradeExceptions({
    teamId: context.fromTeam.id,
    outgoingSalary: fromOutgoingSalary,
    incomingSalary: fromIncomingSalary,
    teamFinancials,
    season: league.seasonState.season,
  })
  teamFinancials = createOutgoingTradeExceptions({
    teamId: context.toTeam.id,
    outgoingSalary: toOutgoingSalary,
    incomingSalary: toIncomingSalary,
    teamFinancials,
    season: league.seasonState.season,
  })

  const tradeHistoryEntry = createTradeHistoryEntry(league, proposal, context)
  const [fromHistory, toHistory] = tradeHistoryEntry.teams
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
      fromOutgoingSalary: fromHistory?.outgoingSalary ?? 0,
      fromIncomingSalary: fromHistory?.incomingSalary ?? 0,
      toOutgoingSalary: toHistory?.outgoingSalary ?? 0,
      toIncomingSalary: toHistory?.incomingSalary ?? 0,
      fromNetValue: fromHistory?.netValue ?? 0,
      toNetValue: toHistory?.netValue ?? 0,
    },
  })

  return {
    ...league,
    teamFinancials,
    contracts: league.contracts.map((contract) => {
      const tradedFrom = tradeContract(
        contract,
        fromIds,
        context.toTeam.id,
        tradableAfterDay,
      )
      return tradeContract(
        tradedFrom,
        toIds,
        context.fromTeam.id,
        tradableAfterDay,
      )
    }),
    draftPickAssets: league.draftPickAssets.map((pick) => {
      const tradedFrom = tradePick(pick, fromPickIds, context.toTeam.id)
      return tradePick(tradedFrom, toPickIds, context.fromTeam.id)
    }),
    tradeHistory: [...league.tradeHistory, tradeHistoryEntry],
    pendingTradeOffers: league.pendingTradeOffers.filter(
      (offer) =>
        offer.status !== "pending" ||
        !proposalMatchesExecutedTrade(offer.proposal, proposal),
    ),
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

function proposalMatchesExecutedTrade(
  pending: TradeProposal,
  executed: TradeProposal,
): boolean {
  return (
    pending.from.teamId === executed.from.teamId &&
    pending.to.teamId === executed.to.teamId &&
    sameAssetIds(pending.from.playerIds, executed.from.playerIds) &&
    sameAssetIds(pending.to.playerIds, executed.to.playerIds) &&
    sameAssetIds(pending.from.pickIds ?? [], executed.from.pickIds ?? []) &&
    sameAssetIds(pending.to.pickIds ?? [], executed.to.pickIds ?? [])
  )
}

function sameAssetIds(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false
  }
  const sortedLeft = [...left].sort()
  const sortedRight = [...right].sort()
  return sortedLeft.every((value, index) => value === sortedRight[index])
}

export function proposeTrade(
  league: LeagueRecord,
  proposal: TradeProposal,
  aiTeamId?: string,
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

function normalizeProposalForAiTeam(
  proposal: TradeProposal,
  aiTeamId: string,
): TradeProposal {
  if (proposal.from.teamId === aiTeamId) {
    return proposal
  }

  return {
    from: proposal.to,
    to: proposal.from,
  }
}

export function makeItWork(
  league: LeagueRecord,
  proposal: TradeProposal,
  aiTeamId: string,
): TradeProposal | null {
  const normalized = normalizeProposalForAiTeam(proposal, aiTeamId)
  if (wouldAiAcceptTrade(league, normalized, aiTeamId).ok) {
    return normalized
  }

  const aiTeam = findTeam(league, aiTeamId)
  if (!aiTeam) {
    return null
  }

  const aiPicks = league.draftPickAssets
    .filter((pick) => pick.currentTeamId === aiTeamId)
    .sort((a, b) => {
      if (a.round !== b.round) {
        return a.round - b.round
      }
      return a.season - b.season
    })

  let working: TradeProposal = {
    from: { ...normalized.from, pickIds: [...(normalized.from.pickIds ?? [])] },
    to: { ...normalized.to, pickIds: [...(normalized.to.pickIds ?? [])] },
  }

  for (const pick of aiPicks) {
    if ((working.from.pickIds ?? []).includes(pick.id)) {
      continue
    }

    working = {
      ...working,
      from: {
        ...working.from,
        pickIds: [...(working.from.pickIds ?? []), pick.id],
      },
    }

    if (wouldAiAcceptTrade(league, working, aiTeamId).ok) {
      return working
    }
  }

  const expendablePlayers = [...aiTeam.players]
    .filter((player) => !(working.from.playerIds ?? []).includes(player.id))
    .sort((a, b) => a.ratings.overall - b.ratings.overall)

  for (const player of expendablePlayers.slice(0, 2)) {
    working = {
      ...working,
      from: {
        ...working.from,
        playerIds: [...working.from.playerIds, player.id],
      },
    }

    if (wouldAiAcceptTrade(league, working, aiTeamId).ok) {
      return working
    }
  }

  return null
}

function buildAiTradeProposal(
  league: LeagueRecord,
  aiTeamId: string,
  userTeamId: string,
  rng: Rng,
): TradeProposal | null {
  const aiTeam = findTeam(league, aiTeamId)
  const userTeam = findTeam(league, userTeamId)
  if (!aiTeam || !userTeam) {
    return null
  }

  const aiMode = getTeamMode(league, aiTeamId)
  const aiPlayers = [...aiTeam.players].sort((a, b) => {
    switch (aiMode) {
      case "selling":
        return b.ratings.potential - a.ratings.potential
      case "contending":
        return b.ratings.overall - a.ratings.overall
      case "buying":
        return b.age - a.age
    }
  })
  const userPlayers = [...userTeam.players].sort(
    (a, b) => b.ratings.overall - a.ratings.overall,
  )

  const offeredPlayer = aiPlayers[rng.int(0, Math.min(4, aiPlayers.length - 1))]
  const requestedPlayer = userPlayers[rng.int(0, Math.min(4, userPlayers.length - 1))]
  if (!offeredPlayer || !requestedPlayer) {
    return null
  }

  const baseProposal: TradeProposal = {
    from: {
      teamId: aiTeamId,
      playerIds: [offeredPlayer.id],
    },
    to: {
      teamId: userTeamId,
      playerIds: [requestedPlayer.id],
    },
  }

  return makeItWork(league, baseProposal, aiTeamId) ?? baseProposal
}

function createPendingOffer(
  league: LeagueRecord,
  proposal: TradeProposal,
  initiatorTeamId: string,
): PendingTradeOffer {
  return {
    id: `trade_offer_${league.seasonState.season}_${league.seasonState.currentDay}_${league.pendingTradeOffers.length + 1}`,
    fromTeamId: proposal.from.teamId,
    toTeamId: proposal.to.teamId,
    proposal,
    createdDay: league.seasonState.currentDay,
    expiresDay:
      league.seasonState.currentDay + AI_TRADE_OFFER_EXPIRY_DAYS,
    status: "pending",
    initiatorTeamId,
  }
}

export function expirePendingTradeOffers(league: LeagueRecord): LeagueRecord {
  const currentDay = league.seasonState.currentDay

  return {
    ...league,
    pendingTradeOffers: league.pendingTradeOffers.map((offer) =>
      offer.status === "pending" && offer.expiresDay <= currentDay
        ? { ...offer, status: "expired" }
        : offer,
    ),
  }
}

export function runAiTradeMarket(
  league: LeagueRecord,
  rng: Rng,
): LeagueRecord {
  if (!canTradeOnDate(league.seasonState) || !league.userTeamId) {
    return league
  }

  const aiTeams = league.seasonState.teams.filter(
    (team) => team.id !== league.userTeamId,
  )
  if (aiTeams.length === 0) {
    return league
  }

  let current = league
  const attempts = Math.min(2, aiTeams.length)

  for (let index = 0; index < attempts; index++) {
    const aiTeam = aiTeams[rng.int(0, aiTeams.length - 1)]!
    const proposal = buildAiTradeProposal(
      current,
      aiTeam.id,
      league.userTeamId,
      rng,
    )
    if (!proposal) {
      continue
    }

    const evaluation = evaluateTrade(current, proposal).find(
      (entry) => entry.teamId === league.userTeamId,
    )
    if (
      !evaluation ||
      evaluation.netValue < -AI_TRADE_MAX_IMBALANCE ||
      !wouldAiAcceptTrade(current, proposal, aiTeam.id).ok
    ) {
      continue
    }

    const duplicate = current.pendingTradeOffers.some(
      (offer) =>
        offer.status === "pending" &&
        offer.fromTeamId === proposal.from.teamId &&
        offer.toTeamId === proposal.to.teamId &&
        sameAssetIds(offer.proposal.from.playerIds, proposal.from.playerIds) &&
        sameAssetIds(offer.proposal.to.playerIds, proposal.to.playerIds),
    )
    if (duplicate) {
      continue
    }

    current = {
      ...current,
      pendingTradeOffers: [
        ...current.pendingTradeOffers,
        createPendingOffer(current, proposal, aiTeam.id),
      ],
    }
  }

  return current
}

export function acceptTradeOffer(
  league: LeagueRecord,
  offerId: string,
): LeagueRecord {
  const offer = league.pendingTradeOffers.find((entry) => entry.id === offerId)
  if (!offer || offer.status !== "pending") {
    throw new Error("Trade offer not found or no longer pending")
  }

  const aiTeamId = offer.initiatorTeamId
  const acceptance = wouldAiAcceptTrade(league, offer.proposal, aiTeamId)
  if (!acceptance.ok) {
    throw new Error(acceptance.reason)
  }

  const executed = executeTrade(league, offer.proposal)

  return {
    ...executed,
    pendingTradeOffers: executed.pendingTradeOffers.map((entry) =>
      entry.id === offerId ? { ...entry, status: "accepted" } : entry,
    ),
  }
}

export function rejectTradeOffer(
  league: LeagueRecord,
  offerId: string,
): LeagueRecord {
  const offer = league.pendingTradeOffers.find((entry) => entry.id === offerId)
  if (!offer || offer.status !== "pending") {
    throw new Error("Trade offer not found or no longer pending")
  }

  return {
    ...league,
    pendingTradeOffers: league.pendingTradeOffers.map((entry) =>
      entry.id === offerId ? { ...entry, status: "rejected" } : entry,
    ),
  }
}
