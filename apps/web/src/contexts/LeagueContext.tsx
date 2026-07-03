import { createContext, useContext, useMemo, type ReactNode } from "react"

import { ROSTER_MAX } from "@workspace/shared/constants"
import type { TeamWithRoster } from "@workspace/shared/types"
import {
  isDraftRequired,
  isRegularSeasonComplete,
  isUserOnClock,
} from "@workspace/sim"

import { useLeague, type LeagueStatus, type SaveStatus } from "@/hooks/useLeague"

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
}

const LeagueContext = createContext<LeagueContextValue | null>(null)

export function LeagueProvider({ children }: { children: ReactNode }) {
  const leagueState = useLeague()

  const value = useMemo<LeagueContextValue>(() => {
    const seasonState = leagueState.seasonState
    const myTeam =
      seasonState && leagueState.userTeamId
        ? (seasonState.teams.find(
            (team) => team.id === leagueState.userTeamId,
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
    const championTeamId =
      seasonState?.playoffBracket?.championTeamId ?? null
    const completedSeason = seasonState?.season ?? 1
    const draftRequired = isDraftRequired(completedSeason)
    const draftState = seasonState?.draftState
    const draftComplete = !draftRequired || Boolean(draftState?.completed)
    const userRosterSize = myTeam?.players.length ?? 0
    const rosterOverLimit = userRosterSize > ROSTER_MAX
    const cutsNeeded = Math.max(0, userRosterSize - ROSTER_MAX)
    const userOnClock = seasonState
      ? isUserOnClock(seasonState, leagueState.userTeamId)
      : false

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
      canBeginPlayoffs: phase === "regular" && isRegularComplete,
      canBeginOffseason: isSeasonComplete && Boolean(championTeamId),
      canSimAiReSignings: offseasonPhase === "re_signing",
      canProceedToDraft: false,
      canPrepareDraft:
        offseasonPhase === "draft" &&
        draftRequired &&
        !draftState &&
        Boolean(championTeamId),
      canProceedToFreeAgency:
        offseasonPhase === "draft" && Boolean(draftState?.completed),
      canSimAiFreeAgency: offseasonPhase === "free_agency",
      isUserOnClock: userOnClock,
      rosterOverLimit,
      cutsNeeded,
      canStartNextSeason:
        offseasonPhase === "free_agency" &&
        draftComplete &&
        !rosterOverLimit &&
        userRosterSize === ROSTER_MAX,
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
