import type { PlayoffSeries, SeasonState } from "@workspace/shared/types"

import { createSeriesFromWinners } from "./createBracket"
import { scheduleInitialPlayoffGames, scheduleNextSeriesGame } from "./createPlayoffSchedule"
import { isSeriesComplete, getPlayoffFormat } from "./playoffConfig"

type WinnerSeed = {
  teamId: string
  seed: number
}

function winnerAsSeed(series: PlayoffSeries): WinnerSeed | null {
  if (!series.winnerId) {
    return null
  }

  if (series.winnerId === series.higherSeedTeamId) {
    return { teamId: series.winnerId, seed: series.higherSeed }
  }

  return { teamId: series.winnerId, seed: series.lowerSeed }
}

function getConferenceRoundSeries(
  series: PlayoffSeries[],
  conferenceId: "east" | "west",
  round: number,
): PlayoffSeries[] {
  return series
    .filter(
      (entry) => entry.conferenceId === conferenceId && entry.round === round,
    )
    .sort((a, b) => a.id.localeCompare(b.id))
}

function allSeriesComplete(
  series: PlayoffSeries[],
  teamCount: number,
): boolean {
  const format = getPlayoffFormat(teamCount)
  return (
    series.length > 0 &&
    series.every(
      (entry) => entry.winnerId || isSeriesComplete(entry, format),
    )
  )
}

function maybeAdvanceConference(
  state: SeasonState,
  series: PlayoffSeries[],
  conferenceId: "east" | "west",
): { series: PlayoffSeries[]; scheduleGames: ReturnType<typeof scheduleInitialPlayoffGames> } {
  const teamCount = state.teams.length
  const scheduleGames: ReturnType<typeof scheduleInitialPlayoffGames> = []
  let nextSeries = [...series]

  const round1 = getConferenceRoundSeries(nextSeries, conferenceId, 1)
  const round2 = getConferenceRoundSeries(nextSeries, conferenceId, 2)

  if (
    round1.length === 4 &&
    allSeriesComplete(round1, teamCount) &&
    round2.length === 0
  ) {
    const winners = round1.map((entry) => winnerAsSeed(entry)!)
    const semifinals = [
      createSeriesFromWinners(
        `po_${state.season}_${conferenceId}_r2_0`,
        state.season,
        2,
        conferenceId,
        winners[0]!,
        winners[1]!,
      ),
      createSeriesFromWinners(
        `po_${state.season}_${conferenceId}_r2_1`,
        state.season,
        2,
        conferenceId,
        winners[2]!,
        winners[3]!,
      ),
    ]
    nextSeries = [...nextSeries, ...semifinals]
    scheduleGames.push(...scheduleInitialPlayoffGames(state, semifinals))
  }

  const updatedRound2 = getConferenceRoundSeries(nextSeries, conferenceId, 2)
  const round3 = getConferenceRoundSeries(nextSeries, conferenceId, 3)

  if (
    updatedRound2.length === 2 &&
    allSeriesComplete(updatedRound2, teamCount) &&
    round3.length === 0
  ) {
    const winners = updatedRound2.map((entry) => winnerAsSeed(entry)!)
    const final = createSeriesFromWinners(
      `po_${state.season}_${conferenceId}_r3_0`,
      state.season,
      3,
      conferenceId,
      winners[0]!,
      winners[1]!,
    )
    nextSeries = [...nextSeries, final]
    scheduleGames.push(...scheduleInitialPlayoffGames(state, [final]))
  }

  return { series: nextSeries, scheduleGames }
}

function maybeCreateFinals(state: SeasonState, series: PlayoffSeries[]) {
  const eastFinal = getConferenceRoundSeries(series, "east", 3)[0]
  const westFinal = getConferenceRoundSeries(series, "west", 3)[0]
  const finals = series.filter((entry) => entry.round === 4)

  if (
    eastFinal?.winnerId &&
    westFinal?.winnerId &&
    finals.length === 0
  ) {
    const eastWinner = winnerAsSeed(eastFinal)!
    const westWinner = winnerAsSeed(westFinal)!
    const higher = eastWinner.seed <= westWinner.seed ? eastWinner : westWinner
    const lower = eastWinner.seed <= westWinner.seed ? westWinner : eastWinner

    const finalSeries = createSeriesFromWinners(
      `po_${state.season}_finals`,
      state.season,
      4,
      undefined,
      higher,
      lower,
    )

    return {
      series: [...series, finalSeries],
      scheduleGames: scheduleInitialPlayoffGames(state, [finalSeries]),
    }
  }

  return { series, scheduleGames: [] as ReturnType<typeof scheduleInitialPlayoffGames> }
}

