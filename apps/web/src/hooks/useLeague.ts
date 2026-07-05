import { useCallback, useEffect, useRef, useState } from "react"

import {
  advanceToDraftPhase,
  advanceToFreeAgencyPhase,
  archivePlayerCareerSnapshots,
  assignSeasonAwards,
  beginOffseason,
  beginPlayoffs,
  completeFreeAgencyPhase,
  completeReSigningPhase,
  createLeague,
  createLeagueLogEntry,
  createRng,
  ensureFaPoolMinimum,
  evaluateOwnerGoals,
  executeTrade,
  generateOwnerGoals,
  makeDraftPick,
  normalizeLeagueRecord,
  prepareDraft,
  processOffseasonFinancials,
  releasePlayer,
  signFreeAgent,
  attachRookieContractsForDraftSelections,
  simAiPick,
  simToUserPick,
  simulatePlayoffs,
  startNextSeason,
  waivePlayerContract,
} from "@workspace/sim"
import type {
  FreeAgentOffer,
  LeagueRecord,
  LeagueSummary,
  SeasonState,
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

function withDraftSelectionLogs(
  before: LeagueRecord,
  after: LeagueRecord
): LeagueRecord {
  const priorSelections = new Set(
    before.seasonState.draftState?.selections.map(
      (selection) => selection.playerId
    ) ?? []
  )
  const nextSelections =
    after.seasonState.draftState?.selections.filter(
      (selection) => !priorSelections.has(selection.playerId)
    ) ?? []

  if (nextSelections.length === 0) {
    return after
  }

  return {
    ...after,
    leagueLog: [
      ...after.leagueLog,
      ...nextSelections.map((selection, index) =>
        createLeagueLogEntry({
          league: after,
          type: "draft_selection",
          teamId: selection.teamId,
          playerId: selection.playerId,
          payload: {
            round: selection.round,
            overallPick: selection.overallPick,
            prospectId: selection.prospectId,
          },
          sequence: index + 1,
        })
      ),
    ],
  }
}

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
    [scheduleSave]
  )

  const updateLeagueRecord = useCallback(
    (updater: (record: LeagueRecord) => LeagueRecord) => {
      const current = leagueRef.current
      if (!current) {
        return
      }

      scheduleSave(updater(current))
    },
    [scheduleSave]
  )

  const prepareDraftAction = useCallback(() => {
    updateLeagueRecord((record) => ({
      ...record,
      seasonState: prepareDraft(record.seasonState, record.draftPickAssets),
    }))
  }, [updateLeagueRecord])

  const makeDraftPickAction = useCallback(
    (prospectId: string) => {
      updateLeagueRecord((record) => {
        const result = makeDraftPick(
          record.seasonState,
          prospectId,
          record.freeAgentPool
        )
        const updated: LeagueRecord = {
          ...record,
          seasonState: result.seasonState,
          freeAgentPool: result.freeAgentPool,
        }

        return withDraftSelectionLogs(
          record,
          attachRookieContractsForDraftSelections(updated)
        )
      })
    },
    [updateLeagueRecord]
  )

  const simAiPickAction = useCallback(() => {
    updateLeagueRecord((record) => {
      const result = simAiPick(record.seasonState, record.freeAgentPool)
      const updated: LeagueRecord = {
        ...record,
        seasonState: result.seasonState,
        freeAgentPool: result.freeAgentPool,
      }

      return withDraftSelectionLogs(
        record,
        attachRookieContractsForDraftSelections(updated)
      )
    })
  }, [updateLeagueRecord])

  const simToUserPickAction = useCallback(() => {
    updateLeagueRecord((record) => {
      const result = simToUserPick(
        record.seasonState,
        record.userTeamId,
        record.freeAgentPool
      )
      const updated: LeagueRecord = {
        ...record,
        seasonState: result.seasonState,
        freeAgentPool: result.freeAgentPool,
      }

      return withDraftSelectionLogs(
        record,
        attachRookieContractsForDraftSelections(updated)
      )
    })
  }, [updateLeagueRecord])

  const releasePlayerAction = useCallback(
    (playerId: string) => {
      const current = leagueRef.current
      if (!current?.userTeamId) {
        return
      }
      const userTeamId = current.userTeamId

      updateLeagueRecord((record) => {
        const updated = waivePlayerContract(record, playerId)
        const result = releasePlayer(
          updated.seasonState.teams,
          updated.freeAgentPool,
          {
            teamId: userTeamId,
            playerId,
          }
        )
        return {
          ...updated,
          leagueLog: [
            ...updated.leagueLog,
            createLeagueLogEntry({
              league: updated,
              type: "release",
              teamId: current.userTeamId!,
              playerId,
              payload: {},
            }),
          ],
          seasonState: {
            ...updated.seasonState,
            teams: result.teams,
          },
          freeAgentPool: result.freeAgentPool,
        }
      })
    },
    [updateLeagueRecord]
  )

  const beginPlayoffsAction = useCallback(() => {
    updateSeasonState((state) => beginPlayoffs(state))
  }, [updateSeasonState])

  const beginOffseasonAction = useCallback(() => {
    const current = leagueRef.current
    if (!current) {
      return
    }

    const rng = createRng(
      `${current.seasonState.baseSeed}:offseason:${current.seasonState.season}`
    )
    const completedLeague = archivePlayerCareerSnapshots(
      evaluateOwnerGoals(assignSeasonAwards(current))
    )
    const nextState = beginOffseason(completedLeague.seasonState, rng)
    const updated = processOffseasonFinancials(
      { ...completedLeague, seasonState: nextState },
      rng
    )

    scheduleSave(updated)
  }, [scheduleSave])

  const simulatePlayoffsAction = useCallback(() => {
    updateSeasonState((state) => simulatePlayoffs(state))
  }, [updateSeasonState])

  const completeReSigningsAction = useCallback(() => {
    updateLeagueRecord((record) =>
      completeReSigningPhase(
        record,
        createRng(
          `${record.seasonState.baseSeed}:ai-re-sign:${record.seasonState.season}`
        )
      )
    )
  }, [updateLeagueRecord])

  const advanceToDraftAction = useCallback(() => {
    updateSeasonState((state) => advanceToDraftPhase(state))
  }, [updateSeasonState])

  const advanceToFreeAgencyAction = useCallback(() => {
    updateLeagueRecord((record) =>
      ensureFaPoolMinimum(
        {
          ...record,
          seasonState: advanceToFreeAgencyPhase(record.seasonState),
        },
        createRng(
          `${record.seasonState.baseSeed}:fa-pool:${record.seasonState.season}`
        )
      )
    )
  }, [updateLeagueRecord])

  const completeFreeAgencyAction = useCallback(() => {
    updateLeagueRecord((record) =>
      completeFreeAgencyPhase(
        record,
        createRng(
          `${record.seasonState.baseSeed}:ai-fa:${record.seasonState.season}`
        )
      )
    )
  }, [updateLeagueRecord])

  const startNextSeasonAction = useCallback(async () => {
    const current = leagueRef.current
    if (!current) {
      return
    }

    try {
      setError(null)
      await flushPendingSave()

      const result = startNextSeason({
        seasonState: current.seasonState,
        userTeamId: current.userTeamId,
        freeAgentPool: current.freeAgentPool,
        rng: createRng(
          `${current.seasonState.baseSeed}:season:${current.seasonState.season + 1}`
        ),
        league: {
          contracts: current.contracts,
          leagueFinancials: current.leagueFinancials,
          teamFinancials: current.teamFinancials,
          spendingProfileEvents: current.spendingProfileEvents,
          draftPickAssets: current.draftPickAssets,
        },
      })

      const updated = normalizeLeagueRecord({
        ...current,
        seasonState: result.seasonState,
        seasonHistory: [...current.seasonHistory, result.historyEntry],
        freeAgentPool: result.freeAgentPool,
        contracts: result.contracts,
        leagueFinancials: result.leagueFinancials,
        teamFinancials: result.teamFinancials,
        draftPickAssets: result.draftPickAssets,
      })

      const withGoals = {
        ...updated,
        ownerGoals: [
          ...updated.ownerGoals.filter(
            (goal) => goal.season !== updated.seasonState.season
          ),
          ...generateOwnerGoals(updated),
        ],
      }

      return persistLeague(withGoals)
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

  const signFreeAgentAction = useCallback(
    (playerId: string, offer: FreeAgentOffer) => {
      const current = leagueRef.current
      if (!current?.userTeamId) {
        return
      }

      updateLeagueRecord((record) =>
        signFreeAgent(record, record.userTeamId!, playerId, offer)
      )
    },
    [updateLeagueRecord]
  )

  const executeTradeAction = useCallback(
    (proposal: TradeProposal) => {
      updateLeagueRecord((record) => executeTrade(record, proposal))
    },
    [updateLeagueRecord]
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
    createNewLeague,
    createProductLeague,
    setUserTeamId,
    switchLeague,
    deleteLeague: deleteLeagueById,
    loadLeagueList,
    beginPlayoffs: beginPlayoffsAction,
    beginOffseason: beginOffseasonAction,
    completeReSignings: completeReSigningsAction,
    advanceToDraft: advanceToDraftAction,
    advanceToFreeAgency: advanceToFreeAgencyAction,
    completeFreeAgency: completeFreeAgencyAction,
    prepareDraft: prepareDraftAction,
    makeDraftPick: makeDraftPickAction,
    simAiPick: simAiPickAction,
    simToUserPick: simToUserPickAction,
    releasePlayer: releasePlayerAction,
    signFreeAgent: signFreeAgentAction,
    executeTrade: executeTradeAction,
    simulatePlayoffs: simulatePlayoffsAction,
    startNextSeason: startNextSeasonAction,
    updateSeasonState,
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
