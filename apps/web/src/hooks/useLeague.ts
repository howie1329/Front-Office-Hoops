import { useCallback, useEffect, useRef, useState } from "react"

import {
  applyLeagueCommand,
  advanceLeague,
  createLeague,
  createRng,
  normalizeLeagueRecord,
} from "@workspace/sim"
import type {
  AdvancePolicy,
  AdvanceResult,
  AdvanceTarget,
  LeagueCommand,
} from "@workspace/sim"
import type {
  FreeAgentOffer,
  LeagueRecord,
  LeagueSummary,
  TradeProposal,
} from "@workspace/shared/types"

import {
  clearActiveLeagueId,
  getActiveLeagueId,
  setActiveLeagueId,
} from "@/lib/activeLeague"

export type LeagueStatus = "loading" | "empty" | "ready" | "error"
export type SaveStatus = "idle" | "saving" | "saved" | "error"

const SAVE_DEBOUNCE_MS = 300

async function resolveActiveLeagueRecord(): Promise<{
  record: LeagueRecord | null
  saves: LeagueSummary[]
}> {
  const { getLeague, listLeagues } = await import("@workspace/db")
  const saves = await listLeagues()

  if (saves.length === 0) {
    return { record: null, saves }
  }

  const activeId = getActiveLeagueId()
  const record =
    (activeId ? await getLeague(activeId) : undefined) ??
    (await getLeague(saves[0].id))

  if (!record) {
    return { record: null, saves }
  }

  setActiveLeagueId(record.id)
  return { record: normalizeLeagueRecord(record), saves }
}

