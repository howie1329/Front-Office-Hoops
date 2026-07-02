import { describe, expect, it } from "vitest"

import {
  BASE_SALARY_CAP,
  calculateLuxuryTax,
  calculateMaxSalary,
  calculateSeasonFinancials,
  deriveBirdRights,
  getCapSpace,
} from "../../src/financials"

describe("capMath", () => {
  it("calculates season financials with growth", () => {
    const season1 = calculateSeasonFinancials(BASE_SALARY_CAP, 0.05, 1)
    const season2 = calculateSeasonFinancials(BASE_SALARY_CAP, 0.05, 2)

    expect(season1.salaryCap).toBe(BASE_SALARY_CAP)
    expect(season2.salaryCap).toBeGreaterThan(season1.salaryCap)
    expect(season1.rookieScale).toHaveLength(30)
  })

  it("calculates max salary tiers", () => {
    const cap = 141
    expect(calculateMaxSalary(cap, 3)).toBe(35.3)
    expect(calculateMaxSalary(cap, 8)).toBe(42.3)
    expect(calculateMaxSalary(cap, 11)).toBe(49.3)
  })

  it("calculates luxury tax incrementally", () => {
    const tax = calculateLuxuryTax(185, 171, 5.2)
    expect(tax).toBeGreaterThan(0)
  })

  it("derives cap space", () => {
    expect(getCapSpace(120, 141)).toBe(21)
    expect(getCapSpace(150, 141)).toBe(-9)
  })
})

describe("birdRights", () => {
  it("derives bird rights from tenure", () => {
    expect(deriveBirdRights(0)).toBe("none")
    expect(deriveBirdRights(1)).toBe("non_bird")
    expect(deriveBirdRights(2)).toBe("early_bird")
    expect(deriveBirdRights(4)).toBe("bird")
  })
})
