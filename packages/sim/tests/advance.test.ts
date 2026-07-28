import { describe, expect, it } from "vitest"

import {
  advanceLeague,
  beginOffseason,
  beginPlayoffs,
  createLeague,
  createRng,
  getCurrentCalendar,
  simulatePlayoffs,
  simulateSeason,
  skipRemainingExhibitions,
} from "../src"

function userTeamId() {
  return "t_baltimore_foundry"
}

function createReadyOffseasonLeague() {
  const league = createLeague({
    skipPreseason: true,
    name: "Auto Offseason",
    baseSeed: "auto-offseason",
    rng: createRng("auto-offseason"),
    useMiniLeague: true,
    userTeamId: userTeamId(),
  })

  let state = simulateSeason(league.seasonState)
  state = beginPlayoffs(state)
  state = simulatePlayoffs(state)
  state = beginOffseason(state)

  return {
    ...league,
    seasonState: state,
  }
}

describe("advanceLeague calendar flow", () => {
  it("blocks the regular season date when the user roster still needs cuts", () => {
    const league = createLeague({
      name: "Roster Cuts",
      baseSeed: "roster-cuts",
      rng: createRng("roster-cuts"),
      useMiniLeague: true,
      userTeamId: userTeamId(),
    })

    const result = advanceLeague(
      league,
      {
        target: "week",
        policy: "runThrough",
        userTeamId: league.userTeamId,
      },
      createRng("roster-cuts-advance"),
    )

    expect(result.league.seasonState.phase).toBe("preseason")
    expect(result.result.stoppedReason).toBe("roster_cuts")
  })

  it("starts the regular season automatically when preseason is complete and roster is valid", () => {
    const league = createLeague({
      name: "Auto Regular",
      baseSeed: "auto-regular",
      rng: createRng("auto-regular"),
      useMiniLeague: true,
      userTeamId: userTeamId(),
    })
    const preseasonComplete = skipRemainingExhibitions(league)
    const milestones = getCurrentCalendar(preseasonComplete).milestones
    const readyLeague = {
      ...league,
      seasonState: {
        ...preseasonComplete,
        currentDay: milestones.regularSeasonStartDay,
        teams: preseasonComplete.teams.map((team) =>
          team.id === league.userTeamId
            ? { ...team, players: team.players.slice(0, 15) }
            : team
        ),
      },
    }

    const result = advanceLeague(
      readyLeague,
      { target: "day", policy: "runThrough", userTeamId: league.userTeamId },
      createRng("auto-regular-advance"),
    )

    expect(result.league.seasonState.phase).toBe("regular")
    expect(result.result.events).toContainEqual({
      type: "phase_started",
      phase: "regular",
    })
  })

  it("starts playoffs automatically when the regular season calendar is complete", () => {
    const league = createLeague({
      skipPreseason: true,
      name: "Auto Playoffs",
      baseSeed: "auto-playoffs",
      rng: createRng("auto-playoffs"),
      useMiniLeague: true,
    })
    const completedRegularSeason = simulateSeason(league.seasonState)
    const readyLeague = {
      ...league,
      seasonState: completedRegularSeason,
    }

    const result = advanceLeague(
      readyLeague,
      { target: "day", policy: "runThrough" },
      createRng("auto-playoffs-advance"),
    )

    expect(result.league.seasonState.phase).toBe("playoffs")
    expect(result.result.events).toContainEqual({
      type: "phase_started",
      phase: "playoffs",
    })
  })

  it("emits a trade deadline event after the deadline day passes", () => {
    const league = createLeague({
      skipPreseason: true,
      name: "Trade Deadline",
      baseSeed: "trade-deadline",
      rng: createRng("trade-deadline"),
      useMiniLeague: true,
    })
    const deadline = getCurrentCalendar(league.seasonState).milestones.tradeDeadlineDay
    const result = advanceLeague(
      {
        ...league,
        seasonState: {
          ...league.seasonState,
          currentDay: deadline,
        },
      },
      { target: "day", policy: "runThrough" },
      createRng("trade-deadline-advance"),
    )

    expect(result.league.seasonState.currentDay).toBeGreaterThan(deadline)
    expect(result.result.events).toContainEqual({
      type: "trade_deadline_passed",
    })
  })

  it("initializes the staff market after automatic contract-option completion", () => {
    const league = createReadyOffseasonLeague()
    const draftDay = getCurrentCalendar(league.seasonState).milestones.draftDay
    const result = advanceLeague(
      {
        ...league,
        seasonState: {
          ...league.seasonState,
          currentDay: draftDay,
        },
      },
      { target: "day", policy: "runThrough", userTeamId: league.userTeamId },
      createRng("auto-draft-advance"),
    )

    expect(result.league.seasonState.offseasonPhase).toBe("staff")
    expect(result.result.stoppedReason).toBe("staff")
    expect(result.result.events).toContainEqual({
      type: "phase_started",
      phase: "staff",
    })
  })
})
