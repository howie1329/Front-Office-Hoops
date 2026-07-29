import {
  createPlayerContractFixture,
  createStandardPlayerGenerationConfig,
} from "@workspace/domain-v2"
import type { PhysicalProfile, PlayerSkills } from "@workspace/domain-v2"
import { describe, expect, it } from "vitest"

import { derivePlayerRole } from "../src"

function profileWith(
  physical: Partial<PhysicalProfile>,
  skills: Partial<PlayerSkills>
) {
  const profile = createPlayerContractFixture().profile
  return {
    physical: { ...profile.physical, ...physical },
    skills: { ...profile.skills, ...skills },
  }
}

describe("player role derivation", () => {
  it("identifies a lead guard from creation and decision skills", () => {
    const result = derivePlayerRole(
      profileWith(
        { heightInches: 74, weightPounds: 190, wingspanInches: 76, speed: 78 },
        { passing: 82, handling: 82, basketballIQ: 80, shooting: 68 }
      ),
      createStandardPlayerGenerationConfig()
    )

    expect(result.role.primaryPosition).toBe("PG")
    expect(result.role.primaryArchetype).toBe("lead_guard")
  })

  it("requires both shooting and defense for a three-and-D label", () => {
    const result = derivePlayerRole(
      profileWith(
        { heightInches: 80, weightPounds: 220, wingspanInches: 85 },
        { shooting: 78, defense: 78, stamina: 75, finishing: 55 }
      ),
      createStandardPlayerGenerationConfig()
    )

    expect(result.role.primaryArchetype).toBe("three_and_d_wing")
  })

  it("falls back to a broad family label when no specialist gate passes", () => {
    const result = derivePlayerRole(
      profileWith(
        { heightInches: 80, weightPounds: 220, wingspanInches: 83 },
        {
          shooting: 50,
          finishing: 50,
          passing: 50,
          handling: 50,
          rebounding: 50,
          defense: 50,
          basketballIQ: 50,
        }
      ),
      createStandardPlayerGenerationConfig()
    )

    expect(["combo_guard", "utility_wing", "utility_big"]).toContain(
      result.role.primaryArchetype
    )
  })

  it("keeps secondary classifications selective and adjacent", () => {
    const config = createStandardPlayerGenerationConfig()
    const result = derivePlayerRole(
      profileWith({}, {}),
      {
        ...config,
        classification: {
          ...config.classification,
          minPositionFit: 100,
          minSecondaryArchetypeFit: 100,
        },
      }
    )

    expect(result.role.secondaryPosition).toBeNull()
    expect(result.role.secondaryArchetype).toBeNull()
  })
})
