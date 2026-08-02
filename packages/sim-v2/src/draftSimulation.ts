import type {
  DraftBoardEntry,
  DraftDecisionConfig,
  DraftDecisionFixture,
  DraftDecisionResult,
  DraftDecisionRunInput,
  DraftOutcome,
  DraftPick,
  DraftPublicMockEntry,
  DraftRookieContract,
  DraftScoutTier,
  DraftScoutingConfig,
  DraftScoutingEstimate,
  DraftScoutingReport,
  DraftScoutingTruth,
  DraftTeamBoard,
  DraftTeamMode,
  DraftTeamProfile,
  PlayerEntity,
  PlayerPosition,
  TeamEntity,
} from "@workspace/domain-v2"
import { getPlayerCurrentAbility } from "./playerGeneration"
import { advancePlayerCareerYear } from "./careerDevelopment"
import { createDeterministicRandom } from "./randomness"
import { createEconomySnapshot, getRookieScaleSalary } from "./economy"
import {
  generateInitialPlayerUniverse,
  STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG,
} from "./playerUniverse"
import type { CareerAnnualContext } from "@workspace/domain-v2"

export const DRAFT_DECISION_VERSION = 1

export const STANDARD_DRAFT_DECISION_CONFIG: DraftDecisionConfig = {
  version: DRAFT_DECISION_VERSION,
  eligibleProspects: 75,
  selections: 60,
  rounds: 2,
  teams: 30,
  secondRoundYears: 2,
  secondRoundSalaryMultiplier: 1,
  publicMockWeight: 0.06,
  needWeight: 0.12,
  currentAbilityWeight: 0.52,
  potentialWeight: 0.24,
  boundedVariance: 4,
  followUpYears: 5,
}

export const STANDARD_DRAFT_SCOUTING_CONFIG: DraftScoutingConfig = {
  version: 1,
  publicScoutTier: "average",
  tierAccuracy: { weak: 0.56, average: 0.72, strong: 0.88 },
  tierRangeWidth: { weak: 18, average: 11, strong: 6 },
  categoryDifficulty: {
    currentAbility: 1,
    measurements: 1.12,
    potential: 0.62,
    developmentCurve: 0.48,
    volatility: 0.55,
    injuryResistance: 0.58,
    traits: 0.5,
  },
}

const positions: PlayerPosition[] = ["PG", "SG", "SF", "PF", "C"]

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function truthForPlayer(player: PlayerEntity): DraftScoutingTruth {
  const role = player.profile.role
  return {
    playerId: player.id,
    currentAbility: getPlayerCurrentAbility(player),
    potential: player.profile.development.potential,
    volatility: player.profile.development.volatility,
    peakAge: player.profile.development.peakAge,
    declineStartAge: player.profile.development.declineStartAge,
    injuryResistance: player.profile.injuryResistance,
    measurements: {
      heightInches: player.profile.physical.heightInches,
      weightPounds: player.profile.physical.weightPounds,
      wingspanInches: player.profile.physical.wingspanInches,
      speed: player.profile.physical.speed,
      strength: player.profile.physical.strength,
      vertical: player.profile.physical.vertical,
    },
    positions: [
      role.primaryPosition,
      ...(role.secondaryPosition ? [role.secondaryPosition] : []),
    ],
    traits: [...player.profile.traits],
    growthCurve: player.profile.development.growthCurve,
    declineCurve: player.profile.development.declineCurve,
  }
}

function observeNumber(
  random: ReturnType<typeof createDeterministicRandom>,
  truth: number,
  tier: DraftScoutTier,
  difficulty: number,
  range: number,
  min = 0,
  max = 100
): number | null {
  const visibility = STANDARD_DRAFT_SCOUTING_CONFIG.tierAccuracy[tier] * difficulty
  if (random.next() > visibility) return null
  return Math.round(clamp(truth + random.normal(0, range * (1 - difficulty * 0.25)), min, max))
}

