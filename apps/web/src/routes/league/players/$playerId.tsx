import { Link, createFileRoute } from "@tanstack/react-router"
import { useMemo, useState } from "react"

import { playerName } from "@/components/box-score/playerName"
import { ExtendContractDialog } from "@/components/league/ExtendContractDialog"
import { formatMoney } from "@/components/league/lib/moneyFormat"
import { teamAbbrev, teamName } from "@/components/league/lib/teamFormat"
import { useLeagueContext } from "@/contexts/LeagueContext"
import {
  canSignPlayer,
  getCurrentSalary,
  getExtensionEligibilityReason,
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
  SkillKey,
} from "@workspace/shared/types"
import { Button } from "@workspace/ui/components/button"
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
  getTeamScoutingLevel,
  getViewRatings,
  skillLabel,
} from "@/components/league/lib/scouting"
import {
  getNextContractOptionLabel,
  getTradableRestrictionLabel,
} from "@/components/league/lib/contractLabels"
import { getPlayerMoodHints } from "@/components/league/lib/moodHints"
import { cn } from "@workspace/ui/lib/utils"
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

type PlayerTab = "scouting" | "contract" | "career"

const PLAYER_TABS: Array<{ id: PlayerTab; label: string }> = [
  { id: "scouting", label: "Scouting" },
  { id: "contract", label: "Contract" },
  { id: "career", label: "Career" },
]

const SKILL_CATEGORIES: Array<{ title: string; keys: SkillKey[] }> = [
  {
    title: "Shooting",
    keys: ["threePoint", "midRange", "freeThrow", "inside"],
  },
  {
    title: "Playmaking",
    keys: ["passing", "ballHandling", "offensiveIQ"],
  },
  {
    title: "Defense",
    keys: ["defense", "rebounding", "defensiveIQ"],
  },
  {
    title: "Physical",
    keys: ["stamina"],
  },
]

