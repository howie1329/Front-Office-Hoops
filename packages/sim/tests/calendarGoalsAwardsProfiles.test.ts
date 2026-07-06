import { describe, expect, it } from "vitest"

import {
  archivePlayerCareerSnapshots,
  assignSeasonAwards,
  canTradeOnDate,
  createLeague,
  createRng,
  evaluateOwnerGoals,
  getCalendarDate,
  getCurrentCalendar,
  simulateSeason,
} from "../src"

describe("calendar, goals, awards, and player profiles", () => {
  it("maps fictional calendar dates and trade deadline gates", () => {
    const league = createLeague({
      name: "Calendar League",
      baseSeed: "calendar",
      rng: createRng("calendar"),
      useMiniLeague: true,
    })
    const calendar = getCurrentCalendar(league.seasonState)

    expect(getCalendarDate(1).label).toBe("Oct 1")
    expect(calendar.milestones.tradeDeadlineDay).toBeGreaterThan(1)
    expect(canTradeOnDate(league.seasonState)).toBe(true)
    expect(
      canTradeOnDate({
        ...league.seasonState,
        currentDay: calendar.milestones.tradeDeadlineDay,
      })
    ).toBe(false)
  })

  it("creates owners and season goals for every team", () => {
    const league = createLeague({
      name: "Owner League",
      baseSeed: "owners",
      rng: createRng("owners"),
      useMiniLeague: true,
    })

    expect(league.owners).toHaveLength(league.seasonState.teams.length)
    expect(league.ownerGoals.length).toBeGreaterThanOrEqual(
      league.seasonState.teams.length
    )
  })

  it("assigns awards, evaluates goals, and archives player snapshots", () => {
    const league = createLeague({
      name: "Awards League",
      baseSeed: "awards",
      rng: createRng("awards"),
      useMiniLeague: true,
    })
    const completeRegularSeason = {
      ...league,
      seasonState: simulateSeason(league.seasonState),
    }
    const withAwards = assignSeasonAwards(completeRegularSeason)
    const withGoals = evaluateOwnerGoals(withAwards)
    const withSnapshots = archivePlayerCareerSnapshots(withGoals)

    expect(withAwards.seasonAwards.some((award) => award.type === "mvp")).toBe(
      true
    )
    expect(withGoals.ownerGoals.some((goal) => goal.status !== "active")).toBe(
      true
    )
    expect(withSnapshots.playerCareerSnapshots.length).toBeGreaterThan(0)
    expect(
      withSnapshots.leagueLog.some((entry) => entry.type === "award")
    ).toBe(true)
    expect(
      withSnapshots.leagueLog.some((entry) => entry.type === "owner_goal")
    ).toBe(true)
  })
})
