import { ArrowLeft01Icon, Target01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { createFileRoute, Link } from "@tanstack/react-router"
import type {
  DraftDecisionResult,
  DraftScoutTier,
  DraftTeamMode,
} from "@workspace/domain-v2"
import {
  serializeDraftDecisionExport,
} from "@workspace/league-schema"
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
import * as React from "react"

import {
  runDraftCalibrationInWorker,
  runDraftDecisionInWorker,
} from "@/lib/draftDecisionWorker"

export const Route = createFileRoute("/developer-labs/draft-decision")({
  component: DraftDecisionLabPage,
})

function formatName(result: DraftDecisionResult, playerId: string): string {
  const player = result.fixture.players[playerId]
  return [player.identity.firstName, player.identity.lastName].filter(Boolean).join(" ") || playerId
}

function downloadJson(filename: string, content: string): void {
  const blob = new Blob([content], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l border-border pl-3">
      <p className="text-[0.65rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function DraftDecisionLabPage() {
  const [seed, setSeed] = React.useState("draft-lab-001")
  const [result, setResult] = React.useState<DraftDecisionResult | null>(null)
  const [selectedTeamId, setSelectedTeamId] = React.useState("team:01")
  const [scoutTier, setScoutTier] = React.useState<DraftScoutTier>("average")
  const [teamMode, setTeamMode] = React.useState<DraftTeamMode>("balanced")
  const [userFirstPick, setUserFirstPick] = React.useState("")
  const [progress, setProgress] = React.useState("Ready")
  const [error, setError] = React.useState<string | null>(null)
  const [calibration, setCalibration] = React.useState<{
    legalRunRate: number
    scoutError: Record<string, number>
  } | null>(null)

  const run = React.useCallback(async () => {
    setError(null)
    setProgress("Generating class, reports, and boards…")
    try {
      const next = await runDraftDecisionInWorker({
        seed,
        userTeamId: selectedTeamId,
        scoutTiers: { [selectedTeamId]: scoutTier },
        teamModes: { [selectedTeamId]: teamMode },
        userPicks: userFirstPick ? { 1: userFirstPick } : undefined,
      })
      setResult(next)
      setProgress(`${next.picks.length} legal selections simulated`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Draft run failed.")
      setProgress("Run failed")
    }
  }, [seed, selectedTeamId, userFirstPick])

  const runCalibration = React.useCallback(async () => {
    setError(null)
    setProgress("Running 10 deterministic draft batches…")
    try {
      const report = await runDraftCalibrationInWorker(seed, 10, undefined, (next) => {
        setProgress(`${next.completed}/${next.total} calibration runs`)
      })
      setCalibration({
        legalRunRate: report.metrics.legalRunRate.mean,
        scoutError: Object.fromEntries(Object.entries(report.metrics.averageScoutAbsoluteError).map(([tier, value]) => [tier, value.mean])),
      })
      setProgress("Calibration complete")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Calibration failed.")
      setProgress("Calibration failed")
    }
  }, [seed])

  const selectedBoard = result?.fixture.boards[selectedTeamId]
  const selectedProfile = result?.fixture.teamProfiles[selectedTeamId]
  const available = new Set(result?.picks.map((pick) => pick.playerId) ?? [])

  return (
    <main className="min-h-svh bg-background px-4 py-8 text-foreground sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto w-full max-w-7xl">
        <header className="border-b border-border pb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><span className="font-semibold text-foreground">V2</span><span>/</span><span>Developer labs</span><span>/</span><span>Draft & decision</span></p>
            <Button variant="outline" asChild className="min-h-10 gap-2 px-3.5 text-sm"><Link to="/developer-labs"><HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} aria-hidden="true" />Back to labs</Link></Button>
          </div>
          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
            <div>
              <div className="flex items-center gap-3"><HugeiconsIcon icon={Target01Icon} size={22} strokeWidth={1.8} aria-hidden="true" /><p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">Decision lab / E10</p></div>
              <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">Draft with imperfect information.</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">A deterministic 75-player class, fixed pre-draft reports, private team boards, two-round selection, rookie contracts, and a five-year outcome check.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm lg:border-t-0 lg:border-l lg:pl-6"><Metric label="Eligible" value="75" /><Metric label="Selections" value="60" /><Metric label="Rounds" value="2" /><Metric label="Reports" value="Fixed" /></div>
          </div>
        </header>

        <section className="mt-8 grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader><CardTitle>Run controls</CardTitle><CardDescription>Change the seed or inspect a different team’s private board.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2"><Label htmlFor="draft-seed">Seed</Label><Input id="draft-seed" value={seed} onChange={(event) => setSeed(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="draft-team">Selected team</Label><select id="draft-team" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)}>{Array.from({ length: 30 }, (_, index) => { const id = `team:${String(index + 1).padStart(2, "0")}`; return <option key={id} value={id}>{id}</option> })}</select></div>
              <div className="space-y-2"><Label htmlFor="scout-tier">Head scout quality</Label><select id="scout-tier" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={scoutTier} onChange={(event) => setScoutTier(event.target.value as DraftScoutTier)}><option value="weak">Weak</option><option value="average">Average</option><option value="strong">Strong</option></select></div>
              <div className="space-y-2"><Label htmlFor="team-mode">Team mode</Label><select id="team-mode" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={teamMode} onChange={(event) => setTeamMode(event.target.value as DraftTeamMode)}><option value="contender">Contender</option><option value="balanced">Balanced</option><option value="rebuilding">Rebuilding</option></select></div>
              <div className="space-y-2"><Label htmlFor="first-pick">User first pick</Label><select id="first-pick" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={userFirstPick} onChange={(event) => setUserFirstPick(event.target.value)}><option value="">Use generated board</option>{selectedBoard?.entries.slice(0, 20).map((entry) => <option key={entry.playerId} value={entry.playerId}>{entry.rank}. {formatName(result as DraftDecisionResult, entry.playerId)}</option>)}</select></div>
              <div className="grid gap-2"><Button onClick={() => void run()}>Run draft</Button><Button variant="outline" onClick={() => void runCalibration()}>Run 10-case calibration</Button></div>
              <p className="text-xs text-muted-foreground" aria-live="polite">{progress}</p>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </CardContent>
          </Card>

          <div className="space-y-5">
            {!result ? <Card><CardContent className="flex min-h-72 items-center justify-center text-center text-sm text-muted-foreground">Run the lab to generate the shared mock, team reports, boards, picks, and outcomes.</CardContent></Card> : <>
              <div className="grid gap-3 sm:grid-cols-4"><Card><CardContent className="pt-5"><Metric label="Legal run" value={result.diagnostics.legal ? "Pass" : "Fail"} /></CardContent></Card><Card><CardContent className="pt-5"><Metric label="Selected" value={`${result.picks.length}/${result.fixture.config.selections}`} /></CardContent></Card><Card><CardContent className="pt-5"><Metric label="Scout tier" value={selectedProfile?.scoutTier ?? "—"} /></CardContent></Card><Card><CardContent className="pt-5"><Metric label="Team mode" value={selectedProfile?.mode ?? "—"} /></CardContent></Card></div>
              <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{selectedTeamId} private board</CardTitle><CardDescription>Board generated before the draft; report estimates remain fixed while players come off the board.</CardDescription></div><Badge variant="outline">{selectedProfile?.overrideSource ?? "derived"} profile</Badge></div></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="py-2 pr-3">Rank</th><th className="py-2 pr-3">Prospect</th><th className="py-2 pr-3">Total</th><th className="py-2 pr-3">Current</th><th className="py-2 pr-3">Upside</th><th className="py-2 pr-3">Need</th><th className="py-2">Why</th></tr></thead><tbody>{selectedBoard?.entries.slice(0, 12).map((entry) => <tr key={entry.playerId} className="border-b border-border/60"><td className="py-3 pr-3 tabular-nums">{entry.rank}</td><td className="py-3 pr-3 font-medium">{formatName(result, entry.playerId)}{available.has(entry.playerId) ? null : <span className="ml-2 text-xs text-muted-foreground">selected</span>}</td><td className="py-3 pr-3 tabular-nums">{entry.score.total}</td><td className="py-3 pr-3 tabular-nums">{entry.score.currentAbility}</td><td className="py-3 pr-3 tabular-nums">{entry.score.potential}</td><td className="py-3 pr-3 tabular-nums">{entry.score.need}</td><td className="max-w-sm py-3 text-xs text-muted-foreground">{entry.rationale}</td></tr>)}</tbody></table></div></CardContent></Card>
              <div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle>Draft results</CardTitle><CardDescription>AI follows its team board. User picks are legal overrides.</CardDescription></CardHeader><CardContent><div className="space-y-2">{result.picks.slice(0, 12).map((pick) => <div key={pick.overall} className="flex items-center justify-between border-b border-border/60 py-2 text-sm"><span className="tabular-nums text-muted-foreground">{pick.overall}. {pick.teamId}</span><span className="font-medium">{formatName(result, pick.playerId)}</span><Badge variant={pick.kind === "user" ? "default" : "outline"}>{pick.kind}</Badge></div>)}</div></CardContent></Card><Card><CardHeader><CardTitle>Scouting calibration</CardTitle><CardDescription>Absolute error against hidden development truth in the developer run.</CardDescription></CardHeader><CardContent>{calibration ? <div className="grid grid-cols-2 gap-4"><Metric label="Legal rate" value={`${Math.round(calibration.legalRunRate * 100)}%`} />{Object.entries(calibration.scoutError).map(([tier, value]) => <Metric key={tier} label={`${tier} error`} value={value.toFixed(1)} />)}</div> : <p className="text-sm text-muted-foreground">Run the calibration batch to compare weak, average, and strong head scouts.</p>}</CardContent></Card></div>
              <Card><CardHeader><CardTitle>Export evidence</CardTitle><CardDescription>Full developer JSON includes truth and private boards. Safe JSON includes only the selected team’s visible information.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => downloadJson(`${seed}-draft-full.json`, serializeDraftDecisionExport(result, { profile: "full-developer", selectedTeamId }))}>Download full developer JSON</Button><Button variant="outline" onClick={() => downloadJson(`${seed}-draft-${selectedTeamId}-safe.json`, serializeDraftDecisionExport(result, { profile: "selected-team-safe", selectedTeamId }))}>Download selected-team-safe JSON</Button></CardContent></Card>
            </>}
          </div>
        </section>
      </div>
    </main>
  )
}
