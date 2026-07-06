import type { ReactNode } from "react"
import { createContext, useContext, useMemo } from "react"

import { ROSTER_MAX } from "@workspace/shared/constants"
import type { TeamWithRoster } from "@workspace/shared/types"
import {
  getAllPhaseEligibility,
  getCurrentCalendar,
  isRegularSeasonComplete,
  isUserOnClock,
} from "@workspace/sim"

import type { LeagueStatus, SaveStatus } from "@/hooks/useLeague"
import { useLeague } from "@/hooks/useLeague"

type LeagueContextValue = ReturnType<typeof useLeague> & {
  needsCreate: boolean
  needsPickTeam: boolean
  isReady: boolean
  myTeam: TeamWithRoster | null
  phase: "regular" | "playoffs" | "complete" | "offseason"
  isRegularComplete: boolean
  isPlayoffs: boolean
  isSeasonComplete: boolean
  isOffseason: boolean
  offseasonPhase: "re_signing" | "draft" | "free_agency" | null
  championTeamId: string | null
  canBeginPlayoffs: boolean
  canBeginOffseason: boolean
  canSimAiReSignings: boolean
  canProceedToDraft: boolean
  canPrepareDraft: boolean
  canProceedToFreeAgency: boolean
  canSimAiFreeAgency: boolean
  isUserOnClock: boolean
  rosterOverLimit: boolean
  cutsNeeded: number
  canStartNextSeason: boolean
  calendar: ReturnType<typeof getCurrentCalendar> | null
}

const LeagueContext = createContext<LeagueContextValue | null>(null)

export function LeagueProvider({ children }: { children: ReactNode }) {
  const leagueState = useLeague()

  const value = useMemo<LeagueContextValue>(() => {
    const seasonState = leagueState.seasonState
    const myTeam =
      seasonState && leagueState.userTeamId
        ? (seasonState.teams.find(
            (team) => team.id === leagueState.userTeamId
          ) ?? null)
        : null

    const phase = seasonState?.phase ?? "regular"
    const isRegularComplete = seasonState
      ? isRegularSeasonComplete(seasonState)
      : false
    const isPlayoffs = phase === "playoffs"
    const isSeasonComplete = phase === "complete"
    const isOffseason = phase === "offseason"
    const offseasonPhase = isOffseason
      ? (seasonState?.offseasonPhase ?? "re_signing")
      : null
    const championTeamId = seasonState?.playoffBracket?.championTeamId ?? null
    const userRosterSize = myTeam?.players.length ?? 0
    const rosterOverLimit = userRosterSize > ROSTER_MAX
    const cutsNeeded = Math.max(0, userRosterSize - ROSTER_MAX)
    const userOnClock = seasonState
      ? isUserOnClock(seasonState, leagueState.userTeamId)
      : false
    const calendar = seasonState ? getCurrentCalendar(seasonState) : null
    const eligibility =
      leagueState.league !== null
        ? getAllPhaseEligibility(leagueState.league)
        : null

    return {
      ...leagueState,
      needsCreate: leagueState.status === "empty",
      needsPickTeam:
        leagueState.status === "ready" && leagueState.userTeamId === null,
      isReady:
        leagueState.status === "ready" && leagueState.userTeamId !== null,
      myTeam,
      phase,
      isRegularComplete,
      isPlayoffs,
      isSeasonComplete,
      isOffseason,
      offseasonPhase,
      championTeamId,
      canBeginPlayoffs: eligibility?.beginPlayoffs.allowed ?? false,
      canBeginOffseason: eligibility?.beginOffseason.allowed ?? false,
      canSimAiReSignings: eligibility?.simAiReSignings.allowed ?? false,
      canProceedToDraft: eligibility?.proceedToDraft.allowed ?? false,
      canPrepareDraft: eligibility?.prepareDraft.allowed ?? false,
      canProceedToFreeAgency: eligibility?.proceedToFreeAgency.allowed ?? false,
      canSimAiFreeAgency: eligibility?.simAiFreeAgency.allowed ?? false,
      isUserOnClock: userOnClock,
      rosterOverLimit,
      cutsNeeded,
      canStartNextSeason: eligibility?.startNextSeason.allowed ?? false,
      calendar,
    }
  }, [leagueState])

  return (
    <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>
  )
}

export function useLeagueContext() {
  const context = useContext(LeagueContext)
  if (!context) {
    throw new Error("useLeagueContext must be used within LeagueProvider")
  }

  return context
}

export type { LeagueStatus, SaveStatus }
