import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useMemo, useRef, useState } from "react"

import { formatMoney } from "@/components/league/lib/moneyFormat"
import { getScoutedPlayer } from "@/components/league/lib/scouting"
import { teamName } from "@/components/league/lib/teamFormat"
import { useLeagueContext } from "@/contexts/LeagueContext"
import type {
  DraftPickAsset,
  PendingTradeOffer,
  Player,
  PlayerSeasonStats,
  SeasonState,
  TeamMode,
  TradeProposal,
  TradeValidationResult,
} from "@workspace/shared/types"
import {
  getCurrentSalary,
  getPickValueFromCache,
  getPlayerContract,
  getPlayerDecisionValueBreakdown,
  getYearsRemaining,
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
  const scoutingOptions = {
    teamScoutingLevel:
      activeLeague.teamFinancials.find((entry) => entry.teamId === userTeamId)
        ?.scoutingLevel ?? 5,
    leagueSeed: seasonState.baseSeed,
    viewerTeamId: userTeamId,
  }
  const scoutedOutgoingPlayers = outgoingPlayers.map((player) =>
    getScoutedPlayer(player, { ...scoutingOptions, isOwnRoster: true }),
  )
  const scoutedIncomingPlayers = incomingPlayers.map((player) =>
    getScoutedPlayer(player, scoutingOptions),
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
  const canExecute = Boolean(validation?.ok && aiResponse?.ok)
  const outgoingValue = getAssetValueTotal({
      players: scoutedOutgoingPlayers,
      picks: outgoingPicks,
      mode: "buying",
      teamId: userTeamId,
      viewerTeamId: userTeamId,
      league: activeLeague,
    })
  const incomingValue = getAssetValueTotal({
      players: scoutedIncomingPlayers,
      picks: incomingPicks,
      mode: targetMode,
      teamId: userTeamId,
      viewerTeamId: userTeamId,
      league: activeLeague,
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
          league={league}
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
                viewPlayer={(player) =>
                  getScoutedPlayer(player, { ...scoutingOptions, isOwnRoster: true })
                }
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
                viewPlayer={(player) => getScoutedPlayer(player, scoutingOptions)}
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
              selectedPlayers={[
                ...scoutedOutgoingPlayers.map((player) => ({
                  player,
                  label: "You send",
                })),
                ...scoutedIncomingPlayers.map((player) => ({
                  player,
                  label: "You receive",
                })),
              ]}
              league={activeLeague}
              userTeamId={userTeamId}
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
  league,
  seasonState,
  userTeamId,
  offers,
  onAccept,
  onReject,
}: {
  league: NonNullable<ReturnType<typeof useLeagueContext>["league"]>
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
          const sendAssets = tradeSideAssets({
            side: youSend,
            league,
            seasonState,
            viewerTeamId: userTeamId,
          })
          const receiveAssets = tradeSideAssets({
            side: youReceive,
            league,
            seasonState,
            viewerTeamId: userTeamId,
          })
          const userValue =
            receiveAssets.reduce((total, asset) => total + asset.value, 0) -
            sendAssets.reduce((total, asset) => total + asset.value, 0)

          return (
            <div
              key={offer.id}
              className="grid gap-4 rounded-lg border bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-medium">
                    {teamName(seasonState, offer.initiatorTeamId)} proposed a trade
                  </h2>
                  <Badge variant="outline">Expires day {offer.expiresDay}</Badge>
                  <Badge variant={userValue >= 0 ? "secondary" : "destructive"}>
                    Your value {signedNumber(userValue)}
                  </Badge>
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

              <div className="grid gap-3 xl:grid-cols-2">
                <OfferAssetSection title="You send" assets={sendAssets} />
                <OfferAssetSection title="You receive" assets={receiveAssets} />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function OfferAssetSection({
  title,
  assets,
}: {
  title: string
  assets: OfferAsset[]
}) {
  const totalValue = assets.reduce((total, asset) => total + asset.value, 0)

  return (
    <div className="rounded-lg border bg-muted/10">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
        <div>
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground">
            {packageSummary(
              assets.filter((asset) => asset.kind === "player").length,
              assets.filter((asset) => asset.kind === "pick").length,
            )}
          </p>
        </div>
        <span className="text-xs font-medium tabular-nums">
          value {totalValue.toFixed(1)}
        </span>
      </div>
      <div className="divide-y">
        {assets.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">
            No assets included.
          </p>
        ) : null}
        {assets.map((asset) => (
          <div
            key={asset.id}
            className="grid gap-2 px-3 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{asset.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {asset.subtitle}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:text-right">
              {asset.metrics.map((metric) => (
                <div key={metric.label}>
                  <span className="text-muted-foreground">{metric.label}</span>
                  <span className="ml-1 font-medium tabular-nums text-foreground">
                    {metric.value}
                  </span>
                </div>
              ))}
              <div>
                <span className="text-muted-foreground">Value</span>
                <span className="ml-1 font-medium tabular-nums text-foreground">
                  {asset.value.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
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
  viewPlayer,
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
  viewPlayer: (player: Player) => Player
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
            viewPlayer={viewPlayer}
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
  viewPlayer,
  onToggle,
}: {
  players: Player[]
  selectedIds: string[]
  salary: (player: Player) => number
  viewPlayer: (player: Player) => Player
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
          const view = viewPlayer(player)

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
                {view.ratings.overall}
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
  selectedPlayers,
  league,
  userTeamId,
  outgoingSalary,
  incomingSalary,
  message,
}: {
  validation: TradeValidationResult | null
  aiResponse: TradeValidationResult | null
  selectedPlayers: Array<{ player: Player; label: string }>
  league: NonNullable<ReturnType<typeof useLeagueContext>["league"]>
  userTeamId: string
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
        {selectedPlayers.length > 0 ? (
          <div className="border-t pt-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Your scouted value
            </p>
            <div className="grid gap-3">
              {selectedPlayers.map(({ player, label }) => (
                <TradePlayerValueBreakdown
                  key={`${label}-${player.id}`}
                  label={label}
                  player={player}
                  breakdown={getPlayerDecisionValueBreakdown({
                    league,
                    player,
                    receivingTeamId: userTeamId,
                  })}
                />
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

function TradePlayerValueBreakdown({
  label,
  player,
  breakdown,
}: {
  label: string
  player: Player
  breakdown: ReturnType<typeof getPlayerDecisionValueBreakdown>
}) {
  const values = [
    ["Talent", breakdown.talent],
    ["Age", breakdown.ageCurve],
    ["Durability", breakdown.durability],
    ["Contract", breakdown.contract],
    ["Scarcity", breakdown.scarcity],
    ["Production", breakdown.production],
  ] as const

  return (
    <div className="rounded-md border bg-muted/10 px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs font-medium">
          {label} · {playerLabel(player)}
        </span>
        <span className="text-xs font-medium tabular-nums">
          {breakdown.total.toFixed(1)}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {values.map(([name, value]) => (
          <span key={name} className="flex justify-between gap-2">
            <span className="text-muted-foreground">{name}</span>
            <span className="tabular-nums">
              {value >= 0 ? "+" : ""}{value.toFixed(1)}
            </span>
          </span>
        ))}
      </div>
    </div>
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

type OfferAsset = {
  id: string
  kind: "player" | "pick"
  title: string
  subtitle: string
  metrics: Array<{ label: string; value: string }>
  value: number
}

function tradeSideAssets({
  side,
  league,
  seasonState,
  viewerTeamId,
}: {
  side: TradeProposal["from"]
  league: NonNullable<ReturnType<typeof useLeagueContext>["league"]>
  seasonState: SeasonState
  viewerTeamId: string
}): OfferAsset[] {
  const team = seasonState.teams.find((entry) => entry.id === side.teamId)
  const mode =
    league.teamFinancials.find((entry) => entry.teamId === side.teamId)
      ?.strategy.mode ?? "buying"

  if (!team) {
    return []
  }

  const playerStats = new Map(
    seasonState.playerSeasonStats.map((stats) => [stats.playerId, stats]),
  )
  const playerAssets = side.playerIds.flatMap((playerId) => {
    const player = team.players.find((entry) => entry.id === playerId)
    if (!player) {
      return []
    }

    const contract = getPlayerContract(league.contracts, player)
    const view = getScoutedPlayer(player, {
      isOwnRoster: player.teamId === viewerTeamId,
      teamScoutingLevel:
        league.teamFinancials.find((entry) => entry.teamId === viewerTeamId)
          ?.scoutingLevel ?? 5,
      leagueSeed: league.seasonState.baseSeed,
      viewerTeamId,
    })
    const value = getPlayerDecisionValueBreakdown({
      league,
      player: view,
      receivingTeamId: viewerTeamId,
      contract,
    }).total
    const stats = playerStats.get(player.id)

    return [
      {
        id: player.id,
        kind: "player" as const,
        title: playerLabel(player),
        subtitle: `${player.position} · ${player.age} yrs · ${formatArchetype(
          player.archetype,
        )}`,
        metrics: [
          { label: "OVR", value: String(view.ratings.overall) },
          { label: "PTS", value: statAverage(stats, "pts") },
          { label: "REB", value: statAverage(stats, "reb") },
          { label: "AST", value: statAverage(stats, "ast") },
          { label: "Salary", value: formatMoney(getCurrentSalary(contract)) },
          { label: "Yrs", value: String(getYearsRemaining(contract)) },
        ],
        value,
      },
    ]
  })

  const pickAssets = (side.pickIds ?? []).flatMap((pickId) => {
    const pick = league.draftPickAssets.find((entry) => entry.id === pickId)
    if (!pick) {
      return []
    }

    return [
      {
        id: pick.id,
        kind: "pick" as const,
        title: pick.round === 1 ? "1st round pick" : "2nd round pick",
        subtitle: `Season ${pick.season} · from ${teamName(
          seasonState,
          pick.originalTeamId,
        )}`,
        metrics: [
          { label: "Round", value: pick.round === 1 ? "1st" : "2nd" },
          { label: "Season", value: String(pick.season) },
        ],
        value: getPickValueFromCache(
          pick,
          league.draftClassCache,
          league,
          viewerTeamId,
          mode,
        ),
      },
    ]
  })

  return [...playerAssets, ...pickAssets]
}

function getAssetValueTotal({
  players,
  picks,
  mode,
  teamId,
  viewerTeamId,
  league,
}: {
  players: Player[]
  picks: DraftPickAsset[]
  mode: TeamMode
  teamId: string
  viewerTeamId: string
  league: NonNullable<ReturnType<typeof useLeagueContext>["league"]>
}): number {
  return (
    players.reduce((total, player) => {
      return (
        total +
        getPlayerDecisionValueBreakdown({
          league,
          player,
          receivingTeamId: viewerTeamId,
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

function statAverage(
  stats: PlayerSeasonStats | undefined,
  key: "pts" | "reb" | "ast",
): string {
  if (!stats || stats.gp <= 0) {
    return "-"
  }
  return (stats[key] / stats.gp).toFixed(1)
}

function signedNumber(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`
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
