import { useCallback, useEffect, useState } from "react"

import type { LeagueSummary } from "@workspace/shared/types"

import {
  clearActiveLeagueId,
  getActiveLeagueId,
  setActiveLeagueId,
} from "@/lib/activeLeague"

async function loadSavesState(): Promise<{
  saves: LeagueSummary[]
  activeId: string | null
}> {
  const { getLeague, listLeagues } = await import("@workspace/db")
  const saves = await listLeagues()

  if (saves.length === 0) {
    clearActiveLeagueId()
    return { saves, activeId: null }
  }

  const storedActiveId = getActiveLeagueId()
  const activeRecord =
    (storedActiveId ? await getLeague(storedActiveId) : undefined) ??
    (await getLeague(saves[0]!.id))

  if (!activeRecord) {
    clearActiveLeagueId()
    return { saves, activeId: null }
  }

  setActiveLeagueId(activeRecord.id)
  return { saves, activeId: activeRecord.id }
}

export function useLeagueSaves() {
  const [saves, setSaves] = useState<LeagueSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const next = await loadSavesState()
    setSaves(next.saves)
    setActiveId(next.activeId)
    return next
  }, [])

  useEffect(() => {
    let cancelled = false

    void reload()
      .catch((loadError: unknown) => {
        if (cancelled) {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load saves"
        )
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [reload])

  const retry = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      await reload()
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load saves"
      )
    } finally {
      setLoading(false)
    }
  }, [reload])

  const switchLeague = useCallback(
    async (id: string) => {
      const { getLeague } = await import("@workspace/db")
      const record = await getLeague(id)

      if (!record) {
        throw new Error("League not found")
      }

      setActiveLeagueId(id)
      setActiveId(id)
      await reload()
      return record
    },
    [reload]
  )

  const deleteLeague = useCallback(
    async (id: string) => {
      const { deleteLeague: deleteLeagueRecord } = await import("@workspace/db")
      await deleteLeagueRecord(id)

      if (activeId === id) {
        clearActiveLeagueId()
      }

      const next = await reload()
      return next
    },
    [activeId, reload]
  )

  const activeSave = saves.find((save) => save.id === activeId) ?? null

  return {
    saves,
    activeId,
    activeSave,
    loading,
    error,
    reload,
    retry,
    switchLeague,
    deleteLeague,
  }
}