function PlayerProfilePage() {
  const { playerId } = Route.useParams()
  const {
    league,
    seasonState,
    userTeamId,
    offseasonPhase,
    releasePlayer,
    signFreeAgent,
    extendContract,
  } = useLeagueContext()
  const [activeTab, setActiveTab] = useState<PlayerTab>("scouting")
  const [offerOpen, setOfferOpen] = useState(false)
  const [extendOpen, setExtendOpen] = useState(false)
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
      (entry) => entry.playerId === playerId,
    ) ?? null
  const snapshots = league.playerCareerSnapshots
    .filter((entry) => entry.playerId === playerId)
    .sort((a, b) => a.season - b.season)
  const lastDevelopment = (league.playerDevelopmentRecords ?? [])
    .filter((entry) => entry.playerId === playerId && !entry.retired)
    .sort((a, b) => b.season - a.season)[0]
  const awards = league.seasonAwards.filter(
    (entry) => entry.playerId === playerId,
  )
  const transactions = league.leagueLog
    .filter((entry) => entry.playerId === playerId)
    .slice()
    .reverse()

  if (!player && snapshots.length === 0) {
    return (
      <div className="rounded-lg ring-1 ring-foreground/10 p-4">
        <h1 className="text-sm font-medium">Player not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This player is not in the current league.
        </p>
      </div>
    )
  }

  const reSignFreeAgents = userTeamId
    ? getTeamExpiredFreeAgents(league, userTeamId)
    : []
  const externalFreeAgents = userTeamId
    ? getExternalFreeAgents(league, userTeamId)
    : []
  const isMyRosterPlayer = Boolean(
    player && userTeamId && player.teamId === userTeamId,
  )
  const isFreeAgent = Boolean(player && player.teamId === null)
  const isReSignCandidate = Boolean(
    player && reSignFreeAgents.some((entry) => entry.id === player.id),
  )
  const isExternalFreeAgent = Boolean(
    player && externalFreeAgents.some((entry) => entry.id === player.id),
  )
  const canOpenOffer = Boolean(
    player &&
      userTeamId &&
      isFreeAgent &&
      ((offseasonPhase === "re_signing" && isReSignCandidate) ||
        (offseasonPhase === "free_agency" && isExternalFreeAgent)),
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
  const displayName = player ? playerName(allPlayers, player.id) : playerId
  const teamBadge = playerTeam
    ? playerTeam.abbrev
    : player?.teamId === null
      ? "FA"
      : null
  const contractLabel = contractSummary(contract, yearsRemaining)
  const extendEligibility =
    player && userTeamId && isMyRosterPlayer
      ? getExtensionEligibilityReason(league, userTeamId, player.id)
      : null
  const contractSalary = getCurrentSalary(contract)

  return (
    <div className="-m-px flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-px">
      <PlayerIdentityStrip
        player={player}
        name={displayName}
        teamBadge={teamBadge}
        contractLabel={contractLabel}
        viewRatings={viewRatings}
        currentStats={currentStats}
        isMyRosterPlayer={isMyRosterPlayer}
        isFreeAgent={isFreeAgent}
        canOpenOffer={canOpenOffer}
        canExtend={extendEligibility?.ok ?? false}
        extendReason={
          extendEligibility && !extendEligibility.ok
            ? extendEligibility.reason
            : undefined
        }
        onOpenOffer={() => {
          if (player) {
            setOfferSalary(Math.max(2, Math.round(player.ratings.overall / 8)))
          }
          setOfferOpen(true)
        }}
        onExtend={() => setExtendOpen(true)}
        onRelease={() => player && releasePlayer(player.id)}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <PlayerTabBar activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === "scouting" && player ? (
          <ScoutingTab
            player={player}
            viewRatings={viewRatings ?? player.ratings}
            scoutingNote={scoutingNote}
            moodHints={moodHints}
            lastDevelopment={lastDevelopment}
          />
        ) : null}

        {activeTab === "contract" && player ? (
          <ContractTab
            player={player}
            contractLabel={contractLabel}
            optionLabel={optionLabel}
            tradableLabel={tradableLabel}
            contractSalary={contractSalary}
            yearsRemaining={yearsRemaining}
            draftInfoLabel={draftLabel(player)}
            teamLabel={
              player.teamId ? teamName(seasonState, player.teamId) : "None"
            }
          />
        ) : null}

        {activeTab === "career" ? (
          <CareerTab
            seasonState={seasonState}
            snapshots={snapshots}
            awards={awards}
            player={player}
            currentStats={currentStats}
            season={seasonState.season}
            transactions={transactions}
          />
        ) : null}
      </div>

      {player && userTeamId ? (
        <>
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
          <ExtendContractDialog
            league={league}
            teamId={userTeamId}
            playerId={player.id}
            playerName={displayName}
            position={player.position}
            overall={player.ratings.overall}
            currentSalary={contractSalary}
            open={extendOpen}
            onClose={() => setExtendOpen(false)}
            onConfirm={(id, extensionOffer) => {
              extendContract(id, extensionOffer)
              setExtendOpen(false)
            }}
          />
        </>
      ) : null}
    </div>
  )
}

type PlayerIdentityStripProps = {
  player: Player | undefined
  viewRatings: PlayerRatings | null
  name: string
  teamBadge: string | null
  contractLabel: string
  currentStats: PlayerSeasonStats | null
  isMyRosterPlayer: boolean
  isFreeAgent: boolean
  canOpenOffer: boolean
  canExtend: boolean
  extendReason?: string
  onOpenOffer: () => void
  onExtend: () => void
  onRelease: () => void
}

