import type {
  JsonRecord,
  LeagueCommand,
  LeagueDocument,
  LeagueEvent,
  PlayerEntity,
  ValidationIssue,
} from "@workspace/domain-v2"
import { validateLeagueDocument } from "@workspace/league-schema"

import { projectTeamFinance } from "./finance"
import { createDefaultRotation } from "./seasonFixture"

type ReleasePlayerCommand = Extract<LeagueCommand, { type: "ReleasePlayer" }>

export class ReleasePlayerCommandError extends Error {
  readonly reason: ValidationIssue

  constructor(reason: ValidationIssue) {
    super(reason.message)
    this.name = "ReleasePlayerCommandError"
    this.reason = reason
  }
}

export type ReleasePlayerResult = {
  league: LeagueDocument
  event: LeagueEvent
}

function fail(
  code: string,
  message: string,
  path?: Array<string | number>
): never {
  throw new ReleasePlayerCommandError({ code, message, path })
}

function fullName(player: PlayerEntity): string {
  return [player.identity.firstName, player.identity.lastName]
    .filter(Boolean)
    .join(" ")
}

function isCurrentContract(contract: JsonRecord): boolean {
  return contract.status !== "released"
}

function getCurrentContract(
  league: LeagueDocument,
  teamId: string,
  playerId: string
): [string, JsonRecord] | undefined {
  return Object.entries(league.entities.contracts).find(
    ([, contract]) =>
      contract.playerId === playerId &&
      contract.teamId === teamId &&
      isCurrentContract(contract)
  )
}

function getRemainingContractValue(
  contract: JsonRecord,
  currentSeason: number
): number {
  const startSeason = contract.startSeason
  const annualSalary = contract.annualSalary
  if (typeof startSeason === "number" && Array.isArray(annualSalary)) {
    return annualSalary.reduce((total, salary, index) => {
      if (
        typeof salary !== "number" ||
        !Number.isFinite(salary) ||
        startSeason + index < currentSeason
      ) {
        return total
      }
      return total + Math.max(0, salary)
    }, 0)
  }

  const salary = contract.salary
  const yearsRemaining = contract.yearsRemaining
  if (
    typeof salary !== "number" ||
    !Number.isFinite(salary) ||
    typeof yearsRemaining !== "number" ||
    !Number.isFinite(yearsRemaining)
  ) {
    return 0
  }

  return Math.max(0, salary) * Math.max(0, Math.floor(yearsRemaining))
}

function updatePayrollProjection(
  league: LeagueDocument,
  teamId: string,
  payroll: number,
  deadMoney: number
) {
  const row = league.projections.payroll.find(
    (candidate) => candidate.teamId === teamId
  )

  if (row) {
    row.payroll = payroll
    row.deadMoney = deadMoney
    return
  }

  league.projections.payroll.push({ teamId, payroll, deadMoney })
}

export function releasePlayer(
  league: LeagueDocument,
  command: ReleasePlayerCommand
): ReleasePlayerResult {
  const team = league.entities.teams[command.teamId]
  if (!team) {
    fail(
      "unknown_release_team",
      "The team releasing the player does not exist.",
      ["command", "teamId"]
    )
  }

  const player = league.entities.players[command.playerId]
  if (!player) {
    fail(
      "unknown_release_player",
      "The player being released does not exist.",
      ["command", "playerId"]
    )
  }

  if (!(team.rosterPlayerIds ?? []).includes(command.playerId)) {
    fail(
      "player_not_on_roster",
      "The player must be on the team roster before being released.",
      ["command", "playerId"]
    )
  }

  if (
    player.leagueStatus.kind !== "rostered" ||
    player.leagueStatus.teamId !== command.teamId
  ) {
    fail(
      "player_not_rostered_by_team",
      "The player is not currently rostered by this team.",
      ["entities", "players", command.playerId, "leagueStatus"]
    )
  }

  const nextLeague = structuredClone(league)
  const nextTeam = nextLeague.entities.teams[command.teamId]!
  const nextPlayer = nextLeague.entities.players[command.playerId]!
  const contractEntry = getCurrentContract(
    nextLeague,
    command.teamId,
    command.playerId
  )
  const remainingSalary = contractEntry
    ? getRemainingContractValue(contractEntry[1], nextLeague.state.season)
    : 0

  nextTeam.rosterPlayerIds = (nextTeam.rosterPlayerIds ?? []).filter(
    (playerId) => playerId !== command.playerId
  )
  const rotation = nextLeague.state.rotations?.[command.teamId]
  if (rotation) {
    rotation.starters = rotation.starters.filter(
      (playerId) => playerId !== command.playerId
    )
    rotation.depthOrder = rotation.depthOrder.filter(
      (playerId) => playerId !== command.playerId
    )
    delete rotation.targetMinutes[command.playerId]
  }
  const gamePlan = nextLeague.state.gamePlans?.[command.teamId]
  if (gamePlan) {
    gamePlan.rotation.starters = gamePlan.rotation.starters.filter(
      (playerId) => playerId !== command.playerId
    )
    gamePlan.rotation.depthOrder = gamePlan.rotation.depthOrder.filter(
      (playerId) => playerId !== command.playerId
    )
    delete gamePlan.rotation.targetMinutes[command.playerId]
    if (gamePlan.rotation.starters.length < 5) {
      gamePlan.rotation = createDefaultRotation(
        nextTeam.rosterPlayerIds
          .map((playerId) => nextLeague.entities.players[playerId])
          .filter((player): player is NonNullable<typeof player> =>
            Boolean(player)
          )
      )
    }
  }
  delete nextLeague.state.availability?.[command.playerId]
  nextPlayer.leagueStatus = { kind: "free-agent" }

  if (contractEntry) {
    const [contractId, contract] = contractEntry
    nextLeague.entities.contracts[contractId] = {
      ...contract,
      status: "released",
      releasedAtSeason: nextLeague.state.season,
      releasedFromTeamId: command.teamId,
    }
  }

  const finance = projectTeamFinance(nextLeague, command.teamId, 1)
  const currentSeason = finance.seasons[0]
  updatePayrollProjection(
    nextLeague,
    command.teamId,
    currentSeason?.payroll ?? 0,
    currentSeason?.deadMoney ?? 0
  )

  const event: LeagueEvent = {
    id: `event:${command.commandId}`,
    type: "command.completed",
    season: nextLeague.state.season,
    phase: nextLeague.state.phase,
    leagueDay: nextLeague.state.leagueDay,
    entityRefs: [
      { type: "team", id: command.teamId },
      { type: "player", id: command.playerId },
    ],
    payload: {
      action: "release-player",
      teamId: command.teamId,
      playerId: command.playerId,
      remainingSalary,
    },
    summary: `Released ${fullName(nextPlayer)} from ${team.name}.`,
    importance: "notable",
    storyTags: ["transaction", "release"],
    source: { kind: "command", id: command.commandId },
  }

  nextLeague.metadata.updatedAt = new Date().toISOString()
  nextLeague.history.events.push(event)

  const validation = validateLeagueDocument(nextLeague)
  if (!validation.valid) {
    fail(
      "invalid_release_snapshot",
      validation.issues[0]?.message ??
        "The release command produced an invalid league snapshot.",
      validation.issues[0]?.path
    )
  }

  return { league: validation.data, event }
}
