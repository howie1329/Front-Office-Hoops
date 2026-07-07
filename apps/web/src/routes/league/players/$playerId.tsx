import { Link, createFileRoute } from "@tanstack/react-router"
import { useMemo, useState } from "react"

import { playerName } from "@/components/box-score/playerName"
import { formatMoney } from "@/components/league/lib/moneyFormat"
import { teamAbbrev, teamName } from "@/components/league/lib/teamFormat"
import { useLeagueContext } from "@/contexts/LeagueContext"
import {
  canSignPlayer,
  getCurrentSalary,
  getExternalFreeAgents,
  getPlayerContract,
  getTeamExpiredFreeAgents,
  getYearsRemaining,
} from "@workspace/sim"
import type {
  FreeAgentOffer,
  LeagueLogEntry,
  Player,
  PlayerCareerSnapshot,
  PlayerDevelopmentRecord,
  PlayerRatings,
  PlayerSeasonStats,
  SeasonAward,
} from "@workspace/shared/types"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DISPLAY_SKILL_KEYS,
  getTeamScoutingLevel,
  getViewRatings,
  skillLabel,
} from "@/components/league/lib/scouting"
import {
  getNextContractOptionLabel,
  getTradableRestrictionLabel,
} from "@/components/league/lib/contractLabels"
import { getPlayerMoodHints } from "@/components/league/lib/moodHints"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

export const Route = createFileRoute("/league/players/$playerId")({
  component: PlayerProfilePage,
})

