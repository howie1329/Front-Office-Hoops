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
  calculateContractDemand,
  createDefaultContractMarketFixture,
  createEconomySnapshot,
  evaluateCompetitiveOffers,
  evaluateContractOffer,
  getMarketNumericSetting,
  MARKET_SETTING_DESCRIPTORS,
  STANDARD_CONTRACT_MARKET_CONFIG,
  STANDARD_ECONOMY_CONFIG,
  updateMarketNumericSetting,
} from "@workspace/sim-v2"
import type {
  EconomySimulationResult,
  FreeAgencySimulationResult,
  MarketNumericSettingPath,
} from "@workspace/sim-v2"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
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
  { id: "offer", label: "Offer inspector", detail: "Demand, utility, legality" },
  { id: "re-signing", label: "Re-signing", detail: "Rights and continuity" },
  { id: "extension", label: "Extension", detail: "Forecasted future value" },
  { id: "free-agency", label: "Free agency", detail: "Three-round market" },
  { id: "economy", label: "Economy", detail: "Multi-season harness" },
]

function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return "—"
  return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}M`
}

function formatName(fixture: ContractMarketFixture, playerId: string): string {
  const player = fixture.players[playerId]
  return [player.identity.firstName, player.identity.lastName]
    .filter(Boolean)
    .join(" ") || playerId.split(":").at(-1) || playerId
}

function qualityLabel(value: number): string {
  return value >= 820 ? "Star" : value >= 700 ? "Starter" : value >= 570 ? "Rotation" : "Depth"
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
  const salary = Math.round(Math.max(0, salaryMillions) * 1_000_000 / 10_000) * 10_000
  return {
    id: `${fixture.seed}:lab-offer:${playerId}:${teamId}:${mode}`,
    playerId,
    teamId,
    season: fixture.season,
    phase: modePhase(mode),
    round: 1,
    annualSalary: Array.from({ length: years }, (_, index) =>
      Math.round(
        (salary * (1 + fixture.economy.config.standardRaiseRate) ** index) / 10_000
      ) * 10_000
    ),
    years,
    fullyGuaranteed: true,
    source: "user",
  }
}

function getOfferSalary(offers: Array<ContractOffer>, offerId: string): number {
  const offer = offers.find((candidate) => candidate.id === offerId)
  return offer ? offer.annualSalary[0] ?? 0 : 0
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
  const variant = decision === "accept" ? "default" : decision === "wait" ? "outline" : "secondary"
  return <Badge variant={variant}>{decision.replaceAll("-", " ")}</Badge>
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
  const [draftMarket, setDraftMarket] = React.useState<ContractMarketConfig>(() =>
    structuredClone(STANDARD_CONTRACT_MARKET_CONFIG)
  )
  const [selectedPlayerId, setSelectedPlayerId] = React.useState("")
  const [selectedTeamId, setSelectedTeamId] = React.useState("")
  const [salaryMillions, setSalaryMillions] = React.useState(24)
  const [years, setYears] = React.useState(4)
  const [scenario, setScenario] = React.useState<ContractMarketScenarioResult | null>(null)
  const [marketRun, setMarketRun] = React.useState<FreeAgencySimulationResult | null>(null)
  const [economyRun, setEconomyRun] = React.useState<EconomySimulationResult | null>(null)
  const [running, setRunning] = React.useState(false)
  const [status, setStatus] = React.useState("Ready for a deterministic offer test.")

  const playerIds = React.useMemo(() => {
    if (mode === "offer") return fixture.actualFreeAgentIds
    if (mode === "free-agency" || mode === "economy") return fixture.actualFreeAgentIds
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
    } else if (!selectedTeamId || !Object.hasOwn(fixture.teams, selectedTeamId)) {
      setSelectedTeamId(Object.keys(fixture.teams)[0] ?? "")
    }
  }, [fixture, mode, selectedPlayerId, selectedTeamId])

  const demand = React.useMemo(
    () => (selectedPlayerId ? calculateContractDemand(fixture, selectedPlayerId, modePhase(mode)) : null),
    [fixture, mode, selectedPlayerId]
  )

  const selectedPlayer = selectedPlayerId ? fixture.players[selectedPlayerId] : null
  const selectedTeam = selectedTeamId ? fixture.teamContexts[selectedTeamId] : null

  const submitOffer = () => {
    if (!selectedPlayerId || !selectedTeamId) return
    const offer = createOffer(fixture, selectedPlayerId, selectedTeamId, mode, salaryMillions, years)
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
    return Object.keys(fixture.teams).slice(0, 3).map((teamId, index) =>
      createOffer(
        fixture,
        selectedPlayerId,
        teamId,
        mode,
        (demand.projectedAnnualValue / 1_000_000) * (0.9 + index * 0.06),
        Math.max(1, Math.min(4, demand.preferredYears - (index === 0 ? 1 : 0)))
      )
    )
  }, [demand, fixture, mode, selectedPlayerId])

  const previewResults = React.useMemo(
    () => evaluateCompetitiveOffers(fixture, previewOffers),
    [fixture, previewOffers]
  )

  const rebuildFixture = () => {
    const next = createDefaultContractMarketFixture(seed.trim() || "market-rules-lab", {
      economy: createEconomySnapshot(1, draftEconomy),
      config: draftMarket,
    })
    setFixture(next)
    setScenario(null)
    setMarketRun(null)
    setEconomyRun(null)
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
    setStatus("Running all AI teams through the three-round market…")
    try {
      setMarketRun(await runFreeAgencyInWorker(fixture, selectedTeamId || null))
      setStatus("Free agency completed in a worker with deterministic offers.")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Free-agency run failed.")
    } finally {
      setRunning(false)
    }
  }

  const runEconomy = async () => {
    setRunning(true)
    setStatus("Running the economy harness…")
    try {
      setEconomyRun(await runEconomyInWorker(seed, 10, draftEconomy))
      setStatus("Economy harness completed. This mode is intentionally market-only.")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Economy run failed.")
    } finally {
      setRunning(false)
    }
  }

  const exportFixture = () => {
    const blob = new Blob([JSON.stringify(fixture, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${fixture.seed}-market-fixture.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setStatus("Fixture JSON exported for calibration or a failed-seed report.")
  }

  return (
    <main className="min-h-svh bg-background px-4 py-8 text-foreground sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto w-full max-w-7xl">
        <header className="border-b border-border pb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/developer-labs" className="font-semibold text-foreground hover:underline">V2 labs</Link>
              <span aria-hidden="true">/</span>
              <span>Market & rules</span>
            </div>
            <Button variant="outline" asChild className="min-h-10 gap-2 px-3.5 text-sm">
              <Link to="/developer-labs">
                <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} aria-hidden="true" />
                Back to labs
              </Link>
            </Button>
          </div>
          <div className="mt-9 grid gap-7 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-semibold">
                <HugeiconsIcon icon={PieChartIcon} strokeWidth={1.8} className="size-3.5" aria-hidden="true" />
                Slice 0 · contract market
              </div>
              <h1 className="mt-4 max-w-4xl text-[2.3rem] leading-[1.05] font-semibold tracking-[-0.045em] sm:text-[3.4rem]">
                What does the player expect — and why?
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                A deterministic market workbench for UPV-backed demand, Bird rights,
                player-specific utility, legal offers, and salary-cap calibration.
              </p>
            </div>
            <div className="border-l border-border pl-5">
              <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">Lab state</p>
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
            <nav className="grid gap-2 sm:grid-cols-5" aria-label="Market lab modes">
              {modes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  className={`rounded-md border px-3 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring ${mode === item.id ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-muted"}`}
                >
                  <span className="block text-xs font-semibold">{item.label}</span>
                  <span className={`mt-1 block text-[0.68rem] leading-4 ${mode === item.id ? "text-background/70" : "text-muted-foreground"}`}>{item.detail}</span>
                </button>
              ))}
            </nav>

            {(mode === "offer" || mode === "re-signing" || mode === "extension") && (
              <>
                <Card>
                  <CardHeader className="border-b border-border">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <CardTitle>{mode === "offer" ? "Individual offer inspection" : mode === "re-signing" ? "Re-signing scenario" : "Extension scenario"}</CardTitle>
                        <CardDescription className="mt-1.5">The same demand, legality, and utility modules power all three contexts.</CardDescription>
                      </div>
                      <Badge variant="outline">Preseason value · provisional</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-5 pt-6 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="market-player">Player</Label>
                      <select id="market-player" value={selectedPlayerId} onChange={(event) => setSelectedPlayerId(event.target.value)} className="h-9 rounded-md border border-input bg-input/20 px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {playerIds.slice(0, 180).map((playerId) => <option key={playerId} value={playerId}>{formatName(fixture, playerId)}</option>)}
                      </select>
                      <p className="text-xs leading-5 text-muted-foreground">{selectedPlayer ? `${selectedPlayer.age} years old · ${selectedPlayer.profile.role.primaryPosition} · ${qualityLabel(fixture.values[selectedPlayerId].rawValue)}` : "No player selected."}</p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="market-team">Team context</Label>
                      <select id="market-team" value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)} className="h-9 rounded-md border border-input bg-input/20 px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {Object.values(fixture.teamContexts).map((team) => <option key={team.team.id} value={team.team.id}>{team.team.name} · {team.strategy}</option>)}
                      </select>
                      {selectedTeam && <p className="text-xs leading-5 text-muted-foreground">Payroll {formatMoney(selectedTeam.payroll)} · cap room {formatMoney(selectedTeam.capRoom)} · {selectedTeam.lastSeasonWins} wins</p>}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="market-salary">First-year salary ($M)</Label>
                      <Input id="market-salary" type="number" min={0} step={0.1} value={salaryMillions} onChange={(event) => setSalaryMillions(Number(event.target.value))} />
                      <p className="text-xs leading-5 text-muted-foreground">Demand range: {demand ? `${formatMoney(demand.lowAnnualValue)}–${formatMoney(demand.highAnnualValue)}` : "—"}</p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="market-years">Fully guaranteed years</Label>
                      <Input id="market-years" type="number" min={1} max={4} step={1} value={years} onChange={(event) => setYears(Math.min(4, Math.max(1, Number(event.target.value))))} />
                      <p className="text-xs leading-5 text-muted-foreground">Preferred term: {demand?.preferredYears ?? "—"} years</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:col-span-2">
                      <Button onClick={submitOffer}>Evaluate offer</Button>
                      <Button variant="outline" onClick={() => demand && setSalaryMillions(Number((demand.projectedAnnualValue / 1_000_000).toFixed(1)))}>Use projected demand</Button>
                      <span className="text-xs text-muted-foreground">No automatic counteroffers in this slice.</span>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                  <Card>
                    <CardHeader>
                      <CardTitle>Demand construction</CardTitle>
                      <CardDescription>UPV remains the basketball signal. These are market-specific adjustments layered on top.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <Metric label="Baseline" value={demand ? formatMoney(demand.baselineAnnualValue) : "—"} />
                        <Metric label="Projected" value={demand ? formatMoney(demand.projectedAnnualValue) : "—"} />
                        <Metric label="Scarcity" value={demand ? `${demand.scarcityMultiplier.toFixed(3)}×` : "—"} />
                        <Metric label="Tier" value={demand?.comparableTier ?? "—"} />
                      </div>
                      <div className="mt-6 divide-y divide-border border-y border-border">
                        {demand?.breakdown.map((item) => <div key={item.label} className="grid gap-1 py-3 sm:grid-cols-[10rem_6rem_minmax(0,1fr)] sm:items-center"><span className="text-sm font-medium">{item.label}</span><span className={`text-sm font-semibold tabular-nums ${item.direction === "negative" ? "text-muted-foreground" : ""}`}>{item.amount >= 0 ? "+" : "−"}{formatMoney(Math.abs(item.amount))}</span><span className="text-xs leading-5 text-muted-foreground">{item.reason}</span></div>)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Offer result</CardTitle>
                      <CardDescription>Player utility is comparable across offers for this player only.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {scenario ? <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><DecisionBadge decision={scenario.decision.decision} /><span className="text-sm font-semibold tabular-nums">{scenario.decision.utility.total.toFixed(1)} utility</span></div><p className="text-sm leading-6 text-muted-foreground">{scenario.decision.summary}</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Legal" value={scenario.decision.legal.valid ? "Valid" : "Invalid"} /><Metric label="Mechanism" value={scenario.decision.legal.mechanism} /><Metric label="Willingness" value={`${scenario.decision.willingnessAfter.toFixed(0)}/100`} /><Metric label="Payroll" value={formatMoney(scenario.decision.legal.projectedPayroll)} /></div><div className="flex flex-wrap gap-1.5">{scenario.decision.reasonCodes.map((code) => <Badge key={code} variant="outline">{code.replaceAll("-", " ")}</Badge>)}</div>{!scenario.decision.legal.valid && <p className="border-l-2 border-destructive pl-3 text-xs leading-5 text-destructive">{scenario.decision.legal.reasons.join(" ")}</p>}</div> : <p className="text-sm leading-6 text-muted-foreground">Submit an offer to see the player’s decision, legal mechanism, utility breakdown, and willingness movement.</p>}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Market comparison</CardTitle>
                    <CardDescription>Illustrative offers use the same player profile and show why a higher qualifying utility wins.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table><TableHeader><TableRow><TableHead>Team</TableHead><TableHead>Offer</TableHead><TableHead>Utility</TableHead><TableHead>Decision</TableHead><TableHead>Mechanism</TableHead></TableRow></TableHeader><TableBody>{previewResults.map((result) => <TableRow key={result.offerId}><TableCell className="font-medium">{fixture.teams[result.teamId].name}</TableCell><TableCell>{formatMoney(getOfferSalary(previewOffers, result.offerId))}</TableCell><TableCell className="font-semibold tabular-nums">{result.utility.total.toFixed(1)}</TableCell><TableCell><DecisionBadge decision={result.decision} /></TableCell><TableCell className="text-muted-foreground">{result.legal.mechanism}</TableCell></TableRow>)}</TableBody></Table>
                  </CardContent>
                </Card>
              </>
            )}

            {mode === "free-agency" && <Card><CardHeader><CardTitle>Three-round free agency</CardTitle><CardDescription>All AI teams use the same fixture, legality checks, and player utility. The selected team is an observer context in this run.</CardDescription></CardHeader><CardContent><div className="flex flex-wrap items-end gap-3"><div className="grid gap-2"><Label htmlFor="observer-team">Observer team</Label><select id="observer-team" value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)} className="h-9 rounded-md border border-input bg-input/20 px-2 text-sm"><option value="">No selected team</option>{Object.values(fixture.teamContexts).map((team) => <option key={team.team.id} value={team.team.id}>{team.team.name}</option>)}</select></div><Button onClick={runMarket} disabled={running}>{running ? "Running…" : "Run full market"}</Button></div>{marketRun && <div className="mt-7 space-y-5"><div className="grid grid-cols-2 gap-4 sm:grid-cols-4"><Metric label="Signed" value={String(marketRun.signedContracts.length)} /><Metric label="Unsigned" value={String(marketRun.unsignedPlayerIds.length)} /><Metric label="Rounds used" value={String(marketRun.rounds.length)} /><Metric label="Offers" value={String(marketRun.rounds.reduce((sum, round) => sum + round.offers.length, 0))} /></div>{marketRun.rounds.map((round) => <div key={round.round} className="border-t border-border pt-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Round {round.round}</p><Badge variant="outline">{round.acceptedPlayerIds.length} signed</Badge></div><p className="mt-1 text-xs text-muted-foreground">{round.offers.length} legal/attempted offers · {round.decisions.filter((item) => item.decision === "wait").length} waiting decisions</p></div>)}</div>}</CardContent></Card>}

            {mode === "economy" && <Card><CardHeader><CardTitle>Multi-season economy harness</CardTitle><CardDescription>Cap, tax, maximum, minimum, and rookie-scale growth across ten seasons. This is intentionally not yet pretending to be the complete league loop.</CardDescription></CardHeader><CardContent><Button onClick={runEconomy} disabled={running}>{running ? "Running…" : "Run ten seasons"}</Button>{economyRun && <div className="mt-7"><div className="mb-5 border-l-2 border-foreground pl-3 text-sm leading-6 text-muted-foreground">{economyRun.harnessNote}</div><Table><TableHeader><TableRow><TableHead>Season</TableHead><TableHead>Soft cap</TableHead><TableHead>Tax line</TableHead><TableHead>Maximum</TableHead><TableHead>Minimum</TableHead><TableHead>Rookie slot 1</TableHead></TableRow></TableHeader><TableBody>{economyRun.seasons.map((season) => <TableRow key={season.season}><TableCell>{season.season}</TableCell><TableCell>{formatMoney(season.softCap)}</TableCell><TableCell>{formatMoney(season.taxLine)}</TableCell><TableCell>{formatMoney(season.maximumSalary)}</TableCell><TableCell>{formatMoney(season.minimumSalary)}</TableCell><TableCell>{formatMoney(season.rookieScaleTop)}</TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card>}
          </div>

          <aside className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Fixture controls</CardTitle><CardDescription>Settings are serialized into the fixture; regenerate to apply them.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2"><Label htmlFor="market-seed">Deterministic seed</Label><Input id="market-seed" value={seed} onChange={(event) => setSeed(event.target.value)} /></div>
                <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={rebuildFixture}>Regenerate fixture</Button><Button variant="outline" onClick={exportFixture}>Export JSON</Button></div>
                <div className="border-t border-border pt-4"><p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">Fixture scale</p><div className="mt-3 grid grid-cols-2 gap-3"><Metric label="Players" value={String(Object.keys(fixture.players).length)} /><Metric label="Actual FA" value={String(fixture.actualFreeAgentIds.length)} /><Metric label="Expiring view" value={String(fixture.projectedFreeAgency.entries.length)} /><Metric label="Cap" value={formatMoney(fixture.economy.softCap)} /></div></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Calibration settings</CardTitle><CardDescription>User-facing concepts are backed by bounded typed values in the fixture.</CardDescription></CardHeader>
              <CardContent className="space-y-4">{MARKET_SETTING_DESCRIPTORS.slice(0, 7).map((descriptor) => { const raw = getMarketNumericSetting(draftEconomy, draftMarket, descriptor.path); const display = descriptor.unit === "%" ? raw * 100 : raw; const step = descriptor.unit === "%" ? descriptor.step * 100 : descriptor.step; return <div key={descriptor.path} className="grid gap-1.5 border-b border-border pb-3 last:border-0 last:pb-0"><div className="flex items-center justify-between gap-3"><Label htmlFor={`setting-${descriptor.path}`}>{descriptor.label}</Label><span className="text-[0.68rem] tabular-nums text-muted-foreground">{descriptor.unit === "$" ? formatMoney(raw) : descriptor.unit === "%" ? `${display.toFixed(1)}%` : display}</span></div><Input id={`setting-${descriptor.path}`} type="number" min={descriptor.unit === "%" ? descriptor.min * 100 : descriptor.min} max={descriptor.unit === "%" ? descriptor.max * 100 : descriptor.max} step={step} value={display} onChange={(event) => updateSetting(descriptor.path, descriptor.unit === "%" ? Number(event.target.value) / 100 : Number(event.target.value))} /><p className="text-[0.68rem] leading-4 text-muted-foreground">{descriptor.description}</p></div> })}</CardContent>
            </Card>
            <div className="border-l-2 border-border pl-3 text-xs leading-5 text-muted-foreground">Initial rules slice: soft cap, tax line, cap room, minimum contracts, Full/Early/Non-Bird rights, and a retained hard-cap state. Exceptions, options, and apron rules remain deferred.</div>
          </aside>
        </div>
      </div>
    </main>
  )
}
