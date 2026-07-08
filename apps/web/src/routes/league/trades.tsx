import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useMemo, useRef, useState } from "react"

import { formatMoney } from "@/components/league/lib/moneyFormat"
import { teamName } from "@/components/league/lib/teamFormat"
import { useLeagueContext } from "@/contexts/LeagueContext"
import type {
  DraftPickAsset,
  PendingTradeOffer,
  Player,
  SeasonState,
  TeamMode,
  TradeEvaluation,
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
import { Badge } from "@workspace/ui/components/badge"
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

type TradeTab = "incoming" | "build"
type AssetTab = "players" | "picks"

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

function LeagueTradesPage() {
  const {
    league,
    seasonState,
    userTeamId,
    myTeam,
    executeTrade,
    acceptTradeOffer,
    rejectTradeOffer,
  } = useLeagueContext()
  const search = Route.useSearch()
  const hasBuilderSearch = Boolean(
    search.targetTeamId || search.outgoingPlayerId || search.incomingPlayerId,
  )
  const [activeTab, setActiveTab] = useState<TradeTab>(
    hasBuilderSearch ? "build" : "incoming",
  )
  const [assetTab, setAssetTab] = useState<AssetTab>("players")
  const [targetTeamId, setTargetTeamId] = useState(search.targetTeamId ?? "")
  const [outgoingPlayerIds, setOutgoingPlayerIds] = useState<string[]>(
    search.outgoingPlayerId ? [search.outgoingPlayerId] : [],
  )
  const [incomingPlayerIds, setIncomingPlayerIds] = useState<string[]>(
    search.incomingPlayerId ? [search.incomingPlayerId] : [],
  )
  const [outgoingPickIds, setOutgoingPickIds] = useState<string[]>([])
  const [incomingPickIds, setIncomingPickIds] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setTargetTeamId(search.targetTeamId ?? "")
    setOutgoingPlayerIds(
      search.outgoingPlayerId ? [search.outgoingPlayerId] : [],
    )
    setIncomingPlayerIds(
      search.incomingPlayerId ? [search.incomingPlayerId] : [],
    )
    setOutgoingPickIds([])
    setIncomingPickIds([])
    setMessage(null)
  }, [search.incomingPlayerId, search.outgoingPlayerId, search.targetTeamId])

  const pendingOffers =
    league?.pendingTradeOffers.filter(
      (offer) =>
        offer.status === "pending" &&
        (offer.toTeamId === userTeamId || offer.fromTeamId === userTeamId),
    ) ?? []

  useEffect(() => {
    if (pendingOffers.length > 0 && !hasBuilderSearch) {
      setActiveTab("incoming")
    }
  }, [hasBuilderSearch, pendingOffers.length])

  if (!league || !seasonState || !userTeamId || !myTeam) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trades</CardTitle>
          <CardDescription>Pick a team before proposing trades.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const activeLeague = league
  const targetTeam = seasonState.teams.find((team) => team.id === targetTeamId)
  const userPicks = activeLeague.draftPickAssets.filter(
    (pick) => pick.currentTeamId === userTeamId,
  )
  const targetPicks = activeLeague.draftPickAssets.filter(
    (pick) => pick.currentTeamId === targetTeamId,
  )
  const targetMode =
    activeLeague.teamFinancials.find((entry) => entry.teamId === targetTeamId)
      ?.strategy.mode ?? "buying"
  const seasonFinancials = getSeasonFinancials(
    activeLeague.leagueFinancials,
    seasonState.season,
  )

  function salary(player: Player): number {
    return getCurrentSalary(getPlayerContract(activeLeague.contracts, player))
  }

  const outgoingPlayers = myTeam.players.filter((player) =>
    outgoingPlayerIds.includes(player.id),
  )
  const incomingPlayers =
    targetTeam?.players.filter((player) => incomingPlayerIds.includes(player.id)) ??
    []
  const outgoingPicks = userPicks.filter((pick) =>
    outgoingPickIds.includes(pick.id),
  )
  const incomingPicks = targetPicks.filter((pick) =>
    incomingPickIds.includes(pick.id),
  )

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

  const validation = proposal ? validateTrade(activeLeague, proposal) : null
  const aiResponse = proposal
    ? wouldAiAcceptTrade(activeLeague, proposal, targetTeamId)
    : null
  const evaluations = proposal ? evaluateTrade(activeLeague, proposal) : []
  const canExecute = Boolean(validation?.ok && aiResponse?.ok)
  const userEvaluation = evaluations.find((entry) => entry.teamId === userTeamId)
  const targetEvaluation = evaluations.find(
    (entry) => entry.teamId === targetTeamId,
  )

  const outgoingValue =
    userEvaluation?.outgoingValue ??
    getAssetValueTotal({
      players: outgoingPlayers,
      picks: outgoingPicks,
      mode: "buying",
      teamId: userTeamId,
      league: activeLeague,
      seasonFinancials,
    })
  const incomingValue =
    userEvaluation?.incomingValue ??
    getAssetValueTotal({
      players: incomingPlayers,
      picks: incomingPicks,
      mode: targetMode,
      teamId: targetTeamId,
      league: activeLeague,
      seasonFinancials,
    })

  function clearTrade() {
    setOutgoingPlayerIds([])
    setIncomingPlayerIds([])
    setOutgoingPickIds([])
    setIncomingPickIds([])
    setMessage(null)
  }

  function applySuggestedBalance() {
    if (!proposal || !targetTeamId) {
      return
    }
    const balanced = makeItWork(activeLeague, proposal, targetTeamId)
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

  return (
    <div className="-m-px flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-px">
      <Card className="shrink-0">
        <CardHeader className="border-b pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Trades</CardTitle>
              <CardDescription>
                Review incoming offers or build a package from team assets.
              </CardDescription>
            </div>
            <div className="flex rounded-md border bg-muted/20 p-1">
              <TabButton
                active={activeTab === "incoming"}
                onClick={() => setActiveTab("incoming")}
              >
                Incoming offers
                {pendingOffers.length > 0 ? (
                  <Badge variant="default">{pendingOffers.length}</Badge>
                ) : null}
              </TabButton>
              <TabButton
                active={activeTab === "build"}
                onClick={() => setActiveTab("build")}
              >
                Build trade
              </TabButton>
            </div>
          </div>
        </CardHeader>

        {activeTab === "build" ? (
          <TradeTicketBar
            outgoingPlayers={outgoingPlayers.length}
            outgoingPicks={outgoingPicks.length}
            incomingPlayers={incomingPlayers.length}
            incomingPicks={incomingPicks.length}
            outgoingSalary={sumSalary(outgoingPlayers, salary)}
            incomingSalary={sumSalary(incomingPlayers, salary)}
            outgoingValue={outgoingValue}
            incomingValue={incomingValue}
            validation={validation}
            aiResponse={aiResponse}
          />
        ) : null}
      </Card>

      {activeTab === "incoming" ? (
        <IncomingOffersPanel
          seasonState={seasonState}
          userTeamId={userTeamId}
          offers={pendingOffers}
          onAccept={acceptTradeOffer}
          onReject={rejectTradeOffer}
        />
      ) : (
        <div className="grid min-h-0 gap-4">
          <BuildTradeControls
            seasonState={seasonState}
            userTeamId={userTeamId}
            targetTeamId={targetTeamId}
            assetTab={assetTab}
            canExecute={canExecute}
            hasProposal={Boolean(proposal)}
            onAssetTabChange={setAssetTab}
            onTargetTeamChange={(teamId) => {
              setTargetTeamId(teamId)
              setIncomingPlayerIds([])
              setIncomingPickIds([])
              setMessage(null)
            }}
            onSuggestBalance={applySuggestedBalance}
            onClear={clearTrade}
            onComplete={() => {
              if (!proposal) {
                return
              }
              executeTrade(proposal)
              clearTrade()
              setMessage("Trade completed.")
            }}
          />

          <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid min-w-0 gap-4 lg:grid-cols-2">
              <AssetTableCard
                title="You send"
                description={teamName(seasonState, userTeamId)}
                assetTab={assetTab}
                players={myTeam.players}
                picks={userPicks}
                selectedPlayerIds={outgoingPlayerIds}
                selectedPickIds={outgoingPickIds}
                seasonState={seasonState}
                salary={salary}
                onPlayerToggle={(playerId, checked) => {
                  setOutgoingPlayerIds((ids) => toggleId(ids, playerId, checked))
                  setMessage(null)
                }}
                onPickToggle={(pickId, checked) => {
                  setOutgoingPickIds((ids) => toggleId(ids, pickId, checked))
                  setMessage(null)
                }}
              />

              <AssetTableCard
                title="You receive"
                description={
                  targetTeam
                    ? teamName(seasonState, targetTeam.id)
                    : "Choose partner"
                }
                assetTab={assetTab}
                players={targetTeam?.players ?? []}
                picks={targetPicks}
                selectedPlayerIds={incomingPlayerIds}
                selectedPickIds={incomingPickIds}
                seasonState={seasonState}
                salary={salary}
                disabled={!targetTeam}
                onPlayerToggle={(playerId, checked) => {
                  setIncomingPlayerIds((ids) => toggleId(ids, playerId, checked))
                  setMessage(null)
                }}
                onPickToggle={(pickId, checked) => {
                  setIncomingPickIds((ids) => toggleId(ids, pickId, checked))
                  setMessage(null)
                }}
              />
            </div>

            <TradeStatusPanel
              validation={validation}
              aiResponse={aiResponse}
              targetEvaluation={targetEvaluation}
              outgoingSalary={sumSalary(outgoingPlayers, salary)}
              incomingSalary={sumSalary(incomingPlayers, salary)}
              message={message}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function IncomingOffersPanel({
  seasonState,
  userTeamId,
  offers,
  onAccept,
  onReject,
}: {
  seasonState: SeasonState
  userTeamId: string
  offers: PendingTradeOffer[]
  onAccept: (offerId: string) => void
  onReject: (offerId: string) => void
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Incoming offers</CardTitle>
        <CardDescription>
          Trade proposals waiting on your decision.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 py-4">
        {offers.length === 0 ? (
          <div className="rounded-lg border bg-muted/10 p-6 text-sm text-muted-foreground">
            No incoming trade offers right now.
          </div>
        ) : null}
        {offers.map((offer) => {
          const youSend =
            offer.proposal.from.teamId === userTeamId
              ? offer.proposal.from
              : offer.proposal.to
          const youReceive =
            offer.proposal.from.teamId === userTeamId
              ? offer.proposal.to
              : offer.proposal.from

          return (
            <div
              key={offer.id}
              className="grid gap-3 rounded-lg border bg-card p-4 lg:grid-cols-[1fr_auto]"
            >
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-medium">
                    {teamName(seasonState, offer.initiatorTeamId)} proposed a trade
                  </h2>
                  <Badge variant="outline">Expires day {offer.expiresDay}</Badge>
                </div>
                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <PackageLine
                    label="You send"
                    players={youSend.playerIds.length}
                    picks={youSend.pickIds?.length ?? 0}
                  />
                  <PackageLine
                    label="You receive"
                    players={youReceive.playerIds.length}
                    picks={youReceive.pickIds?.length ?? 0}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onReject(offer.id)}
                >
                  Reject
                </Button>
                <Button size="sm" onClick={() => onAccept(offer.id)}>
                  Accept
                </Button>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function BuildTradeControls({
  seasonState,
  userTeamId,
  targetTeamId,
  assetTab,
  canExecute,
  hasProposal,
  onAssetTabChange,
  onTargetTeamChange,
  onSuggestBalance,
  onClear,
  onComplete,
}: {
  seasonState: SeasonState
  userTeamId: string
  targetTeamId: string
  assetTab: AssetTab
  canExecute: boolean
  hasProposal: boolean
  onAssetTabChange: (tab: AssetTab) => void
  onTargetTeamChange: (teamId: string) => void
  onSuggestBalance: () => void
  onClear: () => void
  onComplete: () => void
}) {
  return (
    <Card>
      <CardContent className="grid gap-3 py-4 lg:grid-cols-[260px_auto_minmax(0,1fr)_auto] lg:items-end">
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

        <div className="flex w-fit rounded-md border bg-muted/20 p-1">
          <TabButton
            active={assetTab === "players"}
            onClick={() => onAssetTabChange("players")}
          >
            Players
          </TabButton>
          <TabButton
            active={assetTab === "picks"}
            onClick={() => onAssetTabChange("picks")}
          >
            Draft picks
          </TabButton>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          Select assets directly from each table. The package summary stays
          visible while you switch between players and picks.
        </p>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            onClick={onSuggestBalance}
            disabled={!hasProposal}
          >
            Suggest balance
          </Button>
          <Button variant="outline" onClick={onClear}>
            Clear
          </Button>
          <Button disabled={!canExecute} onClick={onComplete}>
            Submit trade
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function TradeTicketBar({
  outgoingPlayers,
  outgoingPicks,
  incomingPlayers,
  incomingPicks,
  outgoingSalary,
  incomingSalary,
  outgoingValue,
  incomingValue,
  validation,
  aiResponse,
}: {
  outgoingPlayers: number
  outgoingPicks: number
  incomingPlayers: number
  incomingPicks: number
  outgoingSalary: number
  incomingSalary: number
  outgoingValue: number
  incomingValue: number
  validation: TradeValidationResult | null
  aiResponse: TradeValidationResult | null
}) {
  return (
    <CardContent className="grid gap-3 py-3 lg:grid-cols-[1fr_1fr_auto]">
      <TradeTicketSide
        label="You send"
        players={outgoingPlayers}
        picks={outgoingPicks}
        salary={outgoingSalary}
        value={outgoingValue}
      />
      <TradeTicketSide
        label="You receive"
        players={incomingPlayers}
        picks={incomingPicks}
        salary={incomingSalary}
        value={incomingValue}
      />
      <div className="grid gap-1 rounded-md border bg-muted/10 px-3 py-2 text-sm">
        <span className="text-xs text-muted-foreground">Trade status</span>
        <span className="font-medium">
          {validation
            ? validation.ok
              ? aiResponse?.ok
                ? "Ready to submit"
                : "AI response needed"
              : "League check blocked"
            : "Build package"}
        </span>
      </div>
    </CardContent>
  )
}

function TradeTicketSide({
  label,
  players,
  picks,
  salary,
  value,
}: {
  label: string
  players: number
  picks: number
  salary: number
  value: number
}) {
  const summary = packageSummary(players, picks)

  return (
    <div className="grid gap-1 rounded-md border bg-muted/10 px-3 py-2 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{summary}</span>
      {summary !== "No assets selected" ? (
        <span className="text-xs text-muted-foreground">
          {formatMoney(salary)} · value {value.toFixed(1)}
        </span>
      ) : null}
    </div>
  )
}

function AssetTableCard({
  title,
  description,
  assetTab,
  players,
  picks,
  selectedPlayerIds,
  selectedPickIds,
  seasonState,
  salary,
  disabled = false,
  onPlayerToggle,
  onPickToggle,
}: {
  title: string
  description: string
  assetTab: AssetTab
  players: Player[]
  picks: DraftPickAsset[]
  selectedPlayerIds: string[]
  selectedPickIds: string[]
  seasonState: SeasonState
  salary: (player: Player) => number
  disabled?: boolean
  onPlayerToggle: (playerId: string, checked: boolean) => void
  onPickToggle: (pickId: string, checked: boolean) => void
}) {
  const selectedCount =
    assetTab === "players" ? selectedPlayerIds.length : selectedPickIds.length

  return (
    <Card className="min-h-[520px]">
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant="outline">
            {selectedCount} selected {assetTab === "players" ? "players" : "picks"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {disabled ? (
          <div className="p-4 text-sm text-muted-foreground">
            Choose a trade partner to view their assets.
          </div>
        ) : assetTab === "players" ? (
          <PlayersAssetTable
            players={players}
            selectedIds={selectedPlayerIds}
            salary={salary}
            onToggle={onPlayerToggle}
          />
        ) : (
          <PicksAssetTable
            picks={picks}
            selectedIds={selectedPickIds}
            seasonState={seasonState}
            onToggle={onPickToggle}
          />
        )}
      </CardContent>
    </Card>
  )
}

function PlayersAssetTable({
  players,
  selectedIds,
  salary,
  onToggle,
}: {
  players: Player[]
  selectedIds: string[]
  salary: (player: Player) => number
  onToggle: (playerId: string, checked: boolean) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead>Player</TableHead>
          <TableHead>Pos</TableHead>
          <TableHead className="text-right">OVR</TableHead>
          <TableHead className="text-right">Salary</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {players.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-muted-foreground">
              No players available.
            </TableCell>
          </TableRow>
        ) : null}
        {players.map((player) => {
          const checked = selectedIds.includes(player.id)

          return (
            <TableRow key={player.id} className={checked ? "bg-muted/40" : ""}>
              <TableCell>
                <SelectionCheckbox
                  ariaLabel={`Select ${playerLabel(player)}`}
                  checked={checked}
                  onCheckedChange={(value) => onToggle(player.id, value)}
                />
              </TableCell>
              <TableCell>
                <div className="flex min-w-44 flex-col">
                  <span className="font-medium">{playerLabel(player)}</span>
                  <span className="text-xs text-muted-foreground">
                    {player.age} yrs · {formatArchetype(player.archetype)}
                  </span>
                </div>
              </TableCell>
              <TableCell>{player.position}</TableCell>
              <TableCell className="text-right tabular-nums">
                {player.ratings.overall}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(salary(player))}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function PicksAssetTable({
  picks,
  selectedIds,
  seasonState,
  onToggle,
}: {
  picks: DraftPickAsset[]
  selectedIds: string[]
  seasonState: SeasonState
  onToggle: (pickId: string, checked: boolean) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead>Pick</TableHead>
          <TableHead>Round</TableHead>
          <TableHead>Original team</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {picks.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-muted-foreground">
              No picks available.
            </TableCell>
          </TableRow>
        ) : null}
        {picks.map((pick) => {
          const checked = selectedIds.includes(pick.id)

          return (
            <TableRow key={pick.id} className={checked ? "bg-muted/40" : ""}>
              <TableCell>
                <SelectionCheckbox
                  ariaLabel={`Select ${pickLabel(pick, seasonState)}`}
                  checked={checked}
                  onCheckedChange={(value) => onToggle(pick.id, value)}
                />
              </TableCell>
              <TableCell className="font-medium">
                Season {pick.season}
              </TableCell>
              <TableCell>{pick.round === 1 ? "1st" : "2nd"}</TableCell>
              <TableCell>
                {teamName(seasonState, pick.originalTeamId)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function TradeStatusPanel({
  validation,
  aiResponse,
  targetEvaluation,
  outgoingSalary,
  incomingSalary,
  message,
}: {
  validation: TradeValidationResult | null
  aiResponse: TradeValidationResult | null
  targetEvaluation: TradeEvaluation | undefined
  outgoingSalary: number
  incomingSalary: number
  message: string | null
}) {
  const statusText = validation
    ? validation.ok
      ? aiResponse?.ok
        ? "Trade can be submitted."
        : (aiResponse?.reason ?? "Waiting on AI response.")
      : validation.reason
    : "Select assets to run trade checks."

  return (
    <Card className="min-h-[520px]">
      <CardHeader className="border-b">
        <CardTitle>Status</CardTitle>
        <CardDescription>{statusText}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 py-4">
        <InfoRow label="Outgoing salary" value={formatMoney(outgoingSalary)} />
        <InfoRow label="Incoming salary" value={formatMoney(incomingSalary)} />
        <InfoRow
          label="Salary delta"
          value={formatMoney(incomingSalary - outgoingSalary)}
        />
        <CheckMetric
          label="League check"
          value={validation ? (validation.ok ? "Clear" : "Blocked") : "Idle"}
          ok={validation?.ok ?? null}
        />
        <CheckMetric
          label="AI response"
          value={aiResponse ? (aiResponse.ok ? "Accepts" : "Rejects") : "Idle"}
          ok={aiResponse?.ok ?? null}
        />
        {targetEvaluation ? (
          <AiAcceptThresholdBar netValue={targetEvaluation.netValue} />
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

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={
        active
          ? "inline-flex h-7 items-center gap-2 rounded-sm bg-background px-2 text-xs font-medium"
          : "inline-flex h-7 items-center gap-2 rounded-sm px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
      }
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function PackageLine({
  label,
  players,
  picks,
}: {
  label: string
  players: number
  picks: number
}) {
  return (
    <div className="rounded-md border bg-muted/10 px-3 py-2">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">
        {packageSummary(players, picks)}
      </span>
    </div>
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

function SelectionCheckbox({
  ariaLabel,
  checked,
  onCheckedChange,
}: {
  ariaLabel: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const ref = useRef<HTMLInputElement>(null)

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={ariaLabel}
      checked={checked}
      onChange={(event) => onCheckedChange(event.target.checked)}
      className="size-3.5 rounded-sm border border-border accent-primary focus-visible:ring-2 focus-visible:ring-ring/40"
    />
  )
}

function getAssetValueTotal({
  players,
  picks,
  mode,
  teamId,
  league,
  seasonFinancials,
}: {
  players: Player[]
  picks: DraftPickAsset[]
  mode: TeamMode
  teamId: string
  league: NonNullable<ReturnType<typeof useLeagueContext>["league"]>
  seasonFinancials: ReturnType<typeof getSeasonFinancials>
}): number {
  return (
    players.reduce((total, player) => {
      const contract = getPlayerContract(league.contracts, player)
      return (
        total +
        getContractAssetValueBreakdown({
          player,
          contract,
          expectedSalary: getFairSalary(player, seasonFinancials, league),
          mode,
        }).total
      )
    }, 0) +
    picks.reduce(
      (total, pick) =>
        total +
        getPickValueFromCache(pick, league.draftClassCache, league, teamId, mode),
      0,
    )
  )
}

function packageSummary(players: number, picks: number): string {
  const parts: string[] = []
  if (players > 0) {
    parts.push(`${players} player${players === 1 ? "" : "s"}`)
  }
  if (picks > 0) {
    parts.push(`${picks} pick${picks === 1 ? "" : "s"}`)
  }
  return parts.length > 0 ? parts.join(", ") : "No assets selected"
}

function playerLabel(player: Player): string {
  return `${player.firstName} ${player.lastName}`
}

function pickLabel(pick: DraftPickAsset, seasonState: SeasonState): string {
  return `${pick.season} ${pick.round === 1 ? "1st" : "2nd"} from ${teamName(
    seasonState,
    pick.originalTeamId,
  )}`
}

function formatArchetype(value: string | undefined): string {
  if (!value) {
    return "role unknown"
  }
  return value.replaceAll("_", " ")
}

function toggleId(values: string[], value: string, checked: boolean): string[] {
  if (checked) {
    return values.includes(value) ? values : [...values, value]
  }
  return values.filter((entry) => entry !== value)
}

function sumSalary(
  players: Player[],
  salary: (player: Player) => number,
): number {
  return players.reduce((total, player) => total + salary(player), 0)
}