function PlayerProfilePage() {
  const { playerId } = Route.useParams()
  const {
    league,
    seasonState,
    userTeamId,
    isOffseason,
    offseasonPhase,
    releasePlayer,
    signFreeAgent,
  } = useLeagueContext()
  const [offerOpen, setOfferOpen] = useState(false)
  const [offerYears, setOfferYears] = useState(2)
  const [offerSalary, setOfferSalary] = useState(5)

  const allPlayers = useMemo(() => {
    if (!league || !seasonState) {
      return []
    }
    return [
      ...seasonState.teams.flatMap((team) => team.players),
      ...league.freeAgentPool,
    ]
  }, [league, seasonState])

  if (!league || !seasonState) {
    return null
  }

  const player = allPlayers.find((entry) => entry.id === playerId)
  const playerTeam = player?.teamId
    ? seasonState.teams.find((team) => team.id === player.teamId)
    : null
  const contract = player
    ? getPlayerContract(league.contracts, player)
    : undefined
  const currentStats =
    seasonState.playerSeasonStats.find(
      (entry) => entry.playerId === playerId
    ) ?? null
  const snapshots = league.playerCareerSnapshots
    .filter((entry) => entry.playerId === playerId)
    .sort((a, b) => a.season - b.season)
  const lastDevelopment = (league.playerDevelopmentRecords ?? [])
    .filter((entry) => entry.playerId === playerId && !entry.retired)
    .sort((a, b) => b.season - a.season)[0]
  const awards = league.seasonAwards.filter(
    (entry) => entry.playerId === playerId
  )
  const transactions = league.leagueLog
    .filter((entry) => entry.playerId === playerId)
    .slice()
    .reverse()

  if (!player && snapshots.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Player not found</CardTitle>
          <CardDescription>
            This player is not in the current league.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const reSignFreeAgents = userTeamId
    ? getTeamExpiredFreeAgents(league, userTeamId)
    : []
  const externalFreeAgents = userTeamId
    ? getExternalFreeAgents(league, userTeamId)
    : []
  const isMyRosterPlayer = Boolean(
    player && userTeamId && player.teamId === userTeamId
  )
  const isFreeAgent = Boolean(player && player.teamId === null)
  const isReSignCandidate = Boolean(
    player && reSignFreeAgents.some((entry) => entry.id === player.id)
  )
  const isExternalFreeAgent = Boolean(
    player && externalFreeAgents.some((entry) => entry.id === player.id)
  )
  const canOpenOffer = Boolean(
    player &&
    userTeamId &&
    isFreeAgent &&
    ((offseasonPhase === "re_signing" && isReSignCandidate) ||
      (offseasonPhase === "free_agency" && isExternalFreeAgent))
  )
  const offer: FreeAgentOffer = {
    years: offerYears,
    firstYearSalary: offerSalary,
  }
  const signValidation =
    player && userTeamId && canOpenOffer
      ? canSignPlayer(league, userTeamId, player.id, offer)
      : null
  const yearsRemaining = getYearsRemaining(contract)
  const decision = player
    ? buildDecisionSummary({
        player,
        currentStats,
        yearsRemaining,
        isMyRosterPlayer,
        isFreeAgent,
        isOffseason,
        offseasonPhase,
      })
    : null
  const teamFinance = userTeamId
    ? league.teamFinancials.find((entry) => entry.teamId === userTeamId)
    : undefined
  const viewRatings =
    player && teamFinance
      ? getViewRatings(player.ratings, {
          isOwnRoster: isMyRosterPlayer,
          teamScoutingLevel: getTeamScoutingLevel(teamFinance),
        })
      : null
  const scoutingNote = isMyRosterPlayer
    ? "Exact ratings for your roster."
    : "Scouted ratings — precision depends on your scouting budget."
  const moodHints =
    player && teamFinance
      ? getPlayerMoodHints(player.mood, {
          isOwnRoster: isMyRosterPlayer,
          teamScoutingLevel: getTeamScoutingLevel(teamFinance),
        })
      : null
  const optionLabel = getNextContractOptionLabel(contract, yearsRemaining)
  const tradableLabel = getTradableRestrictionLabel(
    contract,
    seasonState.currentDay,
  )

  return (
    <div className="-m-px flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-px">
      <PlayerHeader
        player={player}
        viewRatings={viewRatings}
        name={player ? playerName(allPlayers, player.id) : playerId}
        teamLabel={
          playerTeam
            ? `${playerTeam.name} · ${playerTeam.abbrev}`
            : player
              ? "Free agent"
              : "Archived player"
        }
        contractLabel={contractSummary(contract, yearsRemaining)}
        currentStats={currentStats}
        decision={decision}
        isMyRosterPlayer={isMyRosterPlayer}
        isFreeAgent={isFreeAgent}
        canOpenOffer={canOpenOffer}
        onOpenOffer={() => {
          if (player) {
            setOfferSalary(Math.max(2, Math.round(player.ratings.overall / 8)))
          }
          setOfferOpen(true)
        }}
        onRelease={() => player && releasePlayer(player.id)}
      />

      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {player ? (
            <RatingsCard
              player={player}
              viewRatings={viewRatings ?? player.ratings}
              scoutingNote={scoutingNote}
              decision={decision}
            />
          ) : null}
          <CurrentProductionCard
            currentStats={currentStats}
            season={seasonState.season}
          />
          <CareerTable
            seasonState={seasonState}
            snapshots={snapshots}
            awards={awards}
            player={player}
            currentStats={currentStats}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {player ? (
            <ContractCard
              player={player}
              contractSalary={getCurrentSalary(contract)}
              yearsRemaining={yearsRemaining}
              contractLabel={contractSummary(contract, yearsRemaining)}
              optionLabel={optionLabel}
              tradableLabel={tradableLabel}
              draftInfoLabel={draftLabel(player)}
              teamLabel={
                player.teamId ? teamName(seasonState, player.teamId) : "None"
              }
            />
          ) : null}
          {player ? (
            <PlayerMoodCard hints={moodHints} scoutingNote={scoutingNote} />
          ) : null}
          {player && lastDevelopment ? (
            <LastDevelopmentCard record={lastDevelopment} />
          ) : null}
          <TimelineCard awards={awards} transactions={transactions} />
        </div>
      </div>

      {player && userTeamId ? (
        <OfferDialog
          open={offerOpen}
          onOpenChange={setOfferOpen}
          player={player}
          mode={isReSignCandidate ? "re_sign" : "external"}
          years={offerYears}
          salary={offerSalary}
          validation={signValidation}
          onYearsChange={setOfferYears}
          onSalaryChange={setOfferSalary}
          onSubmit={() => {
            if (!signValidation?.ok) {
              return
            }
            signFreeAgent(player.id, offer)
            setOfferOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

type PlayerHeaderProps = {
  player: Player | undefined
  viewRatings: PlayerRatings | null
  name: string
  teamLabel: string
  contractLabel: string
  currentStats: PlayerSeasonStats | null
  decision: PlayerDecision | null
  isMyRosterPlayer: boolean
  isFreeAgent: boolean
  canOpenOffer: boolean
  onOpenOffer: () => void
  onRelease: () => void
}

function PlayerHeader({
  player,
  viewRatings,
  name,
  teamLabel,
  contractLabel,
  currentStats,
  decision,
  isMyRosterPlayer,
  isFreeAgent,
  canOpenOffer,
  onOpenOffer,
  onRelease,
}: PlayerHeaderProps) {
  const tradeSearch = player
    ? isMyRosterPlayer
      ? { outgoingPlayerId: player.id }
      : player.teamId
        ? { incomingPlayerId: player.id, targetTeamId: player.teamId }
        : undefined
    : undefined

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">{name}</CardTitle>
              {player ? (
                <>
                  <Badge>{player.position}</Badge>
                  <Badge>{archetypeLabel(player.archetype)}</Badge>
                  <Badge>{statusLabel(player)}</Badge>
                </>
              ) : null}
            </div>
            <CardDescription className="mt-1">
              {teamLabel} · {player ? `${player.age} years old` : "Archived"} ·{" "}
              {contractLabel}
            </CardDescription>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[520px]">
            <Metric
              label="Overall"
              value={viewRatings?.overall ?? player?.ratings.overall ?? "-"}
            />
            <Metric
              label="Potential"
              value={viewRatings?.potential ?? player?.ratings.potential ?? "-"}
            />
            <Metric
              label="Season line"
              value={currentStats ? statLine(currentStats) : "No games"}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <p className="text-sm font-medium">{decision?.headline}</p>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {decision?.detail ??
              "Archived player profile. Current roster actions are unavailable."}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2 lg:justify-end">
          {player && !isFreeAgent ? (
            <Button asChild variant="outline">
              <Link to="/league/trades" search={tradeSearch}>
                Trade
              </Link>
            </Button>
          ) : null}
          {player && isMyRosterPlayer ? (
            <Button variant="destructive" onClick={onRelease}>
              Release
            </Button>
          ) : null}
          {player && isFreeAgent ? (
            <Button disabled={!canOpenOffer} onClick={onOpenOffer}>
              {canOpenOffer ? "Open offer" : "Unavailable"}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function RatingsCard({
  player,
  viewRatings,
  scoutingNote,
  decision,
}: {
  player: Player
  viewRatings: PlayerRatings
  scoutingNote: string
  decision: PlayerDecision | null
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Scouting profile</CardTitle>
        <CardDescription>{scoutingNote}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 py-4 lg:grid-cols-[1fr_280px]">
        <div className="grid gap-3 sm:grid-cols-2">
          {DISPLAY_SKILL_KEYS.map((key) => (
            <RatingBar
              key={key}
              label={skillLabel(key)}
              value={viewRatings[key]}
            />
          ))}
          <RatingBar label="Usage" value={viewRatings.usage} />
          <RatingBar label="Development gap" value={developmentGap(player)} />
        </div>
        <div className="rounded-md border bg-muted/20 p-3">
          <p className="font-medium">Decision read</p>
          <div className="mt-3 grid gap-2">
            {decision?.points.map((point) => (
              <div key={point.label} className="flex justify-between gap-3">
                <span className="text-muted-foreground">{point.label}</span>
                <span className="text-right font-medium">{point.value}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CurrentProductionCard({
  currentStats,
  season,
}: {
  currentStats: PlayerSeasonStats | null
  season: number
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Current season</CardTitle>
        <CardDescription>Season {season} production snapshot.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto py-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>GP</TableHead>
              <TableHead>GS</TableHead>
              <TableHead>MIN</TableHead>
              <TableHead>PTS</TableHead>
              <TableHead>REB</TableHead>
              <TableHead>AST</TableHead>
              <TableHead>STL</TableHead>
              <TableHead>BLK</TableHead>
              <TableHead>TOV</TableHead>
              <TableHead>FG</TableHead>
              <TableHead>3PT</TableHead>
              <TableHead>FT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentStats ? (
              <TableRow>
                <TableCell>{currentStats.gp}</TableCell>
                <TableCell>{currentStats.gs}</TableCell>
                <TableCell>{currentStats.min}</TableCell>
                <TableCell>{currentStats.pts}</TableCell>
                <TableCell>{currentStats.reb}</TableCell>
                <TableCell>{currentStats.ast}</TableCell>
                <TableCell>{currentStats.stl}</TableCell>
                <TableCell>{currentStats.blk}</TableCell>
                <TableCell>{currentStats.tov}</TableCell>
                <TableCell>
                  {currentStats.fgm}-{currentStats.fga}
                </TableCell>
                <TableCell>
                  {currentStats.tpm}-{currentStats.tpa}
                </TableCell>
                <TableCell>
                  {currentStats.ftm}-{currentStats.fta}
                </TableCell>
              </TableRow>
            ) : (
              <TableRow>
                <TableCell colSpan={12} className="text-muted-foreground">
                  No completed games for this player yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function CareerTable({
  seasonState,
  snapshots,
  awards,
  player,
  currentStats,
}: {
  seasonState: Parameters<typeof teamAbbrev>[0]
  snapshots: PlayerCareerSnapshot[]
  awards: SeasonAward[]
  player: Player | undefined
  currentStats: PlayerSeasonStats | null
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Career record</CardTitle>
        <CardDescription>
          Archived seasons plus the active season when available.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto py-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Season</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>OVR</TableHead>
              <TableHead>POT</TableHead>
              <TableHead>GP</TableHead>
              <TableHead>GS</TableHead>
              <TableHead>PTS</TableHead>
              <TableHead>REB</TableHead>
              <TableHead>AST</TableHead>
              <TableHead>Awards</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {player && currentStats ? (
              <TableRow>
                <TableCell>{currentStats.season}</TableCell>
                <TableCell>
                  {player.teamId
                    ? teamAbbrev(seasonState, player.teamId)
                    : "FA"}
                </TableCell>
                <TableCell>{player.age}</TableCell>
                <TableCell>{player.ratings.overall}</TableCell>
                <TableCell>{player.ratings.potential}</TableCell>
                <TableCell>{currentStats.gp}</TableCell>
                <TableCell>{currentStats.gs}</TableCell>
                <TableCell>{currentStats.pts}</TableCell>
                <TableCell>{currentStats.reb}</TableCell>
                <TableCell>{currentStats.ast}</TableCell>
                <TableCell>
                  {awards
                    .filter((award) => award.season === currentStats.season)
                    .map((award) => awardLabel(award.type))
                    .join(", ") || "-"}
                </TableCell>
              </TableRow>
            ) : null}
            {snapshots.length === 0 && !currentStats ? (
              <TableRow>
                <TableCell colSpan={11} className="text-muted-foreground">
                  Career snapshots are archived at season end.
                </TableCell>
              </TableRow>
            ) : null}
            {snapshots.map((snapshot) => (
              <TableRow key={snapshot.id}>
                <TableCell>{snapshot.season}</TableCell>
                <TableCell>
                  {teamAbbrev(seasonState, snapshot.teamId)}
                </TableCell>
                <TableCell>{snapshot.age}</TableCell>
                <TableCell>{snapshot.overall}</TableCell>
                <TableCell>{snapshot.potential}</TableCell>
                <TableCell>{snapshot.gp}</TableCell>
                <TableCell>{snapshot.gs}</TableCell>
                <TableCell>{snapshot.pts}</TableCell>
                <TableCell>{snapshot.reb}</TableCell>
                <TableCell>{snapshot.ast}</TableCell>
                <TableCell>
                  {snapshot.awards.map(awardLabel).join(", ") || "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function LastDevelopmentCard({ record }: { record: PlayerDevelopmentRecord }) {
  const overallDelta = record.overallAfter - record.overallBefore
  const potentialDelta = record.potentialAfter - record.potentialBefore
  const deltaLabel =
    overallDelta > 0 ? `+${overallDelta}` : overallDelta.toString()

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Last progression</CardTitle>
        <CardDescription>
          Season {record.season} preseason · Age {record.ageBefore} →{" "}
          {record.ageAfter}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 py-4 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Overall</span>
          <span className="font-medium">
            {record.overallBefore} → {record.overallAfter} ({deltaLabel})
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Potential</span>
          <span className="font-medium">
            {record.potentialBefore} → {record.potentialAfter}
            {potentialDelta !== 0
              ? ` (${potentialDelta > 0 ? "+" : ""}${potentialDelta})`
              : ""}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Momentum</span>
          <span className="font-medium">
            {record.momentumApplied >= 0 ? "+" : ""}
            {record.momentumApplied.toFixed(2)}
          </span>
        </div>
        {record.modifierIds.length > 0 ? (
          <div>
            <p className="text-muted-foreground">Modifiers</p>
            <ul className="mt-1 list-inside list-disc">
              {record.modifierIds.map((id) => (
                <li key={id}>{formatDevelopmentReason(id)}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {record.events.length > 0 ? (
          <div>
            <p className="text-muted-foreground">Events</p>
            <ul className="mt-1 list-inside list-disc">
              {record.events.map((event) => (
                <li key={event}>{formatDevelopmentReason(event)}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function formatDevelopmentReason(code: string): string {
  return code
    .replaceAll(":", " · ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function ContractCard({
  player,
  contractSalary,
  yearsRemaining,
  contractLabel,
  optionLabel,
  tradableLabel,
  draftInfoLabel,
  teamLabel,
}: {
  player: Player
  contractSalary: number
  yearsRemaining: number
  contractLabel: string
  optionLabel: string | null
  tradableLabel: string | null
  draftInfoLabel: string
  teamLabel: string
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Front-office file</CardTitle>
        <CardDescription>Contract, roster context, and bio.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 py-4">
        <InfoRow label="Team" value={teamLabel} />
        <InfoRow label="Contract" value={contractLabel} />
        {optionLabel ? <InfoRow label="Option" value={optionLabel} /> : null}
        {tradableLabel ? (
          <InfoRow label="Trade status" value={tradableLabel} />
        ) : null}
        <InfoRow label="Salary" value={formatMoney(contractSalary)} />
        <InfoRow label="Years remaining" value={String(yearsRemaining)} />
        <InfoRow label="Draft" value={draftInfoLabel} />
        <InfoRow label="Service" value={`${player.yearsOfService} years`} />
        <InfoRow
          label="With team"
          value={`${player.seasonsWithTeam} seasons`}
        />
        <InfoRow label="Size" value={playerSize(player)} />
        <InfoRow
          label="Wingspan"
          value={`${player.wingspanInches ?? player.heightInches + 2}"`}
        />
        <InfoRow
          label="Reach"
          value={String(player.reachRating ?? "—")}
        />
        <InfoRow label="Peak age" value={String(player.peakAge)} />
      </CardContent>
    </Card>
  )
}

function PlayerMoodCard({
  hints,
  scoutingNote,
}: {
  hints: ReturnType<typeof getPlayerMoodHints>
  scoutingNote: string
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Player mood</CardTitle>
        <CardDescription>{scoutingNote}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 py-4">
        {hints ? (
          hints.map((row) => (
            <div
              key={row.label}
              className="rounded-md border bg-muted/10 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{row.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {row.value}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{row.hint}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            Limited intel — increase scouting to learn what this player values in
            contract talks.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function TimelineCard({
  awards,
  transactions,
}: {
  awards: SeasonAward[]
  transactions: LeagueLogEntry[]
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Awards and movement</CardTitle>
        <CardDescription>Recognition and logged transactions.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 py-4">
        <div>
          <p className="mb-2 font-medium">Awards</p>
          {awards.length === 0 ? (
            <p className="text-sm text-muted-foreground">No awards yet.</p>
          ) : (
            <div className="grid gap-2">
              {awards.map((award) => (
                <InfoRow
                  key={award.id}
                  label={`Season ${award.season}`}
                  value={awardLabel(award.type)}
                />
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="mb-2 font-medium">Transactions</p>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No transactions logged.
            </p>
          ) : (
            <div className="grid gap-2">
              {transactions.slice(0, 8).map((entry) => (
                <InfoRow
                  key={entry.id}
                  label={entry.dateLabel}
                  value={entry.type.replaceAll("_", " ")}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function OfferDialog({
  open,
  onOpenChange,
  player,
  mode,
  years,
  salary,
  validation,
  onYearsChange,
  onSalaryChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  player: Player
  mode: "re_sign" | "external"
  years: number
  salary: number
  validation:
    | { ok: true; signingException: FreeAgentOffer["signingException"] }
    | { ok: false; reason: string }
    | null
  onYearsChange: (years: number) => void
  onSalaryChange: (salary: number) => void
  onSubmit: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "re_sign" ? "Re-sign" : "Sign"} {player.firstName}{" "}
            {player.lastName}
          </DialogTitle>
          <DialogDescription>
            Build an offer and validate it against your cap sheet before
            submitting.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 overflow-auto p-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <Metric label="Position" value={player.position} />
            <Metric label="Overall" value={player.ratings.overall} />
            <Metric label="Age" value={player.age} />
          </div>
          <label className="grid gap-1 text-sm">
            Years
            <Input
              type="number"
              min={1}
              max={5}
              value={years}
              onChange={(event) => onYearsChange(Number(event.target.value))}
            />
          </label>
          <label className="grid gap-1 text-sm">
            First-year salary (M)
            <Input
              type="number"
              min={1}
              step={0.1}
              value={salary}
              onChange={(event) => onSalaryChange(Number(event.target.value))}
            />
          </label>
          {validation && !validation.ok ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
              {validation.reason}
            </p>
          ) : null}
          {validation?.ok ? (
            <p className="rounded-md border bg-muted/25 p-2 text-sm text-muted-foreground">
              Eligible via {validation.signingException?.replaceAll("_", " ")}.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!validation?.ok} onClick={onSubmit}>
            Submit {formatMoney(salary)} × {years} yr offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-medium tabular-nums">
        {value}
      </div>
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center rounded-md border bg-muted/20 px-2 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  )
}

function RatingBar({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className="grid gap-1">
      <div className="flex justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3 rounded-md border bg-muted/10 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

type PlayerDecision = {
  headline: string
  detail: string
  points: Array<{ label: string; value: string }>
}

function buildDecisionSummary({
  player,
  currentStats,
  yearsRemaining,
  isMyRosterPlayer,
  isFreeAgent,
  isOffseason,
  offseasonPhase,
}: {
  player: Player
  currentStats: PlayerSeasonStats | null
  yearsRemaining: number
  isMyRosterPlayer: boolean
  isFreeAgent: boolean
  isOffseason: boolean
  offseasonPhase: "re_signing" | "draft" | "free_agency" | null
}): PlayerDecision {
  const gap = developmentGap(player)
  const ageCurve =
    player.age <= player.peakAge - 2
      ? "Development"
      : player.age <= player.peakAge + 2
        ? "Prime"
        : "Decline risk"
  const contractRead =
    yearsRemaining <= 0
      ? "No active deal"
      : yearsRemaining === 1
        ? "Expiring"
        : `${yearsRemaining} years`
  const productionRead = currentStats ? statLine(currentStats) : "No game data"

  if (isFreeAgent) {
    return {
      headline:
        offseasonPhase === "re_signing"
          ? "Free-agent decision: retain or let walk."
          : "Free-agent decision: price the role before offering.",
      detail: isOffseason
        ? "Use the offer action when this player is eligible for the current offseason phase."
        : "Signing opens in the offseason. For now, review fit, ratings, and career record.",
      points: [
        { label: "Market read", value: contractRead },
        { label: "Curve", value: ageCurve },
        { label: "Upside", value: `+${gap}` },
        { label: "Production", value: productionRead },
      ],
    }
  }

  if (isMyRosterPlayer) {
    return {
      headline:
        yearsRemaining === 1
          ? "Roster decision: expiring contract, assess trade or extension value."
          : "Roster decision: compare role value against trade market.",
      detail:
        "This is your player, so release and trade actions are available when league rules allow them. The key read is whether the production and development gap justify the cap slot.",
      points: [
        { label: "Contract", value: contractRead },
        { label: "Curve", value: ageCurve },
        { label: "Upside", value: `+${gap}` },
        { label: "Production", value: productionRead },
      ],
    }
  }

  return {
    headline: "Trade target: scout value, cap fit, and development window.",
    detail:
      "This player belongs to another team. Use trade to preload him into the incoming side of the trade machine, then build an offer around salary and value.",
    points: [
      { label: "Contract", value: contractRead },
      { label: "Curve", value: ageCurve },
      { label: "Upside", value: `+${gap}` },
      { label: "Production", value: productionRead },
    ],
  }
}

function contractSummary(
  contract: { status: string } | undefined,
  yearsRemaining: number
): string {
  if (!contract || contract.status !== "active") {
    return "No active contract"
  }
  if (yearsRemaining === 1) {
    return "Expiring contract"
  }
  return `${yearsRemaining} years remaining`
}

function statLine(stats: PlayerSeasonStats): string {
  return `${stats.pts} / ${stats.reb} / ${stats.ast}`
}

function developmentGap(player: Player): number {
  return Math.max(0, player.ratings.potential - player.ratings.overall)
}

function archetypeLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function statusLabel(player: Player): string {
  if (player.injury) {
    return `${player.injury.description} · ${player.injury.gamesRemaining} games`
  }
  return player.status.replaceAll("_", " ")
}

function draftLabel(player: Player): string {
  if (!player.draftInfo) {
    return "Undrafted"
  }
  return `${player.draftInfo.year} R${player.draftInfo.round} #${player.draftInfo.overallPick}`
}

function playerSize(player: Player): string {
  const feet = Math.floor(player.heightInches / 12)
  const inches = player.heightInches % 12
  return `${feet}'${inches}" · ${player.weightLbs} lbs`
}

function awardLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}