export function useLeague() {
  const [status, setStatus] = useState<LeagueStatus>("loading")
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [league, setLeague] = useState<LeagueRecord | null>(null)
  const [saves, setSaves] = useState<LeagueSummary[]>([])
  const [activeLeagueId, setActiveLeagueIdState] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastAdvanceResult, setLastAdvanceResult] =
    useState<AdvanceResult | null>(null)
  const leagueRef = useRef<LeagueRecord | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef<LeagueRecord | null>(null)

  useEffect(() => {
    leagueRef.current = league
  }, [league])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const loadLeagueList = useCallback(async () => {
    const { listLeagues } = await import("@workspace/db")
    const nextSaves = await listLeagues()
    setSaves(nextSaves)
    return nextSaves
  }, [])

  const persistLeague = useCallback(
    async (record: LeagueRecord) => {
      const { saveLeague } = await import("@workspace/db")
      setSaveStatus("saving")

      try {
        const saved = await saveLeague(record)
        setLeague(saved)
        leagueRef.current = saved
        setSaveStatus("saved")
        setError(null)
        await loadLeagueList()
        return saved
      } catch (saveError: unknown) {
        setSaveStatus("error")
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Failed to save league"
        )
        throw saveError
      }
    },
    [loadLeagueList]
  )

  const flushPendingSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }

    const pending = pendingSaveRef.current
    pendingSaveRef.current = null

    if (pending) {
      await persistLeague(pending)
    }
  }, [persistLeague])

  useEffect(() => {
    let cancelled = false

    void resolveActiveLeagueRecord()
      .then(({ record, saves: nextSaves }) => {
        if (cancelled) {
          return
        }

        setSaves(nextSaves)

        if (record) {
          setLeague(record)
          leagueRef.current = record
          setActiveLeagueIdState(record.id)
          setStatus("ready")
        } else {
          clearActiveLeagueId()
          setActiveLeagueIdState(null)
          setStatus("empty")
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load league"
        )
        setStatus("error")
      })

    return () => {
      cancelled = true
    }
  }, [])

  const scheduleSave = useCallback(
    (record: LeagueRecord) => {
      setLeague(record)
      leagueRef.current = record
      setStatus("ready")
      pendingSaveRef.current = record

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      saveTimeoutRef.current = setTimeout(() => {
        pendingSaveRef.current = null
        void persistLeague(record)
      }, SAVE_DEBOUNCE_MS)
    },
    [persistLeague]
  )

  const activateLeagueRecord = useCallback(
    async (record: LeagueRecord) => {
      setActiveLeagueId(record.id)
      setActiveLeagueIdState(record.id)
      setLeague(record)
      leagueRef.current = record
      setStatus("ready")
      setError(null)
      await loadLeagueList()
      return record
    },
    [loadLeagueList]
  )

  const switchLeague = useCallback(
    async (id: string) => {
      await flushPendingSave()

      const { getLeague } = await import("@workspace/db")
      const record = await getLeague(id)

      if (!record) {
        throw new Error("League not found")
      }

      return activateLeagueRecord(normalizeLeagueRecord(record))
    },
    [activateLeagueRecord, flushPendingSave]
  )

  const deleteLeagueById = useCallback(
    async (id: string) => {
      await flushPendingSave()

      const { deleteLeague, getLeague } = await import("@workspace/db")
      await deleteLeague(id)

      const nextSaves = await loadLeagueList()
      const wasActive = activeLeagueId === id || leagueRef.current?.id === id

      if (!wasActive) {
        return
      }

      if (nextSaves.length === 0) {
        clearActiveLeagueId()
        setActiveLeagueIdState(null)
        setLeague(null)
        leagueRef.current = null
        setStatus("empty")
        return
      }

      const nextRecord = await getLeague(nextSaves[0].id)
      if (nextRecord) {
        await activateLeagueRecord(normalizeLeagueRecord(nextRecord))
      } else {
        clearActiveLeagueId()
        setActiveLeagueIdState(null)
        setLeague(null)
        leagueRef.current = null
        setStatus("empty")
      }
    },
    [activeLeagueId, activateLeagueRecord, flushPendingSave, loadLeagueList]
  )

  const createNewLeague = useCallback(
    async (name: string, seed: string) => {
      await flushPendingSave()

      const baseSeed = seed || "season-demo"
      const record = createLeague({
        name,
        baseSeed,
        rng: createRng(`schedule:${baseSeed}`),
        useMiniLeague: true,
      })

      setSaveStatus("saving")

      try {
        const { saveLeague } = await import("@workspace/db")
        const saved = await saveLeague(record)
        setActiveLeagueId(saved.id)
        setActiveLeagueIdState(saved.id)
        setLeague(saved)
        leagueRef.current = saved
        setStatus("ready")
        setSaveStatus("saved")
        setError(null)
        await loadLeagueList()
        return saved
      } catch (createError: unknown) {
        setSaveStatus("error")
        setError(
          createError instanceof Error
            ? createError.message
            : "Failed to create league"
        )
        throw createError
      }
    },
    [flushPendingSave, loadLeagueList]
  )

  const createProductLeague = useCallback(
    async (name: string, seed: string) => {
      await flushPendingSave()

      const baseSeed = seed || "league-demo"
      const record = createLeague({
        name,
        baseSeed,
        rng: createRng(`schedule:${baseSeed}`),
      })

      setSaveStatus("saving")

      try {
        const { saveLeague } = await import("@workspace/db")
        const saved = await saveLeague(record)
        setActiveLeagueId(saved.id)
        setActiveLeagueIdState(saved.id)
        setLeague(saved)
        leagueRef.current = saved
        setStatus("ready")
        setSaveStatus("saved")
        setError(null)
        await loadLeagueList()
        return saved
      } catch (createError: unknown) {
        setSaveStatus("error")
        setError(
          createError instanceof Error
            ? createError.message
            : "Failed to create league"
        )
        throw createError
      }
    },
    [flushPendingSave, loadLeagueList]
  )

  const setUserTeamId = useCallback(
    async (teamId: string) => {
      const current = leagueRef.current
      if (!current) {
        return
      }

      const updated: LeagueRecord = {
        ...current,
        userTeamId: teamId,
      }

      return persistLeague(updated)
    },
    [persistLeague]
  )

  const dispatch = useCallback(
    (command: LeagueCommand) => {
      const current = leagueRef.current
      if (!current) {
        return
      }

      try {
        scheduleSave(applyLeagueCommand(current, command))
      } catch (commandError: unknown) {
        setError(
          commandError instanceof Error
            ? commandError.message
            : "Failed to apply league command"
        )
      }
    },
    [scheduleSave]
  )

  const startNextSeasonAction = useCallback(async () => {
    const current = leagueRef.current
    if (!current) {
      return
    }

    try {
      setError(null)
      await flushPendingSave()
      const updated = applyLeagueCommand(current, { type: "startNextSeason" })
      return persistLeague(updated)
    } catch (startError: unknown) {
      setSaveStatus("error")
      setError(
        startError instanceof Error
          ? startError.message
          : "Failed to start next season"
      )
      return undefined
    }
  }, [flushPendingSave, persistLeague])

  const advance = useCallback(
    (target: AdvanceTarget, policy?: AdvancePolicy) => {
      const current = leagueRef.current
      if (!current) {
        return null
      }

      try {
        const result = advanceLeague(current, {
          target,
          policy,
          userTeamId: current.userTeamId,
          league: current,
          rngNonce: current.rngNonce,
        }, createRng(`${current.rngNonce}:${target}`))
        setLastAdvanceResult(result.result)
        scheduleSave(result.league)
        return result.result
      } catch (commandError: unknown) {
        setError(
          commandError instanceof Error
            ? commandError.message
            : "Failed to advance league",
        )
        return null
      }
    },
    [scheduleSave],
  )

  return {
    status,
    saveStatus,
    league,
    seasonState: league?.seasonState ?? null,
    seasonHistory: league?.seasonHistory ?? [],
    freeAgentPool: league?.freeAgentPool ?? [],
    userTeamId: league?.userTeamId ?? null,
    saves,
    activeLeagueId,
    error,
    lastAdvanceResult,
    createNewLeague,
    createProductLeague,
    setUserTeamId,
    switchLeague,
    deleteLeague: deleteLeagueById,
    loadLeagueList,
    dispatch,
    beginPlayoffs: () => dispatch({ type: "beginPlayoffs" }),
    beginOffseason: () => dispatch({ type: "beginOffseason" }),
    completeReSignings: () => dispatch({ type: "completeReSignings" }),
    advanceToDraft: () => dispatch({ type: "advanceToDraft" }),
    advanceToFreeAgency: () => dispatch({ type: "advanceToFreeAgency" }),
    completeFreeAgency: () => dispatch({ type: "completeFreeAgency" }),
    prepareDraft: () => dispatch({ type: "prepareDraft" }),
    makeDraftPick: (prospectId: string) =>
      dispatch({ type: "makeDraftPick", prospectId }),
    simAiPick: () => dispatch({ type: "simAiPick" }),
    simToUserPick: () => dispatch({ type: "simToUserPick" }),
    releasePlayer: (playerId: string) =>
      dispatch({ type: "releasePlayer", playerId }),
    signFreeAgent: (playerId: string, offer: FreeAgentOffer) =>
      dispatch({ type: "signFreeAgent", playerId, offer }),
    executeTrade: (proposal: TradeProposal) =>
      dispatch({ type: "executeTrade", proposal }),
    acceptTradeOffer: (offerId: string) =>
      dispatch({ type: "acceptTradeOffer", offerId }),
    rejectTradeOffer: (offerId: string) =>
      dispatch({ type: "rejectTradeOffer", offerId }),
    simulateCurrentPlayoffRound: () =>
      dispatch({ type: "simulateCurrentPlayoffRound" }),
    simulatePlayoffs: () => dispatch({ type: "simulatePlayoffs" }),
    advance,
    beginRegularSeason: () => dispatch({ type: "beginRegularSeason" }),
    skipRemainingExhibitions: () =>
      dispatch({ type: "skipRemainingExhibitions" }),
    simDay: () => advance("day", "stopAtUserGames"),
    simWeek: () => advance("week", "stopAtUserGames"),
    simSeason: () => dispatch({ type: "simSeason" }),
    startNextSeason: startNextSeasonAction,
    persistLeague,
  }
}

export function useSavedLeagueSummary() {
  const [summary, setSummary] = useState<LeagueSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    void resolveActiveLeagueRecord()
      .then(({ record, saves }) => {
        if (cancelled) {
          return
        }

        if (record) {
          const activeSummary = saves.find((save) => save.id === record.id)
          setSummary(
            activeSummary ?? {
              id: record.id,
              name: record.name,
              updatedAt: record.updatedAt,
              userTeamId: record.userTeamId,
              teamCount: record.seasonState.teams.length,
            }
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { summary, loading }
}