function observeAge(
  random: ReturnType<typeof createDeterministicRandom>,
  truth: number,
  tier: DraftScoutTier,
  difficulty: number
): number | null {
  return observeNumber(random, truth, tier, difficulty, 2, 18, 40)
}

function observeCategory<T extends string>(
  random: ReturnType<typeof createDeterministicRandom>,
  truth: T,
  tier: DraftScoutTier,
  difficulty: number
): T | null {
  return random.next() < STANDARD_DRAFT_SCOUTING_CONFIG.tierAccuracy[tier] * difficulty ? truth : null
}

function createScoutingEstimate(
  truth: DraftScoutingTruth,
  tier: DraftScoutTier,
  seed: string,
  config: DraftScoutingConfig = STANDARD_DRAFT_SCOUTING_CONFIG
): DraftScoutingEstimate {
  const random = createDeterministicRandom(seed)
  const range = config.tierRangeWidth[tier]
  const category = config.categoryDifficulty
  const measurements = Object.fromEntries(
    Object.entries(truth.measurements).map(([key, value]) => [
      key,
      observeNumber(
        random.fork(`measurement:${key}`),
        value as number,
        tier,
        category.measurements,
        range,
        key.includes("Inches") ? 48 : key === "weightPounds" ? 80 : 0,
        key === "weightPounds" ? 500 : key.includes("Inches") ? 110 : 100
      ),
    ])
  ) as DraftScoutingEstimate["measurements"]
  const traitStatuses = truth.traits.map((trait, index) => {
    const traitRandom = random.fork(`trait:${index}`)
    const visibility = config.tierAccuracy[tier] * category.traits
    if (traitRandom.next() > visibility) {
      return { trait, status: "unknown" as const }
    }
    return {
      trait,
      status:
        traitRandom.next() < config.tierAccuracy[tier]
          ? ("confirmed" as const)
          : ("false-positive" as const),
    }
  })
  if (truth.traits.length === 0 && random.next() > category.traits) {
    traitStatuses.push({ trait: "unlisted-trait", status: "false-positive" })
  }
  return {
    currentAbility: observeNumber(random.fork("current"), truth.currentAbility, tier, category.currentAbility, range),
    potential: observeNumber(random.fork("potential"), truth.potential, tier, category.potential, range),
    volatility: observeNumber(random.fork("volatility"), truth.volatility, tier, category.volatility, range),
    peakAge: observeAge(random.fork("peak-age"), truth.peakAge, tier, category.developmentCurve),
    declineStartAge: observeAge(random.fork("decline-age"), truth.declineStartAge, tier, category.developmentCurve),
    growthCurve: observeCategory(random.fork("growth-curve"), truth.growthCurve, tier, category.developmentCurve),
    declineCurve: observeCategory(random.fork("decline-curve"), truth.declineCurve, tier, category.developmentCurve),
    injuryResistance: observeNumber(random.fork("injury"), truth.injuryResistance, tier, category.injuryResistance, range),
    measurements,
    positions: truth.positions.filter((position) => {
      const positionRandom = random.fork(`position:${position}`)
      return positionRandom.next() < config.tierAccuracy[tier] * 1.05
    }),
    traits: traitStatuses,
  }
}

function reportRanges(
  estimate: DraftScoutingEstimate,
  tier: DraftScoutTier,
  config: DraftScoutingConfig
): Record<string, { min: number; max: number }> {
  const width = config.tierRangeWidth[tier]
  const ranges: Record<string, { min: number; max: number }> = {}
  for (const [key, value] of Object.entries({
    currentAbility: estimate.currentAbility,
    potential: estimate.potential,
    volatility: estimate.volatility,
    peakAge: estimate.peakAge,
    declineStartAge: estimate.declineStartAge,
    injuryResistance: estimate.injuryResistance,
    ...estimate.measurements,
  })) {
    if (value !== null) ranges[key] = { min: Math.round(value - width), max: Math.round(value + width) }
  }
  return ranges
}

