import { createFileRoute } from "@tanstack/react-router"
import { useMemo, useState } from "react"

import type {
  DraftPickAsset,
  Player,
  SeasonState,
  TradeHistoryEntry,
  TradeProposal,
} from "@workspace/shared/types"
import {
  evaluateTrade,
  getCurrentSalary,
  getPlayerContract,
  validateTrade,
  wouldAiAcceptTrade,
} from "@workspace/sim"

import { teamName } from "@/components/league/lib/teamFormat"
import { formatMoney } from "@/components/league/lib/moneyFormat"
import { useLeagueContext } from "@/contexts/LeagueContext"
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

export const Route = createFileRoute("/league/trades")({
  component: LeagueTradesPage,
})

const NONE = "none"

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

function LeagueTradesPage() {
  const { league, seasonState, userTeamId, myTeam, executeTrade } =
    useLeagueContext()
  const [targetTeamId, setTargetTeamId] = useState<string>("")
  const [outgoingPlayerId, setOutgoingPlayerId] = useState<string>(NONE)
  const [incomingPlayerId, setIncomingPlayerId] = useState<string>(NONE)
  const [outgoingPickId, setOutgoingPickId] = useState<string>(NONE)
  const [incomingPickId, setIncomingPickId] = useState<string>(NONE)
  const [message, setMessage] = useState<string | null>(null)

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

    const outgoingPlayerIds =
      outgoingPlayerId === NONE ? [] : [outgoingPlayerId]
    const incomingPlayerIds =
      incomingPlayerId === NONE ? [] : [incomingPlayerId]
    const outgoingPickIds = outgoingPickId === NONE ? [] : [outgoingPickId]
    const incomingPickIds = incomingPickId === NONE ? [] : [incomingPickId]

    if (
      outgoingPlayerIds.length +
        incomingPlayerIds.length +
        outgoingPickIds.length +
        incomingPickIds.length ===
      0
    ) {
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
    incomingPickId,
    incomingPlayerId,
    outgoingPickId,
    outgoingPlayerId,
    targetTeamId,
    userTeamId,
  ])

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

  function salary(player: Player): number {
    return getCurrentSalary(getPlayerContract(league!.contracts, player))
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Trade machine</CardTitle>
          <CardDescription>
            Build a player and pick offer and send it through cap, roster, and
            AI value checks.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm">
            Trade partner
            <Select
              value={targetTeamId}
              onValueChange={(value) => {
                setTargetTeamId(value)
                setIncomingPlayerId(NONE)
                setIncomingPickId(NONE)
                setMessage(null)
              }}
            >
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

          <label className="flex flex-col gap-2 text-sm">
            You send
            <Select
              value={outgoingPlayerId}
              onValueChange={(value) => {
                setOutgoingPlayerId(value)
                setMessage(null)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select player" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No player</SelectItem>
                {myTeam.players.map((player) => (
                  <SelectItem key={player.id} value={player.id}>
                    {playerLabel(player)} · {player.ratings.overall} OVR ·{" "}
                    {formatMoney(salary(player))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="flex flex-col gap-2 text-sm">
            You receive
            <Select
              value={incomingPlayerId}
              onValueChange={(value) => {
                setIncomingPlayerId(value)
                setMessage(null)
              }}
              disabled={!targetTeam}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select player" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No player</SelectItem>
                {targetTeam?.players.map((player) => (
                  <SelectItem key={player.id} value={player.id}>
                    {playerLabel(player)} · {player.ratings.overall} OVR ·{" "}
                    {formatMoney(salary(player))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="flex flex-col gap-2 text-sm">
            Your pick
            <Select
              value={outgoingPickId}
              onValueChange={(value) => {
                setOutgoingPickId(value)
                setMessage(null)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select pick" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No pick</SelectItem>
                {userPicks.map((pick) => (
                  <SelectItem key={pick.id} value={pick.id}>
                    {pickLabel(pick, seasonState)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="flex flex-col gap-2 text-sm">
            Their pick
            <Select
              value={incomingPickId}
              onValueChange={(value) => {
                setIncomingPickId(value)
                setMessage(null)
              }}
              disabled={!targetTeam}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select pick" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No pick</SelectItem>
                {targetPicks.map((pick) => (
                  <SelectItem key={pick.id} value={pick.id}>
                    {pickLabel(pick, seasonState)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </CardContent>
      </Card>

      {proposal ? (
        <Card>
          <CardHeader>
            <CardTitle>Trade check</CardTitle>
            <CardDescription>
              {validation?.ok
                ? aiResponse?.ok
                  ? "The other team is willing to accept."
                  : aiResponse?.reason
                : validation?.reason}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead>Incoming value</TableHead>
                  <TableHead>Outgoing value</TableHead>
                  <TableHead>Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluations.map((entry) => (
                  <TableRow key={entry.teamId}>
                    <TableCell>{teamName(seasonState, entry.teamId)}</TableCell>
                    <TableCell>{entry.incomingValue.toFixed(1)}</TableCell>
                    <TableCell>{entry.outgoingValue.toFixed(1)}</TableCell>
                    <TableCell>{entry.netValue.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {message ? (
              <p className="text-sm text-muted-foreground">{message}</p>
            ) : null}

            <Button
              disabled={!canExecute}
              onClick={() => {
                executeTrade(proposal)
                setOutgoingPlayerId(NONE)
                setIncomingPlayerId(NONE)
                setOutgoingPickId(NONE)
                setIncomingPickId(NONE)
                setMessage("Trade completed.")
              }}
            >
              Complete trade
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Trade history</CardTitle>
          <CardDescription>
            Completed trades are recorded with assets, salary, and value
            snapshots.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              {league.tradeHistory.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-sm text-muted-foreground"
                  >
                    No trades completed yet.
                  </TableCell>
                </TableRow>
              ) : null}
              {[...league.tradeHistory]
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
    </div>
  )
}
