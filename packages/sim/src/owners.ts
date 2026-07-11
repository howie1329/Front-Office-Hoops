import type {
  LeagueRecord,
  Owner,
  OwnerArchetype,
  OwnerGoal,
  Rng,
  TeamWithRoster,
} from "@workspace/shared/types"

import { getSeasonMilestones } from "./calendar"
import { sortStandings } from "./deriveStandings"
import { getTeamFinancialPosition } from "./financials/teamFinancialPosition"
import { getSeasonFinancials } from "./financials/capMath"
import { createLeagueLogEntry } from "./leagueLog"

const ARCHETYPES: OwnerArchetype[] = [
  "frugal",
  "patient",
  "win_now",
  "meddling",
  "hands_off",
  "analytics",
]

const FIRST_NAMES = ["Victoria", "Marcus", "Elaine", "Andre", "Nadia", "Theo"]
const LAST_NAMES = ["Chen", "Mercer", "Bishop", "Stone", "Patel", "Hayes"]

function ownerDefaults(archetype: OwnerArchetype) {
  switch (archetype) {
    case "frugal":
      return {
        trust: 60,
        patience: "low" as const,
        riskTolerance: "low" as const,
      }
    case "patient":
      return {
        trust: 80,
        patience: "high" as const,
        riskTolerance: "medium" as const,
      }
    case "win_now":
      return {
        trust: 70,
        patience: "medium" as const,
        riskTolerance: "high" as const,
      }
    case "meddling":
      return {
        trust: 65,
        patience: "low" as const,
        riskTolerance: "medium" as const,
      }
    case "hands_off":
      return {
        trust: 85,
        patience: "high" as const,
        riskTolerance: "medium" as const,
      }
    case "analytics":
      return {
        trust: 75,
        patience: "medium" as const,
        riskTolerance: "low" as const,
      }
  }
}

export function initializeOwners(teams: TeamWithRoster[], rng: Rng): Owner[] {
  return teams.map((team, index) => {
    const archetype = ARCHETYPES[rng.int(0, ARCHETYPES.length - 1)]!
    return {
      id: `owner_${team.id}`,
      teamId: team.id,
      displayName: `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[rng.int(0, LAST_NAMES.length - 1)]}`,
      archetype,
      ...ownerDefaults(archetype),
    }
  })
}

function createGoal({
  teamId,
  season,
  type,
  priority,
  assignedDay,
  deadlineDay,
  params = {},
}: Omit<
  OwnerGoal,
  "id" | "status" | "trustReward" | "trustPenalty" | "params"
> & {
  params?: OwnerGoal["params"]
}): OwnerGoal {
  return {
    id: `goal_${season}_${teamId}_${type}_${priority}`,
    teamId,
    season,
    type,
    params,
    priority,
    trustReward: priority === "primary" ? 12 : 6,
    trustPenalty: priority === "primary" ? 12 : 6,
    status: "active",
    assignedDay,
    deadlineDay,
  }
}

export function generateOwnerGoals(league: LeagueRecord): OwnerGoal[] {
  const milestones = getSeasonMilestones(
    Math.max(
      ...league.seasonState.schedule
        .filter((game) => !game.seriesId)
        .map((game) => game.day)
    )
  )
  const seasonFinancials = getSeasonFinancials(
    league.leagueFinancials,
    league.seasonState.season
  )
  const standings = sortStandings(league.seasonState.standings)

  return league.seasonState.teams.flatMap((team) => {
    const owner = league.owners.find((entry) => entry.teamId === team.id)
    const payroll = getTeamFinancialPosition(
      league,
      team.id,
      league.seasonState.season,
    ).taxPayroll
    const rank = standings.findIndex((entry) => entry.teamId === team.id) + 1
    const goals: OwnerGoal[] = []

    if (owner?.archetype === "win_now" || rank <= 10) {
      goals.push(
        createGoal({
          teamId: team.id,
          season: league.seasonState.season,
          type: "make_playoffs",
          priority: "primary",
          assignedDay: league.seasonState.currentDay,
          deadlineDay: milestones.offseasonStartDay,
        })
      )
    } else {
      goals.push(
        createGoal({
          teamId: team.id,
          season: league.seasonState.season,
          type: "develop_youth",
          priority: "primary",
          assignedDay: league.seasonState.currentDay,
          deadlineDay: milestones.offseasonStartDay,
          params: { minAge: 23 },
        })
      )
    }

    goals.push(
      createGoal({
        teamId: team.id,
        season: league.seasonState.season,
        type:
          payroll > seasonFinancials.luxuryTaxLine
            ? "avoid_luxury_tax"
            : "win_total",
        priority: "secondary",
        assignedDay: league.seasonState.currentDay,
        deadlineDay: milestones.offseasonStartDay,
        params:
          payroll > seasonFinancials.luxuryTaxLine
            ? {}
            : { wins: Math.max(25, Math.min(55, team.overall - 30)) },
      })
    )

    return goals
  })
}