function createReport(
  playerId: string,
  scoutTier: DraftScoutTier | "public",
  estimate: DraftScoutingEstimate,
  notes: string[],
  config: DraftScoutingConfig
): DraftScoutingReport {
  const tier = scoutTier === "public" ? config.publicScoutTier : scoutTier
  const knownFieldCount = [
    estimate.currentAbility,
    estimate.potential,
    estimate.volatility,
    estimate.peakAge,
    estimate.declineStartAge,
    estimate.growthCurve,
    estimate.declineCurve,
    estimate.injuryResistance,
    ...Object.values(estimate.measurements),
  ].filter((value) => value !== null).length
  return {
    playerId,
    scoutTier,
    confidence: reportConfidence(estimate, tier),
    notes,
    estimate,
    ranges: reportRanges(estimate, tier, config),
    knownFieldCount,
  }
}

function reportConfidence(
  estimate: DraftScoutingEstimate,
  tier: DraftScoutTier
): number {
  const values = [
    estimate.currentAbility,
    estimate.potential,
    estimate.volatility,
    estimate.peakAge,
    estimate.declineStartAge,
    estimate.injuryResistance,
    ...Object.values(estimate.measurements),
  ]
  const visibility = values.filter((value) => value !== null).length / values.length
  return round(visibility * ({ weak: 0.6, average: 0.78, strong: 0.94 }[tier] ?? 0.75))
}

export function createDraftScoutingReports(input: {
  seed: string
  players: Record<string, PlayerEntity>
  prospectIds: string[]
  teamIds: string[]
  scoutTiers?: Record<string, DraftScoutTier>
  config?: DraftScoutingConfig
}): {
  truths: Record<string, DraftScoutingTruth>
  publicReports: Record<string, DraftScoutingReport>
  privateReports: Record<string, Record<string, DraftScoutingReport>>
} {
  const config = input.config ?? STANDARD_DRAFT_SCOUTING_CONFIG
  const truths: Record<string, DraftScoutingTruth> = {}
  const publicReports: Record<string, DraftScoutingReport> = {}
  const privateReports: Record<string, Record<string, DraftScoutingReport>> = {}
  for (const playerId of input.prospectIds) {
    const player = input.players[playerId]
    if (!player) continue
    const truth = truthForPlayer(player)
    truths[playerId] = truth
    const publicEstimate = createScoutingEstimate(
      truth,
      config.publicScoutTier,
      `${input.seed}:public:${playerId}`,
      config
    )
    publicReports[playerId] = createReport(playerId, "public", publicEstimate, ["Shared pre-draft baseline. Fixed for the draft."], config)
  }
  for (const teamId of input.teamIds) {
    const tier = input.scoutTiers?.[teamId] ?? "average"
    privateReports[teamId] = {}
    for (const playerId of input.prospectIds) {
      const truth = truths[playerId]
      if (!truth) continue
      const estimate = createScoutingEstimate(
        truth,
        tier,
        `${input.seed}:scout:${teamId}:${playerId}`,
        config
      )
      privateReports[teamId][playerId] = createReport(playerId, tier, estimate, [
          `${tier} head scout: private estimate fixed before the draft.`,
          estimate.potential === null ? "Potential remains unknown." : "Potential estimate available.",
        ], config)
    }
  }
  return { truths, publicReports, privateReports }
}

function emptyPositionCounts(): Record<PlayerPosition, number> {
  return { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 }
}

