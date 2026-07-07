import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"

import { formatMoney } from "@/components/league/lib/moneyFormat"
import { teamName } from "@/components/league/lib/teamFormat"
import { useLeagueContext } from "@/contexts/LeagueContext"
import type {
  DraftPickAsset,
  Player,
  SeasonState,
  TradeEvaluation,
  TradeHistoryEntry,
  TradeProposal,
  TradeValidationResult,
} from "@workspace/shared/types"
import {
  AI_ACCEPT_BAD,
  AI_ACCEPT_CLOSE,
  AI_ACCEPT_MIN_NET,
} from "@workspace/shared/financialConstants"
import {
  evaluateTrade,
  getContractAssetValueBreakdown,
  getCurrentSalary,
  getFairSalary,
  getPickValueFromCache,
  getPlayerContract,
  getSeasonFinancials,
  makeItWork,
  validateTrade,
  wouldAiAcceptTrade,
} from "@workspace/sim"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

type TradesSearch = {
  targetTeamId?: string
  outgoingPlayerId?: string
  incomingPlayerId?: string
}

export const Route = createFileRoute("/league/trades")({
  validateSearch: (search: Record<string, unknown>): TradesSearch => {
    const parsed: TradesSearch = {}
    if (typeof search.targetTeamId === "string") {
      parsed.targetTeamId = search.targetTeamId
    }
    if (typeof search.outgoingPlayerId === "string") {
      parsed.outgoingPlayerId = search.outgoingPlayerId
    }
    if (typeof search.incomingPlayerId === "string") {
      parsed.incomingPlayerId = search.incomingPlayerId
    }
    return parsed
  },
  component: LeagueTradesPage,
})

const NONE = "none"

