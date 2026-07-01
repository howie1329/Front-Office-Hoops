import { createContext, useContext, useMemo, type ReactNode } from "react"

import type { TeamWithRoster } from "@workspace/shared/types"

import { useLeague, type LeagueStatus, type SaveStatus } from "@/hooks/useLeague"

type LeagueContextValue = ReturnType<typeof useLeague> & {
  needsCreate: boolean
  needsPickTeam: boolean
  isReady: boolean
  myTeam: TeamWithRoster | null
}

const LeagueContext = createContext<LeagueContextValue | null>(null)

export function LeagueProvider({ children }: { children: ReactNode }) {
  const leagueState = useLeague()

  const value = useMemo<LeagueContextValue>(() => {
    const myTeam =
      leagueState.seasonState && leagueState.userTeamId
        ? (leagueState.seasonState.teams.find(
            (team) => team.id === leagueState.userTeamId,
          ) ?? null)
        : null

    return {
      ...leagueState,
      needsCreate: leagueState.status === "empty",
      needsPickTeam:
        leagueState.status === "ready" && leagueState.userTeamId === null,
      isReady:
        leagueState.status === "ready" && leagueState.userTeamId !== null,
      myTeam,
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