export function deriveDraftTeamProfile(input: {
  team: TeamEntity
  roster: PlayerEntity[]
  scoutTier?: DraftScoutTier
  mode?: DraftTeamMode
  needOverrides?: Partial<Record<PlayerPosition, number>>
}): DraftTeamProfile {
  const rosterByPosition = emptyPositionCounts()
  for (const player of input.roster) {
    rosterByPosition[player.profile.role.primaryPosition] += 1
  }
  const rosterCurrentAbility = input.roster.length
    ? input.roster.reduce((sum, player) => sum + getPlayerCurrentAbility(player), 0) / input.roster.length
    : 0
  const mode = input.mode ?? (rosterCurrentAbility >= 72 ? "contender" : rosterCurrentAbility <= 58 ? "rebuilding" : "balanced")
  const needs = positions
    .map((position) => ({
      position,
      priority: input.needOverrides?.[position] ?? clamp(100 - rosterByPosition[position] * 25, 10, 90),
      reason: input.needOverrides?.[position] !== undefined ? "Manual lab override." : `Roster has ${rosterByPosition[position]} ${position} player(s).`,
    }))
    .sort((left, right) => right.priority - left.priority)
  return {
    team: input.team,
    scoutTier: input.scoutTier ?? "average",
    mode,
    needs,
    rosterCurrentAbility: round(rosterCurrentAbility),
    rosterByPosition,
    overrideSource: input.mode || input.needOverrides ? "manual" : "derived",
  }
}

export function createDraftTeamProfiles(input: {
  teams: TeamEntity[]
  rosters: Record<string, string[]>
  players: Record<string, PlayerEntity>
  scoutTiers?: Record<string, DraftScoutTier>
  modes?: Record<string, DraftTeamMode>
  needs?: Record<string, Partial<Record<PlayerPosition, number>>>
}): Record<string, DraftTeamProfile> {
  return Object.fromEntries(
    input.teams.map((team) => [
      team.id,
      deriveDraftTeamProfile({
        team,
        roster: (input.rosters[team.id] ?? []).flatMap((id) => (input.players[id] ? [input.players[id]] : [])),
        scoutTier: input.scoutTiers?.[team.id],
        mode: input.modes?.[team.id],
        needOverrides: input.needs?.[team.id],
      }),
    ])
  )
}

function estimateScore(report: DraftScoutingReport, fallback: number): number {
  return report.estimate.currentAbility ?? fallback
}

export function createPublicMock(input: {
  seed: string
  prospectIds: string[]
  players: Record<string, PlayerEntity>
  reports: Record<string, DraftScoutingReport>
}): DraftPublicMockEntry[] {
  return input.prospectIds
    .map((playerId) => {
      const report = input.reports[playerId]
      const player = input.players[playerId]
      const current = estimateScore(report, getPlayerCurrentAbility(player))
      const potential = report.estimate.potential ?? current
      const signal = round(current * 0.68 + potential * 0.32)
      return {
        playerId,
        signal,
        projectedRange: { min: Math.max(1, Math.round(signal / 3)), max: Math.round(signal / 1.8) },
      }
    })
    .sort((left, right) => right.signal - left.signal)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
}

function needScore(profile: DraftTeamProfile, positionsSeen: PlayerPosition[]): number {
  return Math.max(...positionsSeen.map((position) => profile.needs.find((need) => need.position === position)?.priority ?? 10), 10)
}