function PlayerIdentityStrip({
  player,
  viewRatings,
  name,
  teamBadge,
  contractLabel,
  currentStats,
  isMyRosterPlayer,
  isFreeAgent,
  canOpenOffer,
  canExtend,
  extendReason,
  onOpenOffer,
  onExtend,
  onRelease,
}: PlayerIdentityStripProps) {
  const tradeSearch = player
    ? isMyRosterPlayer
      ? { outgoingPlayerId: player.id }
      : player.teamId
        ? { incomingPlayerId: player.id, targetTeamId: player.teamId }
        : undefined
    : undefined

  const overall = viewRatings?.overall ?? player?.ratings.overall ?? "—"
  const potential = viewRatings?.potential ?? player?.ratings.potential ?? "—"
  const seasonLine = currentStats ? statLine(currentStats) : "No games"

  return (
    <header className="border-b border-border pb-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          {player ? (
            <PlayerMonogram
              firstName={player.firstName}
              lastName={player.lastName}
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-balance">
                {name}
              </h1>
              {player ? (
                <>
                  {teamBadge ? <Badge>{teamBadge}</Badge> : null}
                  <Badge>{archetypeLabel(player.archetype)}</Badge>
                  <Badge>{statusLabel(player)}</Badge>
                </>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {player ? (
                <>
                  {player.age} yrs · {playerSize(player)} · {contractLabel}
                </>
              ) : (
                "Archived player"
              )}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
          <div className="flex items-end divide-x divide-border">
            <HeaderStat label="Overall" value={overall} large />
            <HeaderStat label="Potential" value={potential} />
            <HeaderStat label="Season line" value={seasonLine} />
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {player && !isFreeAgent ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/league/trades" search={tradeSearch}>
                  Trade
                </Link>
              </Button>
            ) : null}
            {player && isMyRosterPlayer ? (
              <Button
                variant="outline"
                size="sm"
                disabled={!canExtend}
                title={extendReason}
                onClick={onExtend}
              >
                Extend
              </Button>
            ) : null}
            {player && isMyRosterPlayer ? (
              <Button variant="destructive" size="sm" onClick={onRelease}>
                Release
              </Button>
            ) : null}
            {player && isFreeAgent ? (
              <Button
                disabled={!canOpenOffer}
                size="sm"
                onClick={onOpenOffer}
              >
                {canOpenOffer ? "Open offer" : "Unavailable"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}

function PlayerTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: PlayerTab
  onTabChange: (tab: PlayerTab) => void
}) {
  return (
    <div className="flex gap-1 border-b border-border">
      {PLAYER_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "px-3 py-2 text-sm font-medium transition-colors",
            activeTab === tab.id
              ? "border-b-2 border-foreground text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function ScoutingTab({
  player,
  viewRatings,
  scoutingNote,
  moodHints,
  lastDevelopment,
}: {
  player: Player
  viewRatings: PlayerRatings
  scoutingNote: string
  moodHints: ReturnType<typeof getPlayerMoodHints>
  lastDevelopment: PlayerDevelopmentRecord | undefined
}) {
  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-lg ring-1 ring-foreground/10">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium">Skill evaluation</h2>
          <p className="text-xs text-muted-foreground">{scoutingNote}</p>
        </div>
        <div className="grid gap-6 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {SKILL_CATEGORIES.map((category) => (
            <div key={category.title}>
              <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                {category.title}
              </h3>
              <div className="grid gap-0.5">
                {category.keys.map((key) => (
                  <RatingCell
                    key={key}
                    label={skillLabel(key)}
                    value={viewRatings[key]}
                  />
                ))}
              </div>
            </div>
          ))}
          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">
              Profile
            </h3>
            <div className="grid gap-0.5">
              <RatingCell label="Usage" value={viewRatings.usage} />
              <RatingCell
                label="Dev. gap"
                value={developmentGap(player)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg ring-1 ring-foreground/10 px-4 py-3">
        <h2 className="text-sm font-medium">Player mood</h2>
        <p className="text-xs text-muted-foreground">{scoutingNote}</p>
        <div className="mt-3">
          {moodHints ? (
            moodHints.map((row) => (
              <RailRow
                key={row.label}
                label={row.label}
                value={row.value}
                hint={row.hint}
              />
            ))
          ) : (
            <p className="py-2 text-sm text-muted-foreground">
              Limited intel — increase scouting to learn what this player values
              in contract talks.
            </p>
          )}
        </div>
      </section>

      {lastDevelopment ? (
        <section className="rounded-lg ring-1 ring-foreground/10 px-4 py-3">
          <h2 className="text-sm font-medium">Last progression</h2>
          <p className="text-xs text-muted-foreground">
            Season {lastDevelopment.season} preseason · Age{" "}
            {lastDevelopment.ageBefore} → {lastDevelopment.ageAfter}
          </p>
          <div className="mt-3">
            <LastDevelopmentRows record={lastDevelopment} />
          </div>
        </section>
      ) : null}
    </div>
  )
}

function ContractTab({
  player,
  contractLabel,
  optionLabel,
  tradableLabel,
  contractSalary,
  yearsRemaining,
  draftInfoLabel,
  teamLabel,
}: {
  player: Player
  contractLabel: string
  optionLabel: string | null
  tradableLabel: string | null
  contractSalary: number
  yearsRemaining: number
  draftInfoLabel: string
  teamLabel: string
}) {
  return (
    <section className="rounded-lg ring-1 ring-foreground/10 px-4 py-3">
      <h2 className="text-sm font-medium">Contract and bio</h2>
      <p className="text-xs text-muted-foreground">
        Salary, terms, and physical profile.
      </p>
      <div className="mt-3">
        <RailRow label="Team" value={teamLabel} />
        <RailRow label="Contract" value={contractLabel} />
        {optionLabel ? <RailRow label="Option" value={optionLabel} /> : null}
        {tradableLabel ? (
          <RailRow label="Trade status" value={tradableLabel} />
        ) : null}
        <RailRow label="Salary" value={formatMoney(contractSalary)} />
        <RailRow label="Years remaining" value={String(yearsRemaining)} />
        <RailRow label="Draft" value={draftInfoLabel} />
        <RailRow label="Service" value={`${player.yearsOfService} years`} />
        <RailRow
          label="With team"
          value={`${player.seasonsWithTeam} seasons`}
        />
        <RailRow label="Size" value={playerSize(player)} />
        <RailRow
          label="Wingspan"
          value={`${player.wingspanInches ?? player.heightInches + 2}"`}
        />
        <RailRow label="Reach" value={String(player.reachRating ?? "—")} />
        <RailRow label="Peak age" value={String(player.peakAge)} />
      </div>
    </section>
  )
}

function CareerTab({
  seasonState,
  snapshots,
  awards,
  player,
  currentStats,
  season,
  transactions,
}: {
  seasonState: Parameters<typeof teamAbbrev>[0]
  snapshots: PlayerCareerSnapshot[]
  awards: SeasonAward[]
  player: Player | undefined
  currentStats: PlayerSeasonStats | null
  season: number
  transactions: LeagueLogEntry[]
}) {
  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-lg ring-1 ring-foreground/10">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium">Career record</h2>
          <p className="text-xs text-muted-foreground">
            Season {season} and archived seasons.
          </p>
        </div>
        <div className="overflow-x-auto">
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
                <TableHead>MIN</TableHead>
                <TableHead>PTS</TableHead>
                <TableHead>REB</TableHead>
                <TableHead>AST</TableHead>
                <TableHead>STL</TableHead>
                <TableHead>BLK</TableHead>
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
                  <TableCell>{currentStats.min}</TableCell>
                  <TableCell>{currentStats.pts}</TableCell>
                  <TableCell>{currentStats.reb}</TableCell>
                  <TableCell>{currentStats.ast}</TableCell>
                  <TableCell>{currentStats.stl}</TableCell>
                  <TableCell>{currentStats.blk}</TableCell>
                  <TableCell>
                    {awards
                      .filter((award) => award.season === currentStats.season)
                      .map((award) => awardLabel(award.type))
                      .join(", ") || "—"}
                  </TableCell>
                </TableRow>
              ) : null}
              {snapshots.length === 0 && !currentStats ? (
                <TableRow>
                  <TableCell colSpan={14} className="text-muted-foreground">
                    No completed games or archived seasons yet.
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
                  <TableCell>—</TableCell>
                  <TableCell>{snapshot.pts}</TableCell>
                  <TableCell>{snapshot.reb}</TableCell>
                  <TableCell>{snapshot.ast}</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>
                    {snapshot.awards.map(awardLabel).join(", ") || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="rounded-lg ring-1 ring-foreground/10 px-4 py-3">
        <h2 className="text-sm font-medium">Awards and movement</h2>
        <p className="mb-2 mt-0.5 text-xs font-medium text-muted-foreground">
          Awards
        </p>
        {awards.length === 0 ? (
          <p className="border-b border-border/60 py-2 text-sm text-muted-foreground">
            No awards yet.
          </p>
        ) : (
          awards.map((award) => (
            <RailRow
              key={award.id}
              label={`Season ${award.season}`}
              value={awardLabel(award.type)}
            />
          ))
        )}
        <p className="mb-2 mt-3 text-xs font-medium text-muted-foreground">
          Transactions
        </p>
        {transactions.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No transactions logged.
          </p>
        ) : (
          transactions.slice(0, 8).map((entry) => (
            <RailRow
              key={entry.id}
              label={entry.dateLabel}
              value={entry.type.replaceAll("_", " ")}
            />
          ))
        )}
      </section>
    </div>
  )
}

