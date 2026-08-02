import { ArrowLeft01Icon, PieChartIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { createFileRoute, Link } from "@tanstack/react-router"
import type {
  ContractMarketConfig,
  ContractMarketFixture,
  ContractMarketScenarioResult,
  ContractOffer,
  EconomyConfig,
} from "@workspace/domain-v2"
import {
  serializeContractMarketFixture,
  serializeContractMarketScenarioExport,
  serializeEconomyRunExport,
  serializeFreeAgencyRunExport,
} from "@workspace/league-schema"
import type { MarketRulesViewContext } from "@workspace/league-schema"
import {
  calculateContractDemand,
  createDefaultContractMarketFixture,
  createEconomySnapshot,
  evaluateCompetitiveOffers,
  evaluateContractOffer,
  getMarketNumericSetting,
  MARKET_SETTING_DESCRIPTORS,
  STANDARD_CONTRACT_MARKET_CONFIG,
  STANDARD_ECONOMY_CONFIG,
  getPlayerCurrentAbility,
  updateMarketNumericSetting,
} from "@workspace/sim-v2"
import type {
  EconomySimulationResult,
  FreeAgencySimulationProgress,
  FreeAgencySimulationResult,
  MarketNumericSettingPath,
} from "@workspace/sim-v2"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import * as React from "react"

import {
  runEconomyInWorker,
  runFreeAgencyInWorker,
} from "@/lib/marketRulesWorker"

export const Route = createFileRoute("/developer-labs/market-rules")({
  component: MarketRulesLabPage,
})

type LabMode = "offer" | "re-signing" | "extension" | "free-agency" | "economy"

const modes: Array<{ id: LabMode; label: string; detail: string }> = [
  {
    id: "offer",
    label: "Offer inspector",
    detail: "Demand, utility, legality",
  },
  { id: "re-signing", label: "Re-signing", detail: "Rights and continuity" },
  { id: "extension", label: "Extension", detail: "Forecasted future value" },
  { id: "free-agency", label: "Free agency", detail: "Three-round market" },
  { id: "economy", label: "Economy", detail: "Multi-season harness" },
]

function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return "—"
  return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}M`
}

function formatOverall(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value)) : "—"
}

function formatName(fixture: ContractMarketFixture, playerId: string): string {
  const player = fixture.players[playerId]
  return (
    [player.identity.firstName, player.identity.lastName]
      .filter(Boolean)
      .join(" ") ||
    playerId.split(":").at(-1) ||
    playerId
  )
}

function downloadJson(filename: string, serialized: string): void {
  const blob = new Blob([serialized], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function qualityLabel(value: number): string {
  return value >= 820
    ? "Star"
    : value >= 700
      ? "Starter"
      : value >= 570
        ? "Rotation"
        : "Depth"
}

function modePhase(mode: LabMode): ContractOffer["phase"] {
  if (mode === "re-signing") return "re-signing"
  if (mode === "extension") return "extension"
  return "free-agency"
}

function createOffer(
  fixture: ContractMarketFixture,
  playerId: string,
  teamId: string,
  mode: LabMode,
  salaryMillions: number,
  years: number
): ContractOffer {
  const salary =
    Math.round((Math.max(0, salaryMillions) * 1_000_000) / 10_000) * 10_000
  return {
    id: `${fixture.seed}:lab-offer:${playerId}:${teamId}:${mode}`,
    playerId,
    teamId,
    season: fixture.season,
    phase: modePhase(mode),
    round: 1,
    annualSalary: Array.from(
      { length: years },
      (_, index) =>
        Math.round(
          (salary * (1 + fixture.economy.config.standardRaiseRate) ** index) /
            10_000
        ) * 10_000
    ),
    years,
    fullyGuaranteed: true,
    source: "user",
  }
}

function getOfferSalary(offers: Array<ContractOffer>, offerId: string): number {
  const offer = offers.find((candidate) => candidate.id === offerId)
  return offer ? (offer.annualSalary[0] ?? 0) : 0
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l border-border pl-3">
      <p className="text-[0.65rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tracking-[-0.03em] tabular-nums">
        {value}
      </p>
    </div>
  )
}

function DecisionBadge({ decision }: { decision: string }) {
  const variant =
    decision === "accept"
      ? "default"
      : decision === "wait"
        ? "outline"
        : "secondary"
  return <Badge variant={variant}>{decision.replaceAll("-", " ")}</Badge>
}

function FreeAgencyReportPanel({
  fixture,
  marketRun,
  selectedTeamId,
}: {
  fixture: ContractMarketFixture
  marketRun: FreeAgencySimulationResult
  selectedTeamId: string
}) {
  const rounds = marketRun.rounds
  const totalOffers = rounds.reduce(
    (sum, round) => sum + round.offers.length,
    marketRun.cleanup.offers.length
  )
  const allDecisions = [
    ...rounds.flatMap((round) => round.decisions),
    ...marketRun.cleanup.decisions,
  ]
  const coverage = marketRun.playerCoverage
  const coveredPlayers = coverage.filter(
    (player) => player.targetedRounds.length > 0
  ).length
  const cleanupSigned = marketRun.cleanup.acceptedPlayerIds.length
  const invalidOffers = allDecisions.filter(
    (decision) => !decision.legal.valid
  ).length
  const decisionCounts = allDecisions.reduce(
    (counts, decision) => {
      counts[decision.decision] = (counts[decision.decision] ?? 0) + 1
      return counts
    },
    {} as Record<string, number>
  )
  const participatingTeams = new Set(
    [
      ...rounds.flatMap((round) =>
        round.teamActivity
          .filter((activity) => activity.activeOfferCount > 0)
          .map((activity) => activity.teamId)
      ),
      ...marketRun.cleanup.offers.map((offer) => offer.teamId),
    ]
  )
  const initialTeam = selectedTeamId
    ? fixture.teamContexts[selectedTeamId]
    : null
  const finalTeam = selectedTeamId
    ? marketRun.finalFixture.teamContexts[selectedTeamId]
    : null
  const selectedTeamSignings = marketRun.signedContracts.filter(
    (contract) => contract.teamId === selectedTeamId
  )

  const signingRows = marketRun.signedContracts.map((contract) => {
    const round = rounds.find((candidate) =>
      candidate.acceptedPlayerIds.includes(contract.playerId)
    )
    const decision = round?.decisions.find(
      (candidate) =>
        candidate.playerId === contract.playerId &&
        candidate.decision === "accept"
    )
    const cleanupDecision = marketRun.cleanup.decisions.find(
      (candidate) =>
        candidate.playerId === contract.playerId &&
        candidate.decision === "accept"
    )
    return {
      contract,
      round: round?.round ?? (cleanupDecision ? "cleanup" : "—"),
      decision: decision ?? cleanupDecision,
    }
  })

  return (
    <div className="mt-7 grid gap-5 border-t border-border pt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Market run report</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Deterministic automated resolution across {rounds.length} of{" "}
            {fixture.config.freeAgencyRounds} configured rounds.
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>
            Seed:{" "}
            <span className="font-medium text-foreground">
              {marketRun.seed}
            </span>
          </p>
          <p className="mt-1">
            {marketRun.unsignedPlayerIds.length} players remain unsigned
          </p>
          <p className="mt-1">
            {participatingTeams.size} teams submitted offers ·{" "}
            {fixture.config.targetBoardSize}-player target boards · {coveredPlayers}{" "}
            of {coverage.length} players targeted
          </p>
          <p className="mt-1">
            Late cleanup: {marketRun.cleanup.enabled ? "on" : "off"} ·{" "}
            {marketRun.cleanup.consideredPlayerIds.length} considered ·{" "}
            {cleanupSigned} signed
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
        <Metric
          label="Signed"
          value={String(marketRun.signedContracts.length)}
        />
        <Metric
          label="Unsigned"
          value={String(marketRun.unsignedPlayerIds.length)}
        />
        <Metric label="Offers" value={String(totalOffers)} />
        <Metric label="Accepted" value={String(decisionCounts.accept || 0)} />
        <Metric label="Illegal" value={String(invalidOffers)} />
        <Metric label="Covered" value={`${coveredPlayers}/${coverage.length}`} />
        <Metric label="Cleanup signed" value={String(cleanupSigned)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="rounded-md border border-border bg-muted/20 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-foreground">
                Round activity
              </p>
              <p className="mt-1 text-[0.6875rem] leading-4 text-muted-foreground">
                Teams keep a live payroll reservation and rebuild their target
                boards after each market round.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline">
                {decisionCounts.wait || 0} waiting
              </Badge>
              <Badge variant="secondary">
                {decisionCounts.decline || 0} declined
              </Badge>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            {rounds.map((round) => (
              <details
                key={round.round}
                open={round.round === 1}
                className="rounded-md border border-border bg-card px-3 py-2"
              >
                <summary className="cursor-pointer list-none outline-none focus-visible:ring-2 focus-visible:ring-ring/40 [&::-webkit-details-marker]:hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-medium">Round {round.round}</span>
                    <span className="text-muted-foreground">
                      {round.offers.length} offers ·{" "}
                      {round.acceptedPlayerIds.length} signed ·{" "}
                      {round.teamActivity.filter(
                        (activity) => activity.activeOfferCount > 0
                      ).length} teams
                    </span>
                  </div>
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs sm:grid-cols-4">
                  <Metric
                    label="Accept"
                    value={String(
                      round.decisions.filter(
                        (item) => item.decision === "accept"
                      ).length
                    )}
                  />
                  <Metric
                    label="Wait"
                    value={String(
                      round.decisions.filter((item) => item.decision === "wait")
                        .length
                    )}
                  />
                  <Metric
                    label="Decline"
                    value={String(
                      round.decisions.filter(
                        (item) => item.decision === "decline"
                      ).length
                    )}
                  />
                  <Metric
                    label="Lockout"
                    value={String(
                      round.decisions.filter(
                        (item) => item.decision === "refuse-further-negotiation"
                      ).length
                    )}
                  />
                  <Metric
                    label="Rejected"
                    value={String(
                      round.teamActivity.reduce(
                        (sum, activity) => sum + activity.rejectedOfferCount,
                        0
                      )
                    )}
                  />
                </div>
              </details>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-border p-4">
          <p className="text-xs font-semibold text-foreground">
            {initialTeam
              ? `${initialTeam.team.name} team impact`
              : "Team impact"}
          </p>
          {initialTeam && finalTeam ? (
            <>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Metric
                  label="Starting payroll"
                  value={formatMoney(initialTeam.payroll)}
                />
                <Metric
                  label="Ending payroll"
                  value={formatMoney(finalTeam.payroll)}
                />
                <Metric
                  label="Starting cap room"
                  value={formatMoney(initialTeam.capRoom)}
                />
                <Metric
                  label="Ending cap room"
                  value={formatMoney(finalTeam.capRoom)}
                />
                <Metric
                  label="Reserved salary"
                  value={formatMoney(finalTeam.reservedSalary)}
                />
                <Metric
                  label="Market slots left"
                  value={String(finalTeam.marketRosterSlots)}
                />
                <Metric
                  label="Rostered count"
                  value={String(finalTeam.rosteredPlayerCount)}
                />
              </div>
              <div className="mt-4 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
                {selectedTeamSignings.length
                  ? `${selectedTeamSignings.length} player${selectedTeamSignings.length === 1 ? "" : "s"} signed for this team in the automated run.`
                  : "This team did not sign a player in the automated run."}
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Select a team before running the market to inspect its payroll and
              cap-room movement.
            </p>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        <div className="border-b border-border px-3 py-3">
          <p className="text-xs font-semibold">Team market activity</p>
          <p className="mt-1 text-[0.6875rem] text-muted-foreground">
            The exported run keeps each team&apos;s board, active offers, payroll
            movement, and remaining market capacity visible by round.
          </p>
        </div>
        <div className="max-h-[22rem] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>Round</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Targets</TableHead>
                <TableHead>Offers</TableHead>
                <TableHead>Rejected</TableHead>
                <TableHead>Capacity after</TableHead>
                <TableHead>Payroll movement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rounds.flatMap((round) =>
                round.teamActivity.map((activity) => (
                  <TableRow
                    key={String(round.round) + ":" + activity.teamId}
                  >
                    <TableCell className="tabular-nums">{round.round}</TableCell>
                    <TableCell className="font-medium">
                      {fixture.teams[activity.teamId].name}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {activity.targetPlayerIds.length}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {activity.activeOfferCount}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {activity.rejectedOfferCount}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {activity.marketRosterSlotsAfter} slots ·{" "}
                      {activity.rosteredPlayerCountAfter} rostered
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatMoney(activity.payrollBefore)} →{" "}
                      {formatMoney(activity.payrollAfter)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        <div className="border-b border-border px-3 py-3">
          <p className="text-xs font-semibold">Player market coverage</p>
          <p className="mt-1 text-[0.6875rem] text-muted-foreground">
            Every actual free agent is classified by board exposure, offers,
            negotiation outcome, and final market status.
          </p>
        </div>
        <div className="max-h-[28rem] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>Player</TableHead>
                <TableHead>OVR</TableHead>
                <TableHead>Pos</TableHead>
                <TableHead>Targeted rounds</TableHead>
                <TableHead>Offers</TableHead>
                <TableHead>Teams</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coverage.map((playerCoverage) => {
                const player = marketRun.finalFixture.players[playerCoverage.playerId]
                return (
                  <TableRow key={playerCoverage.playerId}>
                    <TableCell className="font-medium">
                      {formatName(marketRun.finalFixture, playerCoverage.playerId)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatOverall(getPlayerCurrentAbility(player))}
                    </TableCell>
                    <TableCell>{player.profile.role.primaryPosition}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {playerCoverage.targetedRounds.length
                        ? playerCoverage.targetedRounds.join(", ")
                        : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {playerCoverage.offerCount}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {playerCoverage.teamCount}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          playerCoverage.finalStatus === "signed"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {playerCoverage.finalStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {playerCoverage.finalReason.replaceAll("-", " ")}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="overflow-hidden rounded-md border border-border">
          <div className="border-b border-border px-3 py-3">
            <p className="text-xs font-semibold">Market signings</p>
            <p className="mt-1 text-[0.6875rem] text-muted-foreground">
              Accepted contracts from all rounds.
            </p>
          </div>
          <div className="max-h-[24rem] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Player</TableHead>
                  <TableHead>OVR</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Round</TableHead>
                  <TableHead>Mechanism</TableHead>
                  <TableHead>Term</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signingRows.map(({ contract, round, decision }) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">
                      {formatName(marketRun.finalFixture, contract.playerId)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatOverall(
                        getPlayerCurrentAbility(
                          marketRun.finalFixture.players[contract.playerId]
                        )
                      )}
                    </TableCell>
                    <TableCell>
                      {marketRun.finalFixture.teams[contract.teamId].name}
                    </TableCell>
                    <TableCell className="tabular-nums">{round}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {decision?.legal.mechanism ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatMoney(contract.annualSalary[0] ?? 0)} ·{" "}
                      {contract.years}y
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-border">
          <div className="border-b border-border px-3 py-3">
            <p className="text-xs font-semibold">Unsigned pool</p>
            <p className="mt-1 text-[0.6875rem] text-muted-foreground">
              Players remaining after the final automated round and cleanup.
            </p>
          </div>
          <div className="max-h-[24rem] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Player</TableHead>
                  <TableHead>OVR</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Pos</TableHead>
                  <TableHead>Tier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {marketRun.unsignedPlayerIds.map((playerId) => {
                  const player = marketRun.finalFixture.players[playerId]
                  const value = marketRun.finalFixture.values[playerId]
                  return (
                    <TableRow key={playerId}>
                      <TableCell className="font-medium">
                        {formatName(marketRun.finalFixture, playerId)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatOverall(getPlayerCurrentAbility(player))}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {player.age}
                      </TableCell>
                      <TableCell>
                        {player.profile.role.primaryPosition}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {qualityLabel(value.rawValue)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}

function MarketRulesLabPage() {
  const [mode, setMode] = React.useState<LabMode>("offer")
  const [seed, setSeed] = React.useState("market-rules-lab")
  const [fixture, setFixture] = React.useState<ContractMarketFixture>(() =>
    createDefaultContractMarketFixture("market-rules-lab")
  )
  const [draftEconomy, setDraftEconomy] = React.useState<EconomyConfig>(() =>
    structuredClone(STANDARD_ECONOMY_CONFIG)
  )
  const [draftMarket, setDraftMarket] = React.useState<ContractMarketConfig>(
    () => structuredClone(STANDARD_CONTRACT_MARKET_CONFIG)
  )
  const [selectedPlayerId, setSelectedPlayerId] = React.useState("")
  const [selectedTeamId, setSelectedTeamId] = React.useState("")
  const [salaryMillions, setSalaryMillions] = React.useState(24)
  const [years, setYears] = React.useState(4)
  const [scenario, setScenario] =
    React.useState<ContractMarketScenarioResult | null>(null)
  const [marketRun, setMarketRun] =
    React.useState<FreeAgencySimulationResult | null>(null)
  const [marketProgress, setMarketProgress] =
    React.useState<FreeAgencySimulationProgress | null>(null)
  const [economyRun, setEconomyRun] =
    React.useState<EconomySimulationResult | null>(null)
  const [running, setRunning] = React.useState(false)
  const [status, setStatus] = React.useState(
    "Ready for a deterministic offer test."
  )

  const viewContext: MarketRulesViewContext = {
    mode,
    selectedPlayerId: selectedPlayerId || null,
    selectedTeamId: selectedTeamId || null,
    salaryMillions,
    years,
  }
  const fixtureNeedsRegeneration =
    seed.trim() !== fixture.seed ||
    JSON.stringify(draftEconomy) !== JSON.stringify(fixture.economy.config) ||
    JSON.stringify(draftMarket) !== JSON.stringify(fixture.config)

  const playerIds = React.useMemo(() => {
    if (mode === "offer") return fixture.actualFreeAgentIds
    if (mode === "free-agency" || mode === "economy")
      return fixture.actualFreeAgentIds
    return Object.keys(fixture.contracts)
  }, [fixture, mode])

  React.useEffect(() => {
    if (!playerIds.includes(selectedPlayerId)) {
      setSelectedPlayerId(playerIds[0] ?? "")
    }
  }, [playerIds, selectedPlayerId])

  React.useEffect(() => {
    if (!selectedPlayerId) return
    if (mode === "re-signing" || mode === "extension") {
      const contract = Object.values(fixture.contracts).find(
        (item) => item.playerId === selectedPlayerId
      )
      if (contract) setSelectedTeamId(contract.teamId)
    } else if (
      !selectedTeamId ||
      !Object.hasOwn(fixture.teams, selectedTeamId)
    ) {
      setSelectedTeamId(Object.keys(fixture.teams)[0] ?? "")
    }
  }, [fixture, mode, selectedPlayerId, selectedTeamId])

  const demand = React.useMemo(
    () =>
      selectedPlayerId
        ? calculateContractDemand(fixture, selectedPlayerId, modePhase(mode))
        : null,
    [fixture, mode, selectedPlayerId]
  )

  const selectedPlayer = selectedPlayerId
    ? fixture.players[selectedPlayerId]
    : null
  const selectedTeam = selectedTeamId
    ? fixture.teamContexts[selectedTeamId]
    : null

  const submitOffer = () => {
    if (!selectedPlayerId || !selectedTeamId) return
    const offer = createOffer(
      fixture,
      selectedPlayerId,
      selectedTeamId,
      mode,
      salaryMillions,
      years
    )
    const decision = evaluateContractOffer(fixture, offer)
    setScenario({
      version: 1,
      fixtureSeed: fixture.seed,
      playerId: selectedPlayerId,
      demand: demand!,
      offer,
      decision,
      playerMarketProfile: selectedPlayer?.marketPreferences ?? {
        salaryPriority: 58,
        securityPriority: 52,
        winningPriority: 50,
        rolePriority: 50,
        playingTimePriority: 50,
        marketSizePriority: 45,
        loyalty: 50,
        patience: 50,
        negotiationBaseline: 72,
      },
    })
    setStatus("Offer evaluated from the production market engine.")
  }

  const previewOffers = React.useMemo(() => {
    if (!selectedPlayerId || !demand) return []
    return Object.keys(fixture.teams)
      .slice(0, 3)
      .map((teamId, index) =>
        createOffer(
          fixture,
          selectedPlayerId,
          teamId,
          mode,
          (demand.projectedAnnualValue / 1_000_000) * (0.9 + index * 0.06),
          Math.max(
            1,
            Math.min(4, demand.preferredYears - (index === 0 ? 1 : 0))
          )
        )
      )
  }, [demand, fixture, mode, selectedPlayerId])

  const previewResults = React.useMemo(
    () => evaluateCompetitiveOffers(fixture, previewOffers),
    [fixture, previewOffers]
  )

  const rebuildFixture = () => {
    const next = createDefaultContractMarketFixture(
      seed.trim() || "market-rules-lab",
      {
        economy: createEconomySnapshot(1, draftEconomy),
        config: draftMarket,
      }
    )
    setFixture(next)
    setScenario(null)
    setMarketRun(null)
    setEconomyRun(null)
    setMarketProgress(null)
    setStatus("Fixture regenerated with the current lab settings.")
  }

  const updateSetting = (path: MarketNumericSettingPath, rawValue: number) => {
    const { economy, market } = updateMarketNumericSetting(
      draftEconomy,
      draftMarket,
      path,
      rawValue
    )
    setDraftEconomy(economy)
    setDraftMarket(market)
  }

  const runMarket = async () => {
    setRunning(true)
    setMarketProgress(null)
    setStatus("Running all AI teams through the three-round market…")
    try {
      const result = await runFreeAgencyInWorker(
        fixture,
        selectedTeamId || null,
        (progress) => {
          setMarketProgress(progress)
          setStatus(progress.label)
        }
      )
      setMarketRun(result)
      setStatus("Free agency completed in a worker with deterministic offers.")
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Free-agency run failed."
      )
    } finally {
      setRunning(false)
    }
  }

  const runEconomy = async () => {
    setRunning(true)
    setMarketProgress(null)
    setStatus("Running the economy harness…")
    try {
      setEconomyRun(await runEconomyInWorker(seed, 10, draftEconomy))
      setStatus(
        "Economy harness completed. This mode is intentionally market-only."
      )
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Economy run failed.")
    } finally {
      setRunning(false)
    }
  }

  const exportFixture = () => {
    downloadJson(
      `${fixture.seed}-market-fixture.json`,
      serializeContractMarketFixture(fixture)
    )
    setStatus(
      fixtureNeedsRegeneration
        ? "Fixture exported. Regenerate first to include the current draft settings."
        : "Fixture JSON exported for calibration or a failed-seed report."
    )
  }

  const exportScenario = () => {
    if (!scenario) return
    downloadJson(
      `${fixture.seed}-offer-scenario.json`,
      serializeContractMarketScenarioExport({
        schema: "foh-contract-market-offer-scenario",
        version: 1,
        fixture,
        view: viewContext,
        scenario,
      })
    )
    setStatus("Offer scenario JSON exported with demand and decision evidence.")
  }

  const exportFreeAgencyReport = () => {
    if (!marketRun) return
    downloadJson(
      `${fixture.seed}-free-agency-report.json`,
      serializeFreeAgencyRunExport({
        schema: "foh-contract-market-free-agency-report",
        version: 1,
        fixture,
        view: viewContext,
        result: marketRun,
      })
    )
    setStatus("Free-agency report JSON exported with all rounds and outcomes.")
  }

  const exportEconomyReport = () => {
    if (!economyRun) return
    downloadJson(
      `${seed.trim() || "market-rules-lab"}-economy-report.json`,
      serializeEconomyRunExport({
        schema: "foh-contract-market-economy-report",
        version: 1,
        config: draftEconomy,
        view: viewContext,
        result: economyRun,
      })
    )
    setStatus("Economy report JSON exported with its effective configuration.")
  }

  return (
    <main className="min-h-svh bg-background px-4 py-8 text-foreground sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto w-full max-w-7xl">
        <header className="border-b border-border pb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link
                to="/developer-labs"
                className="font-semibold text-foreground hover:underline"
              >
                V2 labs
              </Link>
              <span aria-hidden="true">/</span>
              <span>Market & rules</span>
            </div>
            <Button
              variant="outline"
              asChild
              className="min-h-10 gap-2 px-3.5 text-sm"
            >
              <Link to="/developer-labs">
                <HugeiconsIcon
                  icon={ArrowLeft01Icon}
                  strokeWidth={2}
                  aria-hidden="true"
                />
                Back to labs
              </Link>
            </Button>
          </div>
          <div className="mt-9 grid gap-7 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-semibold">
                <HugeiconsIcon
                  icon={PieChartIcon}
                  strokeWidth={1.8}
                  className="size-3.5"
                  aria-hidden="true"
                />
                Slice 0 · contract market
              </div>
              <h1 className="mt-4 max-w-4xl text-[2.3rem] leading-[1.05] font-semibold tracking-[-0.045em] sm:text-[3.4rem]">
                What does the player expect — and why?
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                A deterministic market workbench for UPV-backed demand, Bird
                rights, player-specific utility, legal offers, and salary-cap
                calibration.
              </p>
            </div>
            <div className="border-l border-border pl-5">
              <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                Lab state
              </p>
              <p className="mt-2 text-sm leading-6">{status}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline">Seeded</Badge>
                <Badge variant="outline">30 teams</Badge>
                <Badge variant="outline">1–4 years</Badge>
                <Badge variant="outline">Full Bird</Badge>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-6 pt-7 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-6">
            <Tabs value={mode} onValueChange={(value) => setMode(value as LabMode)}>
              <TabsList
                variant="line"
                className="grid h-auto w-full grid-cols-2 justify-start gap-1 rounded-none border-b border-border p-0 sm:grid-cols-5"
                aria-label="Market lab modes"
              >
                {modes.map((item) => (
                  <TabsTrigger
                    key={item.id}
                    value={item.id}
                    className="h-auto min-h-14 justify-start px-3 py-3 text-left"
                  >
                    <span className="block text-xs font-semibold">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-[0.68rem] leading-4 text-muted-foreground">
                      {item.detail}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {(mode === "offer" ||
              mode === "re-signing" ||
              mode === "extension") && (
              <>
                <Card>
                  <CardHeader className="border-b border-border">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <CardTitle>
                          {mode === "offer"
                            ? "Individual offer inspection"
                            : mode === "re-signing"
                              ? "Re-signing scenario"
                              : "Extension scenario"}
                        </CardTitle>
                        <CardDescription className="mt-1.5">
                          The same demand, legality, and utility modules power
                          all three contexts.
                        </CardDescription>
                      </div>
                      <Badge variant="outline">
                        Preseason value · provisional
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-5 pt-6 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="market-player">Player</Label>
                      <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
                        <SelectTrigger id="market-player" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {playerIds.slice(0, 180).map((playerId) => (
                            <SelectItem key={playerId} value={playerId}>
                              {formatName(fixture, playerId)} · OVR{" "}
                              {formatOverall(
                                getPlayerCurrentAbility(fixture.players[playerId])
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs leading-5 text-muted-foreground">
                        {selectedPlayer
                          ? `${selectedPlayer.age} years old · OVR ${formatOverall(getPlayerCurrentAbility(selectedPlayer))} · ${selectedPlayer.profile.role.primaryPosition} · ${qualityLabel(fixture.values[selectedPlayerId].rawValue)} market tier`
                          : "No player selected."}
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="market-team">Team context</Label>
                      <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                        <SelectTrigger id="market-team" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(fixture.teamContexts).map((team) => (
                            <SelectItem key={team.team.id} value={team.team.id}>
                              {team.team.name} · {team.strategy}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedTeam && (
                        <p className="text-xs leading-5 text-muted-foreground">
                          Payroll {formatMoney(selectedTeam.payroll)} · cap room{" "}
                          {formatMoney(selectedTeam.capRoom)} ·{" "}
                          {selectedTeam.lastSeasonWins} wins
                        </p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="market-salary">
                        First-year salary ($M)
                      </Label>
                      <Input
                        id="market-salary"
                        type="number"
                        min={0}
                        step={0.1}
                        value={salaryMillions}
                        onChange={(event) =>
                          setSalaryMillions(Number(event.target.value))
                        }
                      />
                      <p className="text-xs leading-5 text-muted-foreground">
                        Demand range:{" "}
                        {demand
                          ? `${formatMoney(demand.lowAnnualValue)}–${formatMoney(demand.highAnnualValue)}`
                          : "—"}
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="market-years">
                        Fully guaranteed years
                      </Label>
                      <Input
                        id="market-years"
                        type="number"
                        min={1}
                        max={4}
                        step={1}
                        value={years}
                        onChange={(event) =>
                          setYears(
                            Math.min(4, Math.max(1, Number(event.target.value)))
                          )
                        }
                      />
                      <p className="text-xs leading-5 text-muted-foreground">
                        Preferred term: {demand?.preferredYears ?? "—"} years
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:col-span-2">
                      <Button onClick={submitOffer}>Evaluate offer</Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          demand &&
                          setSalaryMillions(
                            Number(
                              (demand.projectedAnnualValue / 1_000_000).toFixed(
                                1
                              )
                            )
                          )
                        }
                      >
                        Use projected demand
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        No automatic counteroffers in this slice.
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                  <Card>
                    <CardHeader>
                      <CardTitle>Demand construction</CardTitle>
                      <CardDescription>
                        UPV remains the basketball signal. These are
                        market-specific adjustments layered on top.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <Metric
                          label="Baseline"
                          value={
                            demand
                              ? formatMoney(demand.baselineAnnualValue)
                              : "—"
                          }
                        />
                        <Metric
                          label="Projected"
                          value={
                            demand
                              ? formatMoney(demand.projectedAnnualValue)
                              : "—"
                          }
                        />
                        <Metric
                          label="Scarcity"
                          value={
                            demand
                              ? `${demand.scarcityMultiplier.toFixed(3)}×`
                              : "—"
                          }
                        />
                        <Metric
                          label="Tier"
                          value={demand?.comparableTier ?? "—"}
                        />
                      </div>
                      <div className="mt-6 divide-y divide-border border-y border-border">
                        {demand?.breakdown.map((item) => (
                          <div
                            key={item.label}
                            className="grid gap-1 py-3 sm:grid-cols-[10rem_6rem_minmax(0,1fr)] sm:items-center"
                          >
                            <span className="text-sm font-medium">
                              {item.label}
                            </span>
                            <span
                              className={`text-sm font-semibold tabular-nums ${item.direction === "negative" ? "text-muted-foreground" : ""}`}
                            >
                              {item.amount >= 0 ? "+" : "−"}
                              {formatMoney(Math.abs(item.amount))}
                            </span>
                            <span className="text-xs leading-5 text-muted-foreground">
                              {item.reason}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Offer result</CardTitle>
                      <CardDescription>
                        Player utility is comparable across offers for this
                        player only.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {scenario ? (
                        <div className="space-y-5">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <DecisionBadge
                              decision={scenario.decision.decision}
                            />
                            <span className="text-sm font-semibold tabular-nums">
                              {scenario.decision.utility.total.toFixed(1)}{" "}
                              utility
                            </span>
                          </div>
                          <p className="text-sm leading-6 text-muted-foreground">
                            {scenario.decision.summary}
                          </p>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <Metric
                              label="Legal"
                              value={
                                scenario.decision.legal.valid
                                  ? "Valid"
                                  : "Invalid"
                              }
                            />
                            <Metric
                              label="Mechanism"
                              value={scenario.decision.legal.mechanism}
                            />
                            <Metric
                              label="Willingness"
                              value={`${scenario.decision.willingnessAfter.toFixed(0)}/100`}
                            />
                            <Metric
                              label="Payroll"
                              value={formatMoney(
                                scenario.decision.legal.projectedPayroll
                              )}
                            />
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {scenario.decision.reasonCodes.map((code) => (
                              <Badge key={code} variant="outline">
                                {code.replaceAll("-", " ")}
                              </Badge>
                            ))}
                          </div>
                          {!scenario.decision.legal.valid && (
                            <p className="border-l-2 border-destructive pl-3 text-xs leading-5 text-destructive">
                              {scenario.decision.legal.reasons.join(" ")}
                            </p>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={exportScenario}
                          >
                            Export offer scenario
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm leading-6 text-muted-foreground">
                          Submit an offer to see the player’s decision, legal
                          mechanism, utility breakdown, and willingness
                          movement.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Market comparison</CardTitle>
                    <CardDescription>
                      Illustrative offers use the same player profile and show
                      why a higher qualifying utility wins.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Team</TableHead>
                          <TableHead>Offer</TableHead>
                          <TableHead>Utility</TableHead>
                          <TableHead>Decision</TableHead>
                          <TableHead>Mechanism</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewResults.map((result) => (
                          <TableRow key={result.offerId}>
                            <TableCell className="font-medium">
                              {fixture.teams[result.teamId].name}
                            </TableCell>
                            <TableCell>
                              {formatMoney(
                                getOfferSalary(previewOffers, result.offerId)
                              )}
                            </TableCell>
                            <TableCell className="font-semibold tabular-nums">
                              {result.utility.total.toFixed(1)}
                            </TableCell>
                            <TableCell>
                              <DecisionBadge decision={result.decision} />
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {result.legal.mechanism}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}

            {mode === "free-agency" && (
              <Card>
                <CardHeader>
                  <CardTitle>Three-round free agency</CardTitle>
                  <CardDescription>
                    Automated mode resolves every AI team through the configured
                    rounds. The selected team is an observer context, not a
                    controlled team.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="observer-team">
                        Selected team context
                      </Label>
                      <Select
                        value={selectedTeamId || undefined}
                        onValueChange={setSelectedTeamId}
                      >
                        <SelectTrigger id="observer-team" className="w-full">
                          <SelectValue placeholder="No selected team" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(fixture.teamContexts).map((team) => (
                            <SelectItem key={team.team.id} value={team.team.id}>
                              {team.team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={runMarket} disabled={running}>
                      {running ? "Running…" : "Run full market"}
                    </Button>
                    {marketRun ? (
                      <Button
                        variant="outline"
                        onClick={exportFreeAgencyReport}
                      >
                        Export market report
                      </Button>
                    ) : null}
                  </div>
                  {marketProgress ? (
                    <div
                      className="mt-4 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground"
                      role="status"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>{marketProgress.label}</span>
                        <span className="tabular-nums">
                          {marketProgress.availablePlayers} players available ·{" "}
                          {marketProgress.offerCount} offers
                        </span>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary transition-[width] duration-200"
                          style={{
                            width: `${Math.max(8, Math.round(((marketProgress.round ?? 0) / Math.max(1, marketProgress.totalRounds)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                  {marketRun ? (
                    <FreeAgencyReportPanel
                      fixture={fixture}
                      marketRun={marketRun}
                      selectedTeamId={selectedTeamId}
                    />
                  ) : null}
                </CardContent>
              </Card>
            )}

            {mode === "economy" && (
              <Card>
                <CardHeader>
                  <CardTitle>Multi-season economy harness</CardTitle>
                  <CardDescription>
                    Cap, tax, maximum, minimum, and rookie-scale growth across
                    ten seasons. This is intentionally not yet pretending to be
                    the complete league loop.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={runEconomy} disabled={running}>
                      {running ? "Running…" : "Run ten seasons"}
                    </Button>
                    {economyRun ? (
                      <Button variant="outline" onClick={exportEconomyReport}>
                        Export economy report
                      </Button>
                    ) : null}
                  </div>
                  {economyRun && (
                    <div className="mt-7">
                      <div className="mb-5 border-l-2 border-foreground pl-3 text-sm leading-6 text-muted-foreground">
                        {economyRun.harnessNote}
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Season</TableHead>
                            <TableHead>Soft cap</TableHead>
                            <TableHead>Tax line</TableHead>
                            <TableHead>Maximum</TableHead>
                            <TableHead>Minimum</TableHead>
                            <TableHead>Rookie slot 1</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {economyRun.seasons.map((season) => (
                            <TableRow key={season.season}>
                              <TableCell>{season.season}</TableCell>
                              <TableCell>
                                {formatMoney(season.softCap)}
                              </TableCell>
                              <TableCell>
                                {formatMoney(season.taxLine)}
                              </TableCell>
                              <TableCell>
                                {formatMoney(season.maximumSalary)}
                              </TableCell>
                              <TableCell>
                                {formatMoney(season.minimumSalary)}
                              </TableCell>
                              <TableCell>
                                {formatMoney(season.rookieScaleTop)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <aside className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Fixture controls</CardTitle>
                <CardDescription>
                  {fixtureNeedsRegeneration
                    ? "Draft settings are not in the exported fixture yet. Regenerate to apply them."
                    : "Settings are serialized into the fixture; regenerate to apply them."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="market-seed">Deterministic seed</Label>
                  <Input
                    id="market-seed"
                    value={seed}
                    onChange={(event) => setSeed(event.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={rebuildFixture}>
                    Regenerate fixture
                  </Button>
                  <Button variant="outline" onClick={exportFixture}>
                    Export fixture
                  </Button>
                </div>
                <div className="border-t border-border pt-4">
                  <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                    Fixture scale
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Metric
                      label="Players"
                      value={String(Object.keys(fixture.players).length)}
                    />
                    <Metric
                      label="Actual FA"
                      value={String(fixture.actualFreeAgentIds.length)}
                    />
                    <Metric
                      label="Expiring view"
                      value={String(fixture.projectedFreeAgency.entries.length)}
                    />
                    <Metric
                      label="Cap"
                      value={formatMoney(fixture.economy.softCap)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Calibration settings</CardTitle>
                <CardDescription>
                  User-facing concepts are backed by bounded typed values in the
                  fixture.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {MARKET_SETTING_DESCRIPTORS.map((descriptor) => {
                  const raw = getMarketNumericSetting(
                    draftEconomy,
                    draftMarket,
                    descriptor.path
                  )
                  const display = descriptor.unit === "%" ? raw * 100 : raw
                  const step =
                    descriptor.unit === "%"
                      ? descriptor.step * 100
                      : descriptor.step
                  return (
                    <div
                      key={descriptor.path}
                      className="grid gap-1.5 border-b border-border pb-3 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor={`setting-${descriptor.path}`}>
                          {descriptor.label}
                        </Label>
                        <span className="text-[0.68rem] text-muted-foreground tabular-nums">
                          {descriptor.unit === "$"
                            ? formatMoney(raw)
                            : descriptor.unit === "%"
                              ? `${display.toFixed(1)}%`
                              : display}
                        </span>
                      </div>
                      <Input
                        id={`setting-${descriptor.path}`}
                        type="number"
                        min={
                          descriptor.unit === "%"
                            ? descriptor.min * 100
                            : descriptor.min
                        }
                        max={
                          descriptor.unit === "%"
                            ? descriptor.max * 100
                            : descriptor.max
                        }
                        step={step}
                        value={display}
                        onChange={(event) =>
                          updateSetting(
                            descriptor.path,
                            descriptor.unit === "%"
                              ? Number(event.target.value) / 100
                              : Number(event.target.value)
                          )
                        }
                      />
                      <p className="text-[0.68rem] leading-4 text-muted-foreground">
                        {descriptor.description}
                      </p>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
            <div className="border-l-2 border-border pl-3 text-xs leading-5 text-muted-foreground">
              Initial rules slice: soft cap, tax line, cap room, minimum
              contracts, Full/Early/Non-Bird rights, and a retained hard-cap
              state. Exceptions, options, and apron rules remain deferred.
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