function maybeAdvanceSixTeam(state: SeasonState, series: PlayoffSeries[]) {
  const teamCount = state.teams.length
  const format = getPlayoffFormat(teamCount)
  const scheduleGames: ReturnType<typeof scheduleInitialPlayoffGames> = []
  let nextSeries = [...series]

  const semis = nextSeries.filter((entry) => entry.round === 1)
  const finals = nextSeries.filter((entry) => entry.round === 2)

  if (
    semis.length === 2 &&
    semis.every((entry) => entry.winnerId || isSeriesComplete(entry, format)) &&
    finals.length === 0
  ) {
    const winners = semis.map((entry) => winnerAsSeed(entry)!)
    const finalSeries = createSeriesFromWinners(
      `po_${state.season}_finals`,
      state.season,
      2,
      undefined,
      winners[0]!,
      winners[1]!,
    )
    nextSeries = [...nextSeries, finalSeries]
    scheduleGames.push(...scheduleInitialPlayoffGames(state, [finalSeries]))
  }

  return { series: nextSeries, scheduleGames }
}

export function advancePlayoffWinners(state: SeasonState): SeasonState {
  const bracket = state.playoffBracket
  if (!bracket) {
    return state
  }

  const teamCount = state.teams.length
  let workingState: SeasonState = {
    ...state,
    playoffBracket: {
      ...bracket,
      series: [...bracket.series],
    },
  }

  if (teamCount === 30) {
    for (const conferenceId of ["east", "west"] as const) {
      const result = maybeAdvanceConference(
        workingState,
        workingState.playoffBracket!.series,
        conferenceId,
      )
      workingState = {
        ...workingState,
        schedule: [...workingState.schedule, ...result.scheduleGames],
        playoffBracket: {
          ...workingState.playoffBracket!,
          series: result.series,
        },
      }
    }

    const finalsResult = maybeCreateFinals(
      workingState,
      workingState.playoffBracket!.series,
    )
    workingState = {
      ...workingState,
      schedule: [...workingState.schedule, ...finalsResult.scheduleGames],
      playoffBracket: {
        ...workingState.playoffBracket!,
        series: finalsResult.series,
      },
    }
  } else if (teamCount === 6) {
    const result = maybeAdvanceSixTeam(
      workingState,
      workingState.playoffBracket!.series,
    )
    workingState = {
      ...workingState,
      schedule: [...workingState.schedule, ...result.scheduleGames],
      playoffBracket: {
        ...workingState.playoffBracket!,
        series: result.series,
      },
    }
  }

  const format = getPlayoffFormat(teamCount)
  const finalsSeries =
    teamCount === 30
      ? workingState.playoffBracket!.series.find((entry) => entry.round === 4)
      : workingState.playoffBracket!.series.find((entry) => entry.round === 2)

  if (finalsSeries && isSeriesComplete(finalsSeries, format) && finalsSeries.winnerId) {
    workingState = {
      ...workingState,
      phase: "complete",
      playoffBracket: {
        ...workingState.playoffBracket!,
        championTeamId: finalsSeries.winnerId,
        runnerUpTeamId: finalsSeries.loserId,
      },
    }
  }

  return workingState
}

export function ensureActiveSeriesScheduled(state: SeasonState): SeasonState {
  const bracket = state.playoffBracket
  if (!bracket) {
    return state
  }

  const format = getPlayoffFormat(state.teams.length)
  let schedule = [...state.schedule]

  for (const series of bracket.series) {
    if (isSeriesComplete(series, format) || series.winnerId) {
      continue
    }

    const hasScheduled = schedule.some(
      (game) => game.seriesId === series.id && game.status === "scheduled",
    )

    if (!hasScheduled) {
      const nextGame = scheduleNextSeriesGame({ ...state, schedule }, series)
      if (nextGame) {
        schedule = [...schedule, nextGame]
      }
    }
  }

  return {
    ...state,
    schedule,
  }
}