function LastDevelopmentRows({ record }: { record: PlayerDevelopmentRecord }) {
  const overallDelta = record.overallAfter - record.overallBefore
  const potentialDelta = record.potentialAfter - record.potentialBefore
  const deltaLabel =
    overallDelta > 0 ? `+${overallDelta}` : overallDelta.toString()

  return (
    <>
      <RailRow
        label="Overall"
        value={`${record.overallBefore} → ${record.overallAfter} (${deltaLabel})`}
      />
      <RailRow
        label="Potential"
        value={`${record.potentialBefore} → ${record.potentialAfter}${
          potentialDelta !== 0
            ? ` (${potentialDelta > 0 ? "+" : ""}${potentialDelta})`
            : ""
        }`}
      />
      <RailRow
        label="Momentum"
        value={`${record.momentumApplied >= 0 ? "+" : ""}${record.momentumApplied.toFixed(2)}`}
      />
      {record.modifierIds.length > 0 ? (
        <div className="border-b border-border/60 py-2 text-sm">
          <span className="text-muted-foreground">Modifiers</span>
          <ul className="mt-1 list-inside list-disc text-foreground">
            {record.modifierIds.map((id) => (
              <li key={id}>{formatDevelopmentReason(id)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {record.events.length > 0 ? (
        <div className="py-2 text-sm">
          <span className="text-muted-foreground">Events</span>
          <ul className="mt-1 list-inside list-disc text-foreground">
            {record.events.map((event) => (
              <li key={event}>{formatDevelopmentReason(event)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
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
            <OfferMetric label="Position" value={player.position} />
            <OfferMetric label="Overall" value={player.ratings.overall} />
            <OfferMetric label="Age" value={player.age} />
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

function PlayerMonogram({
  firstName,
  lastName,
}: {
  firstName: string
  lastName: string
}) {
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase()
  return (
    <div
      aria-hidden
      className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold text-muted-foreground"
    >
      {initials}
    </div>
  )
}

function HeaderStat({
  label,
  value,
  large = false,
}: {
  label: string
  value: string | number
  large?: boolean
}) {
  return (
    <div className="px-4 text-right first:pl-0">
      <div
        className={cn(
          "tabular-nums tracking-tight",
          large ? "text-4xl font-semibold" : "text-lg font-medium",
        )}
      >
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function RatingCell({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="flex items-baseline justify-between gap-2 py-0.5"
      title={label}
    >
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "shrink-0 tabular-nums text-sm",
          value >= 85 && "font-semibold text-foreground",
          value >= 75 && value < 85 && "font-medium text-foreground",
          value < 75 && "text-muted-foreground",
        )}
      >
        {value}
      </span>
    </div>
  )
}

function RailRow({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <div className="border-b border-border/60 py-2 text-sm last:border-b-0">
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-right font-medium">{value}</span>
      </div>
      {hint ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

function OfferMetric({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
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

function formatDevelopmentReason(code: string): string {
  return code
    .replaceAll(":", " · ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function contractSummary(
  contract: { status: string } | undefined,
  yearsRemaining: number,
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