export function buildDraftBoard(input: {
  seed: string
  team: DraftTeamProfile
  prospectIds: string[]
  players: Record<string, PlayerEntity>
  reports: Record<string, DraftScoutingReport>
  publicMock: DraftPublicMockEntry[]
  config?: DraftDecisionConfig
  overrides?: DraftDecisionRunInput["userBoardOverrides"]
}): DraftTeamBoard {
  const config = input.config ?? STANDARD_DRAFT_DECISION_CONFIG
  const publicById = Object.fromEntries(input.publicMock.map((entry) => [entry.playerId, entry]))
  const scored = input.prospectIds.map((playerId) => {
    const player = input.players[playerId]
    const report = input.reports[playerId]
    const current = report.estimate.currentAbility ?? getPlayerCurrentAbility(player)
    const potential = report.estimate.potential ?? current
    const positionsSeen = report.estimate.positions.length ? report.estimate.positions : [player.profile.role.primaryPosition]
    const need = needScore(input.team, positionsSeen)
    const mock = publicById[playerId]?.signal ?? current
    const variance = createDeterministicRandom(`${input.seed}:board:${input.team.team.id}:${playerId}`).normal(0, config.boundedVariance)
    const modePotentialWeight = input.team.mode === "rebuilding" ? 1.25 : input.team.mode === "contender" ? 0.8 : 1
    const score = current * config.currentAbilityWeight + potential * config.potentialWeight * modePotentialWeight + need * config.needWeight / 100 + mock * config.publicMockWeight + variance
    return { playerId, score, current, potential, need, mock, variance, positionsSeen }
  }).sort((left, right) => right.score - left.score)
  const entries: DraftBoardEntry[] = scored.map((entry, index) => {
    const override = input.overrides?.[entry.playerId]
    return {
      rank: index + 1,
      playerId: entry.playerId,
      score: {
        total: round(entry.score),
        currentAbility: round(entry.current),
        potential: round(entry.potential),
        need: round(entry.need),
        publicMock: round(entry.mock),
        variance: round(entry.variance),
      },
      rationale: `${input.team.mode} board: ${Math.round(entry.current)} current / ${Math.round(entry.potential)} upside, ${Math.round(entry.need)} need signal, ${Math.round(entry.mock)} public signal.`,
      topAlternatives: scored.slice(index + 1, index + 4).map((candidate) => candidate.playerId),
      source: override ? "user" : "generated",
      pinned: override?.pinned ?? false,
      doNotDraft: override?.doNotDraft ?? false,
      note: override?.note ?? null,
    }
  })
  return { teamId: input.team.team.id, generatedAt: "pre-draft", entries }
}

export function createDraftOrder(teams: TeamEntity[], override?: string[]): string[] {
  const ids = override?.length ? [...override] : teams.map((team) => team.id)
  const valid = new Set(teams.map((team) => team.id))
  if (ids.length !== teams.length || ids.some((id) => !valid.has(id)) || new Set(ids).size !== ids.length) {
    throw new Error("Draft order must contain each team exactly once.")
  }
  return ids
}

export function createDraftDecisionFixture(input: DraftDecisionRunInput): DraftDecisionFixture {
  const config = { ...STANDARD_DRAFT_DECISION_CONFIG, ...input.config }
  const teamIds = Array.from({ length: config.teams }, (_, index) => `team:${String(index + 1).padStart(2, "0")}`)
  const teams = teamIds.map((id, index) => ({ id, name: `Team ${String(index + 1).padStart(2, "0")}` }))
  const universe = generateInitialPlayerUniverse({
    seed: input.seed,
    leagueId: "draft-decision-lab",
    teamIds,
    config: {
      ...STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG,
      draftProspectCount: config.eligibleProspects,
      plannedDraftSelections: config.selections,
      rosterAssembly: {
        ...STANDARD_INITIAL_PLAYER_UNIVERSE_CONFIG.rosterAssembly,
        // The draft lab uses 30 synthetic teams. One core player per position
        // keeps fixture generation stable without changing league defaults.
        coreDepthPerPosition: 1,
      },
    },
  })
  const profiles = createDraftTeamProfiles({
    teams,
    rosters: universe.rosters,
    players: universe.players,
    scoutTiers: input.scoutTiers,
    modes: input.teamModes,
    needs: input.teamNeeds,
  })
  const reports = createDraftScoutingReports({
    seed: input.seed,
    players: universe.players,
    prospectIds: universe.draftProspectIds,
    teamIds,
    scoutTiers: Object.fromEntries(Object.entries(profiles).map(([id, profile]) => [id, profile.scoutTier])),
  })
  const publicMock = createPublicMock({ seed: input.seed, prospectIds: universe.draftProspectIds, players: universe.players, reports: reports.publicReports })
  const boards = Object.fromEntries(teams.map((team) => [team.id, buildDraftBoard({
    seed: input.seed,
    team: profiles[team.id],
    prospectIds: universe.draftProspectIds,
    players: universe.players,
    reports: reports.privateReports[team.id],
    publicMock,
    config,
    overrides: input.userTeamId === team.id ? input.userBoardOverrides : undefined,
  })]))
  return {
    version: 1,
    seed: input.seed,
    season: input.season ?? 1,
    config,
    teams,
    rosters: universe.rosters,
    players: universe.players,
    draftProspectIds: universe.draftProspectIds,
    draftOrder: createDraftOrder(teams, input.draftOrder),
    teamProfiles: profiles,
    publicReports: reports.publicReports,
    privateReports: reports.privateReports,
    publicMock,
    boards,
    economy: createEconomySnapshot(input.season ?? 1),
  }
}