function didMeetGoal(league: LeagueRecord, goal: OwnerGoal): boolean {
  const standing = league.seasonState.standings.find(
    (entry) => entry.teamId === goal.teamId
  )
  const team = league.seasonState.teams.find(
    (entry) => entry.id === goal.teamId
  )
  const seasonFinancials = getSeasonFinancials(
    league.leagueFinancials,
    league.seasonState.season
  )
  switch (goal.type) {
    case "make_playoffs":
      return Boolean(
        league.seasonState.playoffBracket?.series.some(
          (series) =>
            series.higherSeedTeamId === goal.teamId ||
            series.lowerSeedTeamId === goal.teamId
        )
      )
    case "win_championship":
      return league.seasonState.playoffBracket?.championTeamId === goal.teamId
    case "win_total":
      return (standing?.wins ?? 0) >= Number(goal.params.wins ?? 0)
    case "avoid_luxury_tax":
      return (
        getTeamFinancialPosition(
          league,
          goal.teamId,
          league.seasonState.season,
        ).taxPayroll <=
        seasonFinancials.luxuryTaxLine
      )
    case "reduce_payroll":
      return (
        getTeamFinancialPosition(
          league,
          goal.teamId,
          league.seasonState.season,
        ).taxPayroll <=
        Number(goal.params.payroll ?? seasonFinancials.salaryCap)
      )
    case "acquire_picks":
      return (
        league.draftPickAssets.filter(
          (pick) => pick.currentTeamId === goal.teamId
        ).length >= Number(goal.params.pickCount ?? 8)
      )
    case "develop_youth":
      return (
        (team?.players.filter(
          (player) => player.age <= Number(goal.params.minAge ?? 23)
        ).length ?? 0) >= 3
      )
    case "re_sign_player":
      return (
        team?.players.some((player) => player.id === goal.params.playerId) ??
        false
      )
  }
}

export function evaluateOwnerGoals(league: LeagueRecord): LeagueRecord {
  const updatedGoals = league.ownerGoals.map((goal) => {
    if (goal.season !== league.seasonState.season || goal.status !== "active") {
      return goal
    }
    return {
      ...goal,
      status: didMeetGoal(league, goal)
        ? ("completed" as const)
        : ("failed" as const),
    }
  })
  let owners = league.owners
  let nextLeague = { ...league, ownerGoals: updatedGoals }
  const entries = updatedGoals
    .filter(
      (goal) =>
        goal.season === league.seasonState.season && goal.status !== "active"
    )
    .map((goal, index) => {
      const delta =
        goal.status === "completed" ? goal.trustReward : -goal.trustPenalty
      owners = owners.map((owner) =>
        owner.teamId === goal.teamId
          ? { ...owner, trust: Math.max(0, Math.min(100, owner.trust + delta)) }
          : owner
      )
      return createLeagueLogEntry({
        league: nextLeague,
        type: "owner_goal",
        teamId: goal.teamId,
        payload: {
          goalId: goal.id,
          goalType: goal.type,
          status: goal.status,
          trustDelta: delta,
        },
        sequence: index + 1,
      })
    })

  nextLeague = {
    ...nextLeague,
    owners,
    leagueLog: [...nextLeague.leagueLog, ...entries],
  }
  return nextLeague
}
