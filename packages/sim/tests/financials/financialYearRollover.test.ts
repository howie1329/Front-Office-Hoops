import { describe, expect, it } from "vitest"
import type { LeagueRecord } from "@workspace/shared/types"

import {
  advanceLeague,
  applyLeagueCommand,
  beginPlayoffs,
  createLeague,
  createRng,
  getCurrentCalendar,
  simulatePlayoffs,
  simulateSeason,
  startNextSeason,
} from "../../src"

describe("financial year rollover", () => {
  it("opens the next cap year and advances active salary schedules once", () => {
    const league = createLeague({
      skipPreseason: true,
      name: "Financial year",
      baseSeed: "financial-year",
      rng: createRng("financial-year"),
      useMiniLeague: true,
    })
    const contract = league.contracts.find(
      (entry) => entry.status === "active" && entry.yearlySalaries.length > 1
    )!
    const originalSalaries = [...contract.yearlySalaries]
    const completed = {
      ...league,
      seasonState: simulatePlayoffs(
        beginPlayoffs(simulateSeason(league.seasonState))
      ),
    }

    const opened = applyLeagueCommand(completed, { type: "beginOffseason" })
    const advancedContract = opened.contracts.find(
      (entry) => entry.id === contract.id
    )!

    expect(opened.leagueFinancials.currentCapSeason).toBe(2)
    expect(opened.seasonState.offseasonPhase).toBe("contract_options")
    expect(advancedContract.yearlySalaries).toEqual(originalSalaries.slice(1))
  })

  it("leaves the user team's upcoming team options pending", () => {
    const league = createLeague({
      skipPreseason: true,
      name: "Team option",
      baseSeed: "team-option",
      rng: createRng("team-option"),
      useMiniLeague: true,
    })
    const team = league.seasonState.teams[0]!
    const contract = league.contracts.find(
      (entry) => entry.teamId === team.id && entry.yearlySalaries.length > 1
    )!
    const completed = {
      ...league,
      userTeamId: team.id,
      contracts: league.contracts.map((entry) =>
        entry.id === contract.id
          ? { ...entry, options: [{ yearIndex: 1, type: "team" as const }] }
          : entry
      ),
      seasonState: simulatePlayoffs(
        beginPlayoffs(simulateSeason(league.seasonState))
      ),
    }

    const opened = applyLeagueCommand(completed, { type: "beginOffseason" })
    const pending = opened.contracts.find((entry) => entry.id === contract.id)!

    expect(pending.status).toBe("active")
    expect(pending.options).toEqual([{ yearIndex: 0, type: "team" }])
  })

  it("lets the user exercise a pending team option before continuing", () => {
    const league = createLeague({
      skipPreseason: true,
      name: "Exercise option",
      baseSeed: "exercise-option",
      rng: createRng("exercise-option"),
      useMiniLeague: true,
    })
    const team = league.seasonState.teams[0]!
    const contract = league.contracts.find(
      (entry) => entry.teamId === team.id && entry.yearlySalaries.length > 1
    )!
    let current: LeagueRecord = {
      ...league,
      userTeamId: team.id,
      contracts: league.contracts.map((entry) =>
        entry.id === contract.id
          ? { ...entry, options: [{ yearIndex: 1, type: "team" as const }] }
          : entry
      ),
      seasonState: simulatePlayoffs(
        beginPlayoffs(simulateSeason(league.seasonState))
      ),
    }
    current = applyLeagueCommand(current, { type: "beginOffseason" })

    expect(() =>
      applyLeagueCommand(current, { type: "completeContractOptions" })
    ).toThrow("Decide all team options")

    current = applyLeagueCommand(current, {
      type: "decideTeamOption",
      contractId: contract.id,
      decision: "exercise",
    })
    const exercised = current.contracts.find(
      (entry) => entry.id === contract.id
    )!

    expect(exercised.options).toEqual([])
    expect(exercised.guaranteedSalaries[0]).toBe(exercised.yearlySalaries[0])

    current = applyLeagueCommand(current, { type: "completeContractOptions" })
    expect(current.seasonState.offseasonPhase).toBe("staff")
  })

  it("declines a user team option into free agency with a current-year cap hold", () => {
    const league = createLeague({
      skipPreseason: true,
      name: "Decline option",
      baseSeed: "decline-option",
      rng: createRng("decline-option"),
      useMiniLeague: true,
    })
    const team = league.seasonState.teams[0]!
    const contract = league.contracts.find(
      (entry) => entry.teamId === team.id && entry.yearlySalaries.length > 1
    )!
    const priorSalary = contract.yearlySalaries[0]!
    let current: LeagueRecord = {
      ...league,
      userTeamId: team.id,
      contracts: league.contracts.map((entry) =>
        entry.id === contract.id
          ? { ...entry, options: [{ yearIndex: 1, type: "team" as const }] }
          : entry
      ),
      seasonState: simulatePlayoffs(
        beginPlayoffs(simulateSeason(league.seasonState))
      ),
    }
    current = applyLeagueCommand(current, { type: "beginOffseason" })
    current = applyLeagueCommand(current, {
      type: "decideTeamOption",
      contractId: contract.id,
      decision: "decline",
    })

    expect(
      current.freeAgentPool.some((player) => player.id === contract.playerId)
    ).toBe(true)
    const hold = current.teamFinancials
      .find((entry) => entry.teamId === team.id)!
      .capHolds.find((entry) => entry.playerId === contract.playerId)
    expect(hold?.season).toBe(current.leagueFinancials.currentCapSeason)
    expect(hold?.amount).toBeGreaterThanOrEqual(priorSalary)
  })

  it("assigns the opening taxpayer exception from target-year payroll", () => {
    const league = createLeague({
      skipPreseason: true,
      name: "Taxpayer exception",
      baseSeed: "taxpayer-exception",
      rng: createRng("taxpayer-exception"),
      useMiniLeague: true,
    })
    const teamId = league.seasonState.teams[0]!.id
    const completed: LeagueRecord = {
      ...league,
      contracts: league.contracts.map((contract) =>
        contract.teamId === teamId
          ? {
              ...contract,
              yearlySalaries: [contract.yearlySalaries[0] ?? 1, 30],
              guaranteedSalaries: [contract.guaranteedSalaries[0] ?? 1, 30],
              options: [],
            }
          : contract
      ),
      seasonState: simulatePlayoffs(
        beginPlayoffs(simulateSeason(league.seasonState))
      ),
    }

    const opened = applyLeagueCommand(completed, { type: "beginOffseason" })
    const teamFinance = opened.teamFinancials.find(
      (entry) => entry.teamId === teamId
    )!
    const seasonFinancials = opened.leagueFinancials.bySeason[2]!

    expect(teamFinance.mleType).toBe("taxpayer")
    expect(teamFinance.mleRemaining).toBe(seasonFinancials.mleTaxpayer)
  })

  it("resolves player options and AI team options automatically", () => {
    const league = createLeague({
      skipPreseason: true,
      name: "Automatic options",
      baseSeed: "automatic-options",
      rng: createRng("automatic-options"),
      useMiniLeague: true,
    })
    const userTeam = league.seasonState.teams[0]!
    const aiTeam = league.seasonState.teams[1]!
    const playerOption = league.contracts.find(
      (entry) => entry.teamId === userTeam.id && entry.yearlySalaries.length > 1
    )!
    const aiTeamOption = league.contracts.find(
      (entry) => entry.teamId === aiTeam.id && entry.yearlySalaries.length > 1
    )!
    const completed: LeagueRecord = {
      ...league,
      userTeamId: userTeam.id,
      contracts: league.contracts.map((entry) => {
        if (entry.id === playerOption.id) {
          return {
            ...entry,
            options: [{ yearIndex: 1, type: "player" as const }],
          }
        }
        if (entry.id === aiTeamOption.id) {
          return {
            ...entry,
            options: [{ yearIndex: 1, type: "team" as const }],
          }
        }
        return entry
      }),
      seasonState: simulatePlayoffs(
        beginPlayoffs(simulateSeason(league.seasonState))
      ),
    }

    const opened = applyLeagueCommand(completed, { type: "beginOffseason" })

    for (const contractId of [playerOption.id, aiTeamOption.id]) {
      const contract = opened.contracts.find(
        (entry) => entry.id === contractId
      )!
      expect(contract.options?.some((option) => option.yearIndex === 0)).toBe(
        false
      )
    }
  })

  it("uses the same rollover for manual and calendar offseason opening", () => {
    const league = createLeague({
      skipPreseason: true,
      name: "Opening parity",
      baseSeed: "opening-parity",
      rng: createRng("opening-parity"),
      useMiniLeague: true,
    })
    const completed: LeagueRecord = {
      ...league,
      seasonState: simulatePlayoffs(
        beginPlayoffs(simulateSeason(league.seasonState))
      ),
    }
    const manual = applyLeagueCommand(
      completed,
      { type: "beginOffseason" },
      createRng("same-opening")
    )
    const automatic = advanceLeague(
      completed,
      {
        target: "day",
        policy: "runThrough",
        league: completed,
        userTeamId: completed.userTeamId,
      },
      createRng("same-opening")
    ).league

    expect(automatic.seasonState.offseasonPhase).toBe("contract_options")
    expect(automatic.leagueFinancials).toEqual(manual.leagueFinancials)
    expect(automatic.contracts).toEqual(manual.contracts)
    expect(automatic.teamFinancials).toEqual(manual.teamFinancials)
  })

  it("initializes the staff market identically for manual and calendar transitions", () => {
    const league = createLeague({
      skipPreseason: true,
      name: "Staff transition parity",
      baseSeed: "staff-transition-parity",
      rng: createRng("staff-transition-parity"),
      useMiniLeague: true,
    })
    const completed: LeagueRecord = {
      ...league,
      seasonState: simulatePlayoffs(
        beginPlayoffs(simulateSeason(league.seasonState)),
      ),
    }

    const manualOpened = applyLeagueCommand(
      completed,
      { type: "beginOffseason" },
      createRng("same-staff-transition"),
    )
    const manualCalendar = getCurrentCalendar(manualOpened.seasonState)
    const manualAtMilestone = {
      ...manualOpened,
      seasonState: {
        ...manualOpened.seasonState,
        currentDay: manualCalendar.milestones.staffPhaseEndDay,
      },
    }
    const manual = applyLeagueCommand(
      manualAtMilestone,
      { type: "completeContractOptions" },
      createRng("same-staff-transition"),
    )

    const automaticOpened = advanceLeague(
      completed,
      {
        target: "day",
        policy: "runThrough",
        league: completed,
        userTeamId: completed.userTeamId,
      },
      createRng("same-staff-transition"),
    ).league
    const calendar = getCurrentCalendar(automaticOpened.seasonState)
    const automaticAtMilestone = {
      ...automaticOpened,
      seasonState: {
        ...automaticOpened.seasonState,
        currentDay: calendar.milestones.staffPhaseEndDay,
      },
    }
    const automatic = advanceLeague(
      automaticAtMilestone,
      {
        target: "day",
        policy: "runThrough",
        league: automaticAtMilestone,
        userTeamId: automaticAtMilestone.userTeamId,
      },
      createRng("same-staff-transition"),
    ).league

    expect(automatic.seasonState.offseasonPhase).toBe("staff")
    expect(automatic.staff).toEqual(manual.staff)
    expect(automatic.contractOffers.map(({ id, ...offer }) => offer)).toEqual(
      manual.contractOffers.map(({ id, ...offer }) => offer),
    )
    expect(automatic.teamFinancials).toEqual(manual.teamFinancials)
  })

  it("does not advance salary schedules again when the season starts", () => {
    const league = createLeague({
      skipPreseason: true,
      name: "No double advance",
      baseSeed: "no-double-advance",
      rng: createRng("no-double-advance"),
      useMiniLeague: true,
    })
    const contract = league.contracts.find(
      (entry) => entry.status === "active" && entry.yearlySalaries.length > 1
    )!
    const salaries = [...contract.yearlySalaries]
    const result = startNextSeason({
      seasonState: {
        ...league.seasonState,
        phase: "offseason",
        offseasonPhase: "free_agency",
        playoffBracket: {
          series: [],
          championTeamId: league.seasonState.teams[0]!.id,
        },
        draftState: {
          year: 1,
          prospects: [],
          order: [],
          currentPickIndex: 0,
          completed: true,
          selections: [],
        },
      },
      userTeamId: null,
      freeAgentPool: league.freeAgentPool,
      rng: createRng("no-double-advance-start"),
      league: {
        contracts: league.contracts,
        leagueFinancials: {
          ...league.leagueFinancials,
          currentCapSeason: 2,
        },
        teamFinancials: league.teamFinancials,
        spendingProfileEvents: league.spendingProfileEvents,
      },
    })

    expect(
      result.contracts.find((entry) => entry.id === contract.id)?.yearlySalaries
    ).toEqual(salaries)
  })
})