function LeagueTradesPage() {
  const { league, seasonState, userTeamId, myTeam, executeTrade, acceptTradeOffer, rejectTradeOffer } =
    useLeagueContext()
  const search = Route.useSearch()
  const [targetTeamId, setTargetTeamId] = useState(search.targetTeamId ?? "")
  const [outgoingPlayerIds, setOutgoingPlayerIds] = useState<string[]>(
    search.outgoingPlayerId ? [search.outgoingPlayerId] : []
  )
  const [incomingPlayerIds, setIncomingPlayerIds] = useState<string[]>(
    search.incomingPlayerId ? [search.incomingPlayerId] : []
  )
  const [outgoingPickIds, setOutgoingPickIds] = useState<string[]>([])
  const [incomingPickIds, setIncomingPickIds] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setTargetTeamId(search.targetTeamId ?? "")
    setOutgoingPlayerIds(
      search.outgoingPlayerId ? [search.outgoingPlayerId] : []
    )
    setIncomingPlayerIds(
      search.incomingPlayerId ? [search.incomingPlayerId] : []
    )
    setOutgoingPickIds([])
    setIncomingPickIds([])
    setMessage(null)
  }, [search.incomingPlayerId, search.outgoingPlayerId, search.targetTeamId])

  const targetTeam = seasonState?.teams.find((team) => team.id === targetTeamId)
  const userPicks =
    league?.draftPickAssets.filter(
      (pick) => pick.currentTeamId === userTeamId
    ) ?? []
  const targetPicks =
    league?.draftPickAssets.filter(
      (pick) => pick.currentTeamId === targetTeamId
    ) ?? []

  const proposal = useMemo<TradeProposal | null>(() => {
    if (!userTeamId || !targetTeamId) {
      return null
    }

    const selectedAssetCount =
      outgoingPlayerIds.length +
      incomingPlayerIds.length +
      outgoingPickIds.length +
      incomingPickIds.length

    if (selectedAssetCount === 0) {
      return null
    }

    return {
      from: {
        teamId: userTeamId,
        playerIds: outgoingPlayerIds,
        pickIds: outgoingPickIds,
      },
      to: {
        teamId: targetTeamId,
        playerIds: incomingPlayerIds,
        pickIds: incomingPickIds,
      },
    }
  }, [
    incomingPickIds,
    incomingPlayerIds,
    outgoingPickIds,
    outgoingPlayerIds,
    targetTeamId,
    userTeamId,
  ])

  const targetMode =
    league?.teamFinancials.find((entry) => entry.teamId === targetTeamId)
      ?.strategy.mode ?? "buying"

  if (!league || !seasonState || !userTeamId || !myTeam) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trades</CardTitle>
          <CardDescription>
            Pick a team before proposing trades.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const validation = proposal ? validateTrade(league, proposal) : null
  const aiResponse = proposal
    ? wouldAiAcceptTrade(league, proposal, targetTeamId)
    : null
  const evaluations = proposal ? evaluateTrade(league, proposal) : []
  const canExecute = Boolean(validation?.ok && aiResponse?.ok)
  const outgoingPlayers = myTeam.players.filter((player) =>
    outgoingPlayerIds.includes(player.id)
  )
  const incomingPlayers =
    targetTeam?.players.filter((player) =>
      incomingPlayerIds.includes(player.id)
    ) ?? []
  const outgoingPicks = userPicks.filter((pick) =>
    outgoingPickIds.includes(pick.id)
  )
  const incomingPicks = targetPicks.filter((pick) =>
    incomingPickIds.includes(pick.id)
  )
  const userEvaluation = evaluations.find(
    (entry) => entry.teamId === userTeamId
  )
  const activeLeague = league

  function salary(player: Player): number {
    return getCurrentSalary(getPlayerContract(activeLeague.contracts, player))
  }

  function clearTrade() {
    setOutgoingPlayerIds([])
    setIncomingPlayerIds([])
    setOutgoingPickIds([])
    setIncomingPickIds([])
    setMessage(null)
  }

  function applySuggestedBalance() {
    if (!proposal || !targetTeamId || !league) {
      return
    }
    const balanced = makeItWork(league, proposal, targetTeamId)
    if (!balanced) {
      setMessage("No legal balance found with current assets.")
      return
    }
    setOutgoingPlayerIds(balanced.from.playerIds)
    setIncomingPlayerIds(balanced.to.playerIds)
    setOutgoingPickIds(balanced.from.pickIds ?? [])
    setIncomingPickIds(balanced.to.pickIds ?? [])
    setMessage("Suggested balance applied.")
  }

  const pendingOffers =
    league.pendingTradeOffers?.filter(
      (offer) =>
        offer.status === "pending" &&
        (offer.toTeamId === userTeamId || offer.fromTeamId === userTeamId),
    ) ?? []

  const seasonFinancials = getSeasonFinancials(
    league.leagueFinancials,
    seasonState.season,
  )
  const assetBreakdown: Array<{
    label: string
    side: "send" | "receive"
    value: number
  }> = []

  if (targetTeamId) {
    for (const player of outgoingPlayers) {
      const contract = getPlayerContract(league.contracts, player)
      assetBreakdown.push({
        label: playerLabel(player),
        side: "send",
        value: getContractAssetValueBreakdown({
          player,
          contract,
          expectedSalary: getFairSalary(player, seasonFinancials, league),
          mode: "buying",
        }).total,
      })
    }

    for (const player of incomingPlayers) {
      const contract = getPlayerContract(league.contracts, player)
      assetBreakdown.push({
        label: playerLabel(player),
        side: "receive",
        value: getContractAssetValueBreakdown({
          player,
          contract,
          expectedSalary: getFairSalary(player, seasonFinancials, league),
          mode: targetMode,
        }).total,
      })
    }

    for (const pick of outgoingPicks) {
      assetBreakdown.push({
        label: pickLabel(pick, seasonState),
        side: "send",
        value: getPickValueFromCache(
          pick,
          league.draftClassCache,
          league,
          userTeamId,
          "buying",
        ),
      })
    }

    for (const pick of incomingPicks) {
      assetBreakdown.push({
        label: pickLabel(pick, seasonState),
        side: "receive",
        value: getPickValueFromCache(
          pick,
          league.draftClassCache,
          league,
          targetTeamId,
          targetMode,
        ),
      })
    }
  }

  return (
    <div className="-m-px flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-px">
      {pendingOffers.length > 0 ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Pending offers</CardTitle>
            <CardDescription>
              AI teams have proposed trades waiting on your decision.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 py-4">
            {pendingOffers.map((offer) => (
              <div
                key={offer.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/10 px-3 py-2 text-sm"
              >
                <span>
                  {teamName(seasonState, offer.fromTeamId)} proposed a trade ·
                  expires day {offer.expiresDay}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rejectTradeOffer(offer.id)}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => acceptTradeOffer(offer.id)}
                  >
                    Accept
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <TradeWorkspaceHeader
        seasonState={seasonState}
        userTeamId={userTeamId}
        targetTeamId={targetTeamId}
        validation={validation}
        aiResponse={aiResponse}
        canExecute={canExecute}
        onTargetTeamChange={(value) => {
          setTargetTeamId(value)
          setIncomingPlayerIds([])
          setIncomingPickIds([])
          setMessage(null)
        }}
        onClear={clearTrade}
        onSuggestBalance={applySuggestedBalance}
        onComplete={() => {
          if (!proposal) {
            return
          }
          executeTrade(proposal)
          clearTrade()
          setMessage("Trade completed.")
        }}
      />

      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <TradeSideBuilder
            title="You send"
            description={teamName(seasonState, userTeamId)}
            players={myTeam.players}
            picks={userPicks}
            selectedPlayerIds={outgoingPlayerIds}
            selectedPickIds={outgoingPickIds}
            selectedPlayers={outgoingPlayers}
            selectedPicks={outgoingPicks}
            salaryTotal={sumSalary(outgoingPlayers, salary)}
            value={userEvaluation?.outgoingValue ?? 0}
            disabled={false}
            seasonState={seasonState}
            salary={salary}
            onAddPlayer={(id) => {
              setOutgoingPlayerIds((ids) => addUnique(ids, id))
              setMessage(null)
            }}
            onRemovePlayer={(id) => {
              setOutgoingPlayerIds((ids) => ids.filter((entry) => entry !== id))
              setMessage(null)
            }}
            onAddPick={(id) => {
              setOutgoingPickIds((ids) => addUnique(ids, id))
              setMessage(null)
            }}
            onRemovePick={(id) => {
              setOutgoingPickIds((ids) => ids.filter((entry) => entry !== id))
              setMessage(null)
            }}
          />

          <TradeSideBuilder
            title="You receive"
            description={
              targetTeam
                ? teamName(seasonState, targetTeam.id)
                : "Choose partner"
            }
            players={targetTeam?.players ?? []}
            picks={targetPicks}
            selectedPlayerIds={incomingPlayerIds}
            selectedPickIds={incomingPickIds}
            selectedPlayers={incomingPlayers}
            selectedPicks={incomingPicks}
            salaryTotal={sumSalary(incomingPlayers, salary)}
            value={userEvaluation?.incomingValue ?? 0}
            disabled={!targetTeam}
            seasonState={seasonState}
            salary={salary}
            onAddPlayer={(id) => {
              setIncomingPlayerIds((ids) => addUnique(ids, id))
              setMessage(null)
            }}
            onRemovePlayer={(id) => {
              setIncomingPlayerIds((ids) => ids.filter((entry) => entry !== id))
              setMessage(null)
            }}
            onAddPick={(id) => {
              setIncomingPickIds((ids) => addUnique(ids, id))
              setMessage(null)
            }}
            onRemovePick={(id) => {
              setIncomingPickIds((ids) => ids.filter((entry) => entry !== id))
              setMessage(null)
            }}
          />
        </div>

        <TradeCheckPanel
          seasonState={seasonState}
          userTeamId={userTeamId}
          targetTeamId={targetTeamId}
          validation={validation}
          aiResponse={aiResponse}
          evaluations={evaluations}
          outgoingSalary={sumSalary(outgoingPlayers, salary)}
          incomingSalary={sumSalary(incomingPlayers, salary)}
          assetBreakdown={assetBreakdown}
          message={message}
        />
      </div>

      <TradeHistoryCard
        seasonState={seasonState}
        history={league.tradeHistory}
      />
    </div>
  )
}

function TradeWorkspaceHeader({
  seasonState,
  userTeamId,
  targetTeamId,
  validation,
  aiResponse,
  canExecute,
  onTargetTeamChange,
  onClear,
  onSuggestBalance,
  onComplete,
}: {
  seasonState: SeasonState
  userTeamId: string
  targetTeamId: string
  validation: TradeValidationResult | null
  aiResponse: TradeValidationResult | null
  canExecute: boolean
  onTargetTeamChange: (teamId: string) => void
  onClear: () => void
  onSuggestBalance: () => void
  onComplete: () => void
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <CardTitle>Trade workspace</CardTitle>
            <CardDescription>
              Build multi-player and pick packages, then check value and salary
              matching before completing the deal.
            </CardDescription>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[520px]">
            <CheckMetric
              label="League check"
              value={
                validation ? (validation.ok ? "Clear" : "Blocked") : "Idle"
              }
              ok={validation?.ok ?? null}
            />
            <CheckMetric
              label="AI response"
              value={
                aiResponse ? (aiResponse.ok ? "Accepts" : "Rejects") : "Idle"
              }
              ok={aiResponse?.ok ?? null}
            />
            <CheckMetric
              label="Status"
              value={canExecute ? "Ready" : "Build"}
              ok={canExecute ? true : null}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 py-4 lg:grid-cols-[260px_minmax(0,1fr)_auto]">
        <label className="grid gap-1 text-sm">
          Trade partner
          <Select value={targetTeamId} onValueChange={onTargetTeamChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select team" />
            </SelectTrigger>
            <SelectContent>
              {seasonState.teams
                .filter((team) => team.id !== userTeamId)
                .map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {teamName(seasonState, team.id)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </label>
        <div className="rounded-md border bg-muted/10 px-3 py-2 text-sm text-muted-foreground">
          {targetTeamId
            ? "Add assets on either side. Salary, roster, and value checks update automatically."
            : "Choose a partner to open their roster and picks."}
        </div>
        <div className="flex flex-wrap items-end gap-2 lg:justify-end">
          <Button variant="outline" onClick={onSuggestBalance} disabled={!targetTeamId}>
            Suggest balance
          </Button>
          <Button variant="outline" onClick={onClear}>
            Clear trade
          </Button>
          <Button disabled={!canExecute} onClick={onComplete}>
            Complete trade
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function TradeSideBuilder({
  title,
  description,
  players,
  picks,
  selectedPlayerIds,
  selectedPickIds,
  selectedPlayers,
  selectedPicks,
  salaryTotal,
  value,
  disabled,
  seasonState,
  salary,
  onAddPlayer,
  onRemovePlayer,
  onAddPick,
  onRemovePick,
}: {
  title: string
  description: string
  players: Player[]
  picks: DraftPickAsset[]
  selectedPlayerIds: string[]
  selectedPickIds: string[]
  selectedPlayers: Player[]
  selectedPicks: DraftPickAsset[]
  salaryTotal: number
  value: number
  disabled: boolean
  seasonState: SeasonState
  salary: (player: Player) => number
  onAddPlayer: (playerId: string) => void
  onRemovePlayer: (playerId: string) => void
  onAddPick: (pickId: string) => void
  onRemovePick: (pickId: string) => void
}) {
  const availablePlayers = players.filter(
    (player) => !selectedPlayerIds.includes(player.id)
  )
  const availablePicks = picks.filter(
    (pick) => !selectedPickIds.includes(pick.id)
  )
  const selectedAssetCount = selectedPlayers.length + selectedPicks.length

  return (
    <Card className="min-h-0">
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>{selectedAssetCount} assets</div>
            <div>{formatMoney(salaryTotal)}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 py-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <AssetSelect
            label="Add player"
            placeholder="Player"
            disabled={disabled || availablePlayers.length === 0}
            onValueChange={onAddPlayer}
            options={availablePlayers.map((player) => ({
              id: player.id,
              label: `${playerLabel(player)} · ${player.ratings.overall} OVR · ${formatMoney(
                salary(player)
              )}`,
            }))}
          />
          <AssetSelect
            label="Add pick"
            placeholder="Draft pick"
            disabled={disabled || availablePicks.length === 0}
            onValueChange={onAddPick}
            options={availablePicks.map((pick) => ({
              id: pick.id,
              label: pickLabel(pick, seasonState),
            }))}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <MiniMetric label="Salary" value={formatMoney(salaryTotal)} />
          <MiniMetric label="Value" value={value.toFixed(1)} />
          <MiniMetric label="Assets" value={String(selectedAssetCount)} />
        </div>

        <div className="grid gap-2 rounded-md border bg-muted/10 p-2">
          {selectedAssetCount === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              No assets selected.
            </p>
          ) : null}
          {selectedPlayers.map((player) => (
            <SelectedAssetRow
              key={player.id}
              title={playerLabel(player)}
              subtitle={`${player.position} · ${player.age} yrs`}
              detail={`${player.ratings.overall} OVR / ${player.ratings.potential} POT`}
              value={formatMoney(salary(player))}
              onRemove={() => onRemovePlayer(player.id)}
            />
          ))}
          {selectedPicks.map((pick) => (
            <SelectedAssetRow
              key={pick.id}
              title={pick.round === 1 ? "1st round" : "2nd round"}
              subtitle={`Season ${pick.season}`}
              detail={`From ${teamName(seasonState, pick.originalTeamId)}`}
              value="-"
              onRemove={() => onRemovePick(pick.id)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function SelectedAssetRow({
  title,
  subtitle,
  detail,
  value,
  onRemove,
}: {
  title: string
  subtitle: string
  detail: string
  value: string
  onRemove: () => void
}) {
  return (
    <div className="grid gap-3 rounded-md border bg-card px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(96px,auto)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="truncate font-medium">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <div className="min-w-0 text-sm text-muted-foreground sm:text-right">
        <div className="truncate">{detail}</div>
        <div className="font-medium text-foreground tabular-nums">{value}</div>
      </div>
      <Button variant="ghost" size="sm" onClick={onRemove}>
        Remove
      </Button>
    </div>
  )
}

function AssetSelect({
  label,
  placeholder,
  disabled,
  options,
  onValueChange,
}: {
  label: string
  placeholder: string
  disabled: boolean
  options: Array<{ id: string; label: string }>
  onValueChange: (id: string) => void
}) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <Select
        value={NONE}
        disabled={disabled}
        onValueChange={(value) => {
          if (value !== NONE) {
            onValueChange(value)
          }
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

function TradeCheckPanel({
  seasonState,
  userTeamId,
  targetTeamId,
  validation,
  aiResponse,
  evaluations,
  outgoingSalary,
  incomingSalary,
  assetBreakdown,
  message,
}: {
  seasonState: SeasonState
  userTeamId: string
  targetTeamId: string
  validation: TradeValidationResult | null
  aiResponse: TradeValidationResult | null
  evaluations: TradeEvaluation[]
  outgoingSalary: number
  incomingSalary: number
  assetBreakdown: Array<{ label: string; side: "send" | "receive"; value: number }>
  message: string | null
}) {
  const userEvaluation = evaluations.find(
    (entry) => entry.teamId === userTeamId
  )
  const targetEvaluation = evaluations.find(
    (entry) => entry.teamId === targetTeamId
  )
  const statusText = validation
    ? validation.ok
      ? aiResponse?.ok
        ? "Trade can be completed."
        : (aiResponse?.reason ?? "Waiting on AI response.")
      : validation.reason
    : "Add assets to run trade checks."

  return (
    <Card className="min-h-[520px]">
      <CardHeader className="border-b">
        <CardTitle>Trade check</CardTitle>
        <CardDescription>{statusText}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 py-4">
        <div className="grid gap-2">
          <InfoRow
            label="Outgoing salary"
            value={formatMoney(outgoingSalary)}
          />
          <InfoRow
            label="Incoming salary"
            value={formatMoney(incomingSalary)}
          />
          <InfoRow
            label="Salary difference"
            value={formatMoney(incomingSalary - outgoingSalary)}
          />
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">In</TableHead>
                <TableHead className="text-right">Out</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evaluations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No value check yet.
                  </TableCell>
                </TableRow>
              ) : null}
              {evaluations.map((entry) => (
                <TableRow key={entry.teamId}>
                  <TableCell>{teamName(seasonState, entry.teamId)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {entry.incomingValue.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {entry.outgoingValue.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {entry.netValue.toFixed(1)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-2">
          <InfoRow
            label="Your net value"
            value={userEvaluation ? userEvaluation.netValue.toFixed(1) : "-"}
          />
          <InfoRow
            label="Their net value"
            value={
              targetEvaluation ? targetEvaluation.netValue.toFixed(1) : "-"
            }
          />
        </div>

        {targetEvaluation ? (
          <AiAcceptThresholdBar netValue={targetEvaluation.netValue} />
        ) : null}

        {assetBreakdown.length > 0 ? (
          <div className="rounded-md border">
            <div className="border-b px-3 py-2 text-sm font-medium">
              Asset value breakdown
            </div>
            <div className="grid gap-1 p-2">
              {assetBreakdown.map((row) => (
                <div
                  key={`${row.side}_${row.label}`}
                  className="flex items-center justify-between gap-3 rounded-md bg-muted/10 px-3 py-2 text-sm"
                >
                  <span className="truncate">
                    {row.side === "send" ? "Send" : "Receive"} · {row.label}
                  </span>
                  <span className="font-medium tabular-nums">
                    {row.value.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {message ? (
          <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
            {message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function TradeHistoryCard({
  seasonState,
  history,
}: {
  seasonState: SeasonState
  history: TradeHistoryEntry[]
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Trade history</CardTitle>
        <CardDescription>
          Completed trades are recorded with assets, salary, and value
          snapshots.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto py-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Season</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Assets sent</TableHead>
              <TableHead>Salary sent</TableHead>
              <TableHead>Net value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-sm text-muted-foreground"
                >
                  No trades completed yet.
                </TableCell>
              </TableRow>
            ) : null}
            {[...history]
              .slice(-8)
              .reverse()
              .flatMap((entry) =>
                entry.teams.map((teamEntry) => (
                  <TableRow key={`${entry.id}_${teamEntry.teamId}`}>
                    <TableCell>{entry.season}</TableCell>
                    <TableCell>
                      {teamName(seasonState, teamEntry.teamId)}
                    </TableCell>
                    <TableCell>{assetCount(teamEntry)}</TableCell>
                    <TableCell>
                      {formatMoney(teamEntry.outgoingSalary)}
                    </TableCell>
                    <TableCell>{teamEntry.netValue.toFixed(1)}</TableCell>
                  </TableRow>
                ))
              )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function CheckMetric({
  label,
  value,
  ok,
}: {
  label: string
  value: string
  ok: boolean | null
}) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={
          ok === false
            ? "mt-0.5 text-sm font-medium text-destructive"
            : "mt-0.5 text-sm font-medium"
        }
      >
        {value}
      </div>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/10 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium tabular-nums">{value}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3 rounded-md border bg-muted/10 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium tabular-nums">{value}</span>
    </div>
  )
}

function AiAcceptThresholdBar({ netValue }: { netValue: number }) {
  const min = AI_ACCEPT_BAD - 1
  const max = AI_ACCEPT_MIN_NET + 3
  const range = max - min
  const position = Math.max(0, Math.min(100, ((netValue - min) / range) * 100))
  const acceptPosition = ((AI_ACCEPT_MIN_NET - min) / range) * 100
  const closePosition = ((AI_ACCEPT_CLOSE - min) / range) * 100

  return (
    <div className="grid gap-2 rounded-md border bg-muted/10 p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">AI accept bar</span>
        <span className="font-medium tabular-nums">{netValue.toFixed(1)} net</span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 bg-destructive/30"
          style={{ width: `${closePosition}%` }}
        />
        <div
          className="absolute inset-y-0 bg-amber-500/30"
          style={{
            left: `${closePosition}%`,
            width: `${acceptPosition - closePosition}%`,
          }}
        />
        <div
          className="absolute inset-y-0 bg-emerald-500/35"
          style={{
            left: `${acceptPosition}%`,
            right: 0,
          }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-foreground"
          style={{ left: `${position}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>Reject ({AI_ACCEPT_BAD})</span>
        <span>Close ({AI_ACCEPT_CLOSE})</span>
        <span>Accept ({AI_ACCEPT_MIN_NET}+)</span>
      </div>
    </div>
  )
}

function playerLabel(player: Player): string {
  return `${player.firstName} ${player.lastName}`
}

function pickLabel(pick: DraftPickAsset, seasonState: SeasonState): string {
  return `${pick.season} ${pick.round === 1 ? "1st" : "2nd"} from ${teamName(
    seasonState,
    pick.originalTeamId
  )}`
}

function assetCount(entry: TradeHistoryEntry["teams"][number]): number {
  return entry.sentPlayerIds.length + entry.sentPickIds.length
}

function addUnique(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value]
}

function sumSalary(
  players: Player[],
  salary: (player: Player) => number
): number {
  return players.reduce((total, player) => total + salary(player), 0)
}
