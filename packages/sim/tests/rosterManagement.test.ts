import { describe, expect, it } from "vitest"

import { createLeague, createRng, releasePlayer } from "../src"

describe("roster management", () => {
  it("blocks releases that would leave fewer than six players", () => {
    const league = createLeague({
      name: "Roster Floor",
      baseSeed: "roster-floor",
      rng: createRng("roster-floor"),
      useMiniLeague: true,
    })
    const team = {
      ...league.seasonState.teams[0]!,
      players: league.seasonState.teams[0]!.players.slice(0, 6),
    }

    expect(() =>
      releasePlayer([team], [], {
        teamId: team.id,
        playerId: team.players[0]!.id,
      }),
    ).toThrow("minimum roster")
  })

  it("blocks releases that would remove the last player at a position", () => {
    const league = createLeague({
      name: "Position Floor",
      baseSeed: "position-floor",
      rng: createRng("position-floor"),
      useMiniLeague: true,
    })
    const team = league.seasonState.teams[0]!
    const onlyCenter = team.players.find((player) => player.position === "C")!
    const players = team.players.filter(
      (player) => player.position !== "C" || player.id === onlyCenter.id,
    )

    expect(() =>
      releasePlayer([{ ...team, players }], [], {
        teamId: team.id,
        playerId: onlyCenter.id,
      }),
    ).toThrow("position coverage")
  })
})