function chooseAiPlayer(board: DraftTeamBoard, available: Set<string>): DraftBoardEntry | null {
  return board.entries.find((entry) => available.has(entry.playerId) && !entry.doNotDraft) ?? null
}

function createRookieContract(fixture: DraftDecisionFixture, pick: DraftPick): DraftRookieContract {
  const salary = pick.round === 1
    ? getRookieScaleSalary(fixture.economy, pick.overall)
    : Math.round((fixture.economy.minimumSalary * fixture.config.secondRoundSalaryMultiplier) / 10_000) * 10_000
  const years = pick.round === 1 ? 4 : fixture.config.secondRoundYears
  return {
    id: `${fixture.seed}:rookie-contract:${pick.overall}`,
    playerId: pick.playerId,
    teamId: pick.teamId,
    startSeason: fixture.season,
    endSeason: fixture.season + years - 1,
    years,
    annualSalary: Array.from({ length: years }, () => salary),
    fullyGuaranteed: true,
    rights: { level: "none", teamId: pick.teamId, seasonsWithTeam: 0, lastContractId: null },
    source: pick.round === 1 ? "rookie-scale" : "second-round-minimum",
    draftSlot: pick.overall,
  }
}

function simulateOutcome(fixture: DraftDecisionFixture, player: PlayerEntity, pick: DraftPick): DraftOutcome {
  const random = createDeterministicRandom(`${fixture.seed}:outcome:${player.id}`)
  let current = structuredClone(player)
  const initialAbility = getPlayerCurrentAbility(current)
  let realizedPeak = initialAbility
  const snapshots: number[] = []
  for (let year = 0; year < fixture.config.followUpYears; year += 1) {
    const context: CareerAnnualContext = {
      season: fixture.season + year,
      minutes: 1_600,
      gamesPlayed: 70,
      gamesScheduled: 82,
      injuryDevelopmentPenalty: Math.max(0, (50 - current.profile.injuryResistance) / 100),
      coachingDevelopmentEmphasis: 0.5,
    }
    current = advancePlayerCareerYear({ player: current, context, random: random.fork(`year:${year}`) }).player
    const ability = getPlayerCurrentAbility(current)
    snapshots.push(ability)
    realizedPeak = Math.max(realizedPeak, ability)
  }
  const privateReport = fixture.privateReports[pick.teamId]?.[player.id]
  const potentialForecast = privateReport?.estimate.potential ?? initialAbility
  return {
    playerId: player.id,
    draftSlot: pick.overall,
    draftRound: pick.round,
    preDraftAbility: round(initialAbility),
    realizedPeakAbility: round(realizedPeak),
    abilityAfterFollowUp: round(snapshots.at(-1) ?? initialAbility),
    potentialForecast: round(potentialForecast),
    forecastError: round(potentialForecast - realizedPeak),
    scoutEstimate: privateReport?.estimate.currentAbility ?? null,
    scoutError: privateReport?.estimate.currentAbility === null || privateReport?.estimate.currentAbility === undefined ? null : round(privateReport.estimate.currentAbility - initialAbility),
    seasonsSimulated: fixture.config.followUpYears,
  }
}

