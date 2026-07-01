import { useCallback, useEffect, useRef, useState } from "react"

import { createLeague, createRng } from "@workspace/sim"
import type { LeagueRecord, SeasonState } from "@workspace/shared/types"

export type LeagueStatus = "loading" | "empty" | "ready" | "error"
export type SaveStatus = "idle" | "saving" | "saved" | "error"

const SAVE_DEBOUNCE_MS = 300

export function useLeague() {
  const [status, setStatus] = useState<LeagueStatus>("loading")
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [league, setLeague] = useState<LeagueRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const leagueRef = useRef<LeagueRecord | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  useEffect(() => {
    let cancelled = false

    void import("@workspace/db")
      .then(async ({ getMostRecentLeague }) => {
        const saved = await getMostRecentLeague()
        if (cancelled) {
          return
        }

        if (saved) {
          setLeague(saved)
          setStatus("ready")
        } else {
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
            : "Failed to load league",
        )
        setStatus("error")
      })

    return () => {
      cancelled = true
    }
  }, [])

  const persistLeague = useCallback(async (record: LeagueRecord) => {
    const { saveLeague } = await import("@workspace/db")
    setSaveStatus("saving")

    try {
      const saved = await saveLeague(record)
      setLeague(saved)
      leagueRef.current = saved
      setSaveStatus("saved")
      setError(null)
      return saved
    } catch (saveError: unknown) {
      setSaveStatus("error")
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save league",
      )
      throw saveError
    }
  }, [])

  const scheduleSave = useCallback(
    (record: LeagueRecord) => {
      setLeague(record)
      leagueRef.current = record
      setStatus("ready")

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      saveTimeoutRef.current = setTimeout(() => {
        void persistLeague(record)
      }, SAVE_DEBOUNCE_MS)
    },
    [persistLeague],
  )

  const createNewLeague = useCallback(
    async (name: string, seed: string) => {
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
        setLeague(saved)
        leagueRef.current = saved
        setStatus("ready")
        setSaveStatus("saved")
        setError(null)
        return saved
      } catch (createError: unknown) {
        setSaveStatus("error")
        setError(
          createError instanceof Error
            ? createError.message
            : "Failed to create league",
        )
        throw createError
      }
    },
    [],
  )

  const createProductLeague = useCallback(
    async (name: string, seed: string) => {
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
        setLeague(saved)
        leagueRef.current = saved
        setStatus("ready")
        setSaveStatus("saved")
        setError(null)
        return saved
      } catch (createError: unknown) {
        setSaveStatus("error")
        setError(
          createError instanceof Error
            ? createError.message
            : "Failed to create league",
        )
        throw createError
      }
    },
    [],
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
    [persistLeague],
  )

  const updateSeasonState = useCallback(
    (updater: (state: SeasonState) => SeasonState) => {
      const current = leagueRef.current
      if (!current) {
        return
      }

      scheduleSave({
        ...current,
        seasonState: updater(current.seasonState),
      })
    },
    [scheduleSave],
  )

  return {
    status,
    saveStatus,
    league,
    seasonState: league?.seasonState ?? null,
    userTeamId: league?.userTeamId ?? null,
    error,
    createNewLeague,
    createProductLeague,
    setUserTeamId,
    updateSeasonState,
    persistLeague,
  }
}

export function useSavedLeagueSummary() {
  const [summary, setSummary] = useState<{
    id: string
    name: string
    updatedAt: string
    userTeamId: string | null
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    void import("@workspace/db")
      .then(async ({ getMostRecentLeague }) => {
        const league = await getMostRecentLeague()
        if (cancelled) {
          return
        }

        if (league) {
          setSummary({
            id: league.id,
            name: league.name,
            updatedAt: league.updatedAt,
            userTeamId: league.userTeamId,
          })
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