export function runDraftDecisionLab(input: DraftDecisionRunInput): DraftDecisionResult {
  const fixture = createDraftDecisionFixture(input)
  const available = new Set(fixture.draftProspectIds)
  const picks: DraftPick[] = []
  const contracts: DraftRookieContract[] = []
  const userPicks = input.userPicks ?? {}
  for (let overall = 1; overall <= fixture.config.selections; overall += 1) {
    const round = overall <= fixture.config.teams ? 1 : 2
    const pickInRound = round === 1 ? overall : overall - fixture.config.teams
    const order = fixture.draftOrder[round === 1 ? pickInRound - 1 : fixture.draftOrder.length - pickInRound]
    const board = fixture.boards[order]
    const requested = input.userTeamId === order ? userPicks[overall] : undefined
    const requestedEntry = requested ? board.entries.find((entry) => entry.playerId === requested && available.has(requested)) : undefined
    const selected = requestedEntry ?? chooseAiPlayer(board, available)
    if (!selected) continue
    available.delete(selected.playerId)
    const pick: DraftPick = {
      overall,
      round,
      pickInRound,
      teamId: order,
      playerId: selected.playerId,
      kind: requestedEntry ? "user" : "ai",
      boardRank: selected.rank,
    }
    picks.push(pick)
    contracts.push(createRookieContract(fixture, pick))
  }
  const outcomes = picks.flatMap((pick) => {
    const player = fixture.players[pick.playerId]
    return player ? [simulateOutcome(fixture, player, pick)] : []
  })
  const teamImpact = Object.fromEntries(fixture.teams.map((team) => {
    const rosterIds = fixture.rosters[team.id] ?? []
    const draftedPicks = picks.filter((pick) => pick.teamId === team.id)
    const beforePlayers = rosterIds.flatMap((id) => fixture.players[id] ? [fixture.players[id]] : [])
    const afterPlayers = [
      ...beforePlayers,
      ...draftedPicks.flatMap((pick) => fixture.players[pick.playerId] ? [fixture.players[pick.playerId]] : []),
    ]
    const average = (players: PlayerEntity[]) => players.length
      ? players.reduce((sum, player) => sum + getPlayerCurrentAbility(player), 0) / players.length
      : 0
    const before = round(average(beforePlayers))
    const after = round(average(afterPlayers))
    return [team.id, { before, after, change: round(after - before), draftedPlayerIds: draftedPicks.map((pick) => pick.playerId) }]
  }))
  const duplicates = picks.map((pick) => pick.playerId).filter((id, index, all) => all.indexOf(id) !== index)
  const errorBuckets: Record<DraftScoutTier, number[]> = { weak: [], average: [], strong: [] }
  for (const outcome of outcomes) {
    const tier = fixture.teamProfiles[picks.find((pick) => pick.playerId === outcome.playerId)?.teamId ?? ""]?.scoutTier
    if (tier && outcome.scoutError !== null) errorBuckets[tier].push(Math.abs(outcome.scoutError))
  }
  return {
    schema: "foh-draft-decision-lab",
    version: 1,
    fixture,
    picks,
    contracts,
    undraftedPlayerIds: [...available],
    outcomes,
    teamImpact,
    diagnostics: {
      legal: duplicates.length === 0 && picks.length === fixture.config.selections,
      duplicatePlayers: duplicates,
      unfilledSelections: fixture.config.selections - picks.length,
      averageScoutAbsoluteError: Object.fromEntries(Object.entries(errorBuckets).map(([tier, values]) => [tier, values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0])) as Record<DraftScoutTier, number>,
      averageBoardRankOfPick: Object.fromEntries(fixture.teams.map((team) => {
        const teamPicks = picks.filter((pick) => pick.teamId === team.id && pick.boardRank !== null)
        return [team.id, teamPicks.length ? round(teamPicks.reduce((sum, pick) => sum + (pick.boardRank ?? 0), 0) / teamPicks.length) : 0]
      })),
    },
  }
}
