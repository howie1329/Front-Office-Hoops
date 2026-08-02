import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import * as React from "react"

import {
  ArrowRight01Icon,
  FilterHorizontalIcon,
  Search02Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { V2LeagueRepository } from "@workspace/db-v2"
import type { LeagueSummary } from "@workspace/db-v2"
import type { LeagueCreationResult, LeagueTeamPreview } from "@workspace/sim-v2"

import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

import { runLeagueCreation } from "@/lib/leagueCreationWorker"
import { runLeagueCommand } from "@/lib/leagueWorker"

export const Route = createFileRoute("/league/start")({
  component: LeagueStartPage,
})

const repository = new V2LeagueRepository()

function createId(prefix: string): string {
  return `${prefix}:${crypto.randomUUID()}`
}

function formatUpdatedAt(updatedAt: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(updatedAt))
}

function LeagueStartHeader({
  onBack,
  isCreateFlow,
  className,
}: {
  onBack?: () => void
  isCreateFlow?: boolean
  className?: string
}) {
  return (
    <header
      className={cn(
        "flex shrink-0 items-center justify-between border-b border-border py-5",
        className
      )}
    >
      <Link
        to="/"
        className="text-sm font-semibold tracking-[-0.02em] transition-colors hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        Front Office Hoops <span className="text-muted-foreground">/ V2</span>
      </Link>
      {isCreateFlow ? (
        <Button type="button" variant="ghost" onClick={onBack}>
          Back to saves
        </Button>
      ) : (
        <Link
          to="/"
          className="text-sm font-medium text-muted-foreground underline decoration-border underline-offset-8 transition-colors hover:text-foreground hover:decoration-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          Back to the game
        </Link>
      )}
    </header>
  )
}

function CreateLeagueFlow({
  onBack,
  onCreated,
}: {
  onBack: () => void
  onCreated: (result: LeagueCreationResult) => void
}) {
  const [step, setStep] = React.useState<"setup" | "team-selection">("setup")
  const [name, setName] = React.useState("My Front Office League")
  const [result, setResult] = React.useState<LeagueCreationResult | null>(null)
  const [selectedTeamId, setSelectedTeamId] = React.useState<string | null>(
    null
  )
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [isSelecting, setIsSelecting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleGenerate() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Give your league a name before generating it.")
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const nextResult = await runLeagueCreation({
        id: createId("league"),
        name: trimmedName,
        seed: createId("seed"),
        mode: "normal",
        createdWithEntropy: true,
      })
      setResult(nextResult)
      setSelectedTeamId(nextResult.teamPreviews[0]?.teamId ?? null)
      setStep("team-selection")
    } catch (creationError) {
      setError(
        creationError instanceof Error
          ? creationError.message
          : "The league could not be generated."
      )
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleSelectTeam() {
    if (!result || !selectedTeamId) return

    setIsSelecting(true)
    setError(null)

    try {
      const commandResult = await runLeagueCommand({
        requestId: createId("request"),
        command: {
          type: "SelectUserTeam",
          commandId: createId("command"),
          teamId: selectedTeamId,
        },
        league: result.document,
      })

      if (commandResult.status !== "completed" || !commandResult.league) {
        throw new Error(
          commandResult.reason?.message ??
            "The selected team could not be saved."
        )
      }

      onCreated({
        ...result,
        document: commandResult.league,
      })
    } catch (selectionError) {
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : "The selected team could not be saved."
      )
    } finally {
      setIsSelecting(false)
    }
  }

  if (step === "team-selection" && result) {
    return (
      <TeamSelectionWorkspace
        document={result.document}
        previews={result.teamPreviews}
        selectedTeamId={selectedTeamId}
        isSelecting={isSelecting}
        error={error}
        onSelect={setSelectedTeamId}
        onConfirm={() => void handleSelectTeam()}
        onBack={() => {
          setError(null)
          setStep("setup")
        }}
      />
    )
  }

  return (
    <main className="min-h-svh bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <div className="mx-auto flex min-h-svh w-full max-w-[88rem] flex-col px-5 sm:px-8 lg:px-12">
        <LeagueStartHeader onBack={onBack} isCreateFlow />

        <section
          aria-labelledby="create-heading"
          className="grid flex-1 content-center gap-12 py-14 sm:py-16 lg:grid-cols-[minmax(0,0.7fr)_minmax(28rem,1.3fr)] lg:gap-24 lg:py-12"
        >
          <div className="max-w-xl">
            <p className="mb-6 text-sm font-medium text-muted-foreground">
              Create a league
            </p>
            <h1
              id="create-heading"
              className="max-w-lg text-5xl leading-[0.98] font-semibold tracking-[-0.04em] text-balance sm:text-6xl"
            >
              Build the league you want to run.
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-8 text-muted-foreground">
              Start with the standard V2 rules, review the generated teams, and
              choose the organization you want to lead.
            </p>
          </div>

          <section aria-labelledby="create-step-heading" className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  {step === "setup" ? "League setup" : "Team selection"}
                </p>
                <h2
                  id="create-step-heading"
                  className="mt-2 text-2xl font-semibold tracking-[-0.03em]"
                >
                  {step === "setup"
                    ? "Name your league."
                    : "Choose your franchise."}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {step === "setup" ? "1 of 2" : "2 of 2"}
              </p>
            </div>

            <Separator className="my-7" />

            {step === "setup" && (
              <div className="flex flex-col gap-7">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="league-name">League name</Label>
                  <Input
                    id="league-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={isGenerating}
                    autoComplete="off"
                    className="h-11 text-base md:text-base"
                  />
                  <p className="text-sm leading-6 text-muted-foreground">
                    Standard settings are applied automatically. Deeper league
                    controls will be available here as V2 expands.
                  </p>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="text-sm text-muted-foreground">
                    Generation creates the complete 30-team league.
                  </p>
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => void handleGenerate()}
                    disabled={isGenerating || !name.trim()}
                  >
                    {isGenerating ? "Generating…" : "Generate league"}
                    <span aria-hidden="true" className="ml-3">
                      ↗
                    </span>
                  </Button>
                </div>
              </div>
            )}

          </section>
        </section>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-border py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Front Office Hoops V2</p>
          <p>Standard settings · local save</p>
        </footer>
      </div>
    </main>
  )
}

function currentAbility(preview: LeagueTeamPreview): number {
  return Math.floor(preview.topTenAverageAbility)
}

function marketSizeLabel(value: LeagueTeamPreview["marketSize"]): string {
  return value ? `${value.slice(0, 1).toUpperCase()}${value.slice(1)}` : "—"
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

function getTeamPayroll(
  document: LeagueCreationResult["document"],
  teamId: string
): number | null {
  const row = document.projections.payroll.find(
    (entry) => entry.teamId === teamId
  )
  return typeof row?.payroll === "number" ? row.payroll : null
}

function TeamFilterSelect({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onValueChange: (value: string) => void
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        size="sm"
        aria-label={label}
        className="w-full min-w-0 sm:w-32"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function TeamSelectionInspector({
  preview,
  payroll,
  isSelecting,
  error,
  onConfirm,
}: {
  preview: LeagueTeamPreview | null
  payroll: number | null
  isSelecting: boolean
  error: string | null
  onConfirm: () => void
}) {
  return (
    <aside
      aria-labelledby="selected-team-heading"
      className="flex max-h-[40%] min-h-[15rem] shrink-0 flex-col border-t border-border bg-muted/10 lg:max-h-none lg:min-h-0 lg:border-t-0"
    >
      {preview ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
            <div className="flex items-start gap-3">
              <div
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-md bg-primary text-xs font-semibold tracking-[0.04em] text-primary-foreground"
              >
                {preview.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground">
                  Selected team
                </p>
                <h2
                  id="selected-team-heading"
                  className="mt-1 truncate text-xl font-semibold tracking-[-0.03em]"
                >
                  {preview.name}
                </h2>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {preview.conference} · {preview.division}
                </p>
              </div>
            </div>

            <div className="mt-6 border-y border-border">
              <dl className="divide-y divide-border text-sm">
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-muted-foreground">Current ability</dt>
                  <dd className="font-semibold tabular-nums">
                    {currentAbility(preview)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-muted-foreground">Roster size</dt>
                  <dd className="font-semibold tabular-nums">
                    {preview.rosterSize}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-muted-foreground">Market size</dt>
                  <dd className="font-semibold">
                    {marketSizeLabel(preview.marketSize)}
                  </dd>
                </div>
                {payroll !== null && (
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="flex items-center gap-2 text-muted-foreground">
                      <HugeiconsIcon
                        icon={Wallet01Icon}
                        size={14}
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      Payroll
                    </dt>
                    <dd className="font-semibold tabular-nums">
                      {formatMoney(payroll)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Review the available team information before making this your
              active franchise.
            </p>
          </div>

          <div className="shrink-0 border-t border-border p-3 sm:p-4">
            {error && (
              <Alert variant="destructive" className="mb-3">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button
              type="button"
              size="lg"
              className="h-10 w-full justify-between"
              onClick={onConfirm}
              disabled={isSelecting}
            >
              {isSelecting ? "Saving league…" : "Enter with this team"}
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={16}
                strokeWidth={2}
                aria-hidden="true"
              />
            </Button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              This choice becomes your active team.
            </p>
          </div>
        </>
      ) : (
        <div className="grid min-h-0 flex-1 place-items-center p-6 text-center">
          <div>
            <p className="text-sm font-medium">No team selected.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose a team from the list to review its details.
            </p>
          </div>
        </div>
      )}
    </aside>
  )
}

function TeamSelectionWorkspace({
  document,
  previews,
  selectedTeamId,
  isSelecting,
  error,
  onSelect,
  onConfirm,
  onBack,
}: {
  document: LeagueCreationResult["document"]
  previews: Array<LeagueTeamPreview>
  selectedTeamId: string | null
  isSelecting: boolean
  error: string | null
  onSelect: (teamId: string) => void
  onConfirm: () => void
  onBack: () => void
}) {
  const [query, setQuery] = React.useState("")
  const [conferenceFilter, setConferenceFilter] = React.useState("all")
  const [divisionFilter, setDivisionFilter] = React.useState("all")
  const [marketFilter, setMarketFilter] = React.useState("all")

  const conferenceOptions = React.useMemo(
    () =>
      Array.from(new Set(previews.map((preview) => preview.conference)))
        .sort()
        .map((value) => ({ value, label: value })),
    [previews]
  )
  const divisionOptions = React.useMemo(
    () =>
      Array.from(new Set(previews.map((preview) => preview.division)))
        .sort()
        .map((value) => ({ value, label: value })),
    [previews]
  )

  const filteredPreviews = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return previews.filter((preview) => {
      const matchesQuery = normalizedQuery
        ? preview.name.toLowerCase().includes(normalizedQuery)
        : true
      const matchesConference =
        conferenceFilter === "all" || preview.conference === conferenceFilter
      const matchesDivision =
        divisionFilter === "all" || preview.division === divisionFilter
      const matchesMarket =
        marketFilter === "all" || preview.marketSize === marketFilter

      return matchesQuery && matchesConference && matchesDivision && matchesMarket
    })
  }, [conferenceFilter, divisionFilter, marketFilter, previews, query])

  const selectedPreview =
    previews.find((preview) => preview.teamId === selectedTeamId) ?? null
  const activeFilterCount = [
    query.trim(),
    conferenceFilter !== "all" ? conferenceFilter : "",
    divisionFilter !== "all" ? divisionFilter : "",
    marketFilter !== "all" ? marketFilter : "",
  ].filter(Boolean).length

  React.useEffect(() => {
    if (
      filteredPreviews.length > 0 &&
      !filteredPreviews.some((preview) => preview.teamId === selectedTeamId)
    ) {
      onSelect(filteredPreviews[0].teamId)
    }
  }, [filteredPreviews, onSelect, selectedTeamId])

  function clearFilters() {
    setQuery("")
    setConferenceFilter("all")
    setDivisionFilter("all")
    setMarketFilter("all")
  }

  return (
    <main className="h-[100dvh] overflow-hidden bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <div className="mx-auto flex h-full w-full max-w-[110rem] flex-col px-4 sm:px-6 lg:px-8">
        <LeagueStartHeader
          onBack={onBack}
          isCreateFlow
          className="py-3"
        />

        <section
          aria-labelledby="team-selection-heading"
          className="flex min-h-0 flex-1 flex-col py-4 sm:py-5"
        >
          <div className="flex shrink-0 items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                Team selection · 2 of 2
              </p>
              <h1
                id="team-selection-heading"
                className="mt-1 truncate text-2xl font-semibold tracking-[-0.03em] sm:text-3xl"
              >
                Choose your franchise.
              </h1>
            </div>
            <p className="shrink-0 text-xs text-muted-foreground">
              {filteredPreviews.length} of {previews.length} teams
            </p>
          </div>

          <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden border-y border-border lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.8fr)]">
            <section
              aria-labelledby="team-list-heading"
              className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-border lg:border-r lg:border-b-0"
            >
              <div className="flex shrink-0 flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <HugeiconsIcon
                    icon={Search02Icon}
                    size={15}
                    strokeWidth={2}
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="team-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search teams"
                    aria-label="Search teams"
                    autoComplete="off"
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 sm:flex sm:shrink-0">
                  <TeamFilterSelect
                    label="Filter by conference"
                    value={conferenceFilter}
                    onValueChange={setConferenceFilter}
                    options={[
                      { value: "all", label: "All conferences" },
                      ...conferenceOptions,
                    ]}
                  />
                  <TeamFilterSelect
                    label="Filter by division"
                    value={divisionFilter}
                    onValueChange={setDivisionFilter}
                    options={[
                      { value: "all", label: "All divisions" },
                      ...divisionOptions,
                    ]}
                  />
                  <TeamFilterSelect
                    label="Filter by market size"
                    value={marketFilter}
                    onValueChange={setMarketFilter}
                    options={[
                      { value: "all", label: "All markets" },
                      { value: "large", label: "Large market" },
                      { value: "medium", label: "Medium market" },
                      { value: "small", label: "Small market" },
                    ]}
                  />
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-3 py-2 text-xs">
                <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  <HugeiconsIcon
                    icon={FilterHorizontalIcon}
                    size={14}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <h2 id="team-list-heading" className="truncate font-medium">
                    Generated teams
                  </h2>
                  {activeFilterCount > 0 && (
                    <span className="shrink-0 text-muted-foreground/70">
                      · {activeFilterCount} active
                    </span>
                  )}
                </div>
                {activeFilterCount > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 shrink-0 px-1.5 text-xs text-muted-foreground"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </Button>
                )}
              </div>

              {filteredPreviews.length === 0 ? (
                <div className="grid min-h-0 flex-1 place-items-center p-6 text-center">
                  <div>
                    <p className="text-sm font-medium">No teams match.</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Clear a filter or try another team name.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </Button>
                  </div>
                </div>
              ) : (
                <RadioGroup
                  value={selectedTeamId ?? ""}
                  onValueChange={onSelect}
                  className="min-h-0 flex-1 gap-0 overflow-y-auto"
                  aria-label="Select a team"
                >
                  <Table className="min-w-full table-fixed">
                    <TableCaption className="sr-only">
                      Generated teams available to select.
                    </TableCaption>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow>
                        <TableHead className="w-[52%] sm:w-[32%]">Team</TableHead>
                        <TableHead className="hidden w-[30%] sm:table-cell">
                          Conference / division
                        </TableHead>
                        <TableHead className="w-[18%] text-right sm:w-[16%]">
                          Current ability
                        </TableHead>
                        <TableHead className="hidden w-[10%] text-right md:table-cell">
                          Roster
                        </TableHead>
                        <TableHead className="hidden w-[10%] text-right lg:table-cell">
                          Market
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPreviews.map((preview) => {
                        const isSelected = preview.teamId === selectedTeamId
                        const inputId = `team-choice-${preview.teamId}`

                        return (
                          <TableRow
                            key={preview.teamId}
                            data-state={isSelected ? "selected" : undefined}
                            className="cursor-pointer"
                            onClick={() => onSelect(preview.teamId)}
                          >
                            <TableCell className="max-w-0 font-medium">
                              <Label
                                htmlFor={inputId}
                                className="flex min-h-10 min-w-0 cursor-pointer items-center gap-2.5"
                              >
                                <RadioGroupItem
                                  id={inputId}
                                  value={preview.teamId}
                                  aria-label={`Select ${preview.name}`}
                                />
                                <span className="truncate">{preview.name}</span>
                              </Label>
                            </TableCell>
                            <TableCell className="hidden text-muted-foreground sm:table-cell">
                              {preview.conference} · {preview.division}
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              {currentAbility(preview)}
                            </TableCell>
                            <TableCell className="hidden text-right text-muted-foreground tabular-nums md:table-cell">
                              {preview.rosterSize}
                            </TableCell>
                            <TableCell className="hidden text-right text-muted-foreground capitalize lg:table-cell">
                              {preview.marketSize ?? "—"}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </RadioGroup>
              )}
            </section>

            <TeamSelectionInspector
              preview={selectedPreview}
              payroll={selectedPreview ? getTeamPayroll(document, selectedPreview.teamId) : null}
              isSelecting={isSelecting}
              error={error}
              onConfirm={onConfirm}
            />
          </div>
        </section>
      </div>
    </main>
  )
}

function LeagueStartPage() {
  const navigate = useNavigate()
  const [saves, setSaves] = React.useState<Array<LeagueSummary>>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<LeagueSummary | null>(
    null
  )
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [isCreateFlow, setIsCreateFlow] = React.useState(false)

  React.useEffect(() => {
    let active = true

    void repository
      .list()
      .then((nextSaves) => {
        if (!active) return

        setSaves(nextSaves)
        setSelectedId(nextSaves[0]?.id ?? null)
        setIsLoading(false)
      })
      .catch(() => {
        if (!active) return

        setError("Saved leagues could not be read from this browser.")
        setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const selectedSave = saves.find((save) => save.id === selectedId)

  async function handleDelete() {
    if (!deleteTarget) return

    setIsDeleting(true)
    setActionError(null)

    try {
      await repository.remove(deleteTarget.id)

      const remainingSaves = saves.filter((save) => save.id !== deleteTarget.id)
      setSaves(remainingSaves)
      if (selectedId === deleteTarget.id) {
        setSelectedId(remainingSaves[0]?.id ?? null)
      }
      setDeleteTarget(null)
    } catch {
      setActionError("That league could not be deleted from this browser.")
    } finally {
      setIsDeleting(false)
    }
  }

  function handleCreated(result: LeagueCreationResult) {
    void repository
      .create(result.document)
      .then(() =>
        navigate({
          to: "/league",
          search: { saveId: result.document.metadata.id },
        })
      )
      .catch(() => {
        setError("The new league was generated but could not be saved.")
        setIsCreateFlow(false)
      })
  }

  if (isCreateFlow) {
    return (
      <CreateLeagueFlow
        onBack={() => setIsCreateFlow(false)}
        onCreated={handleCreated}
      />
    )
  }

  return (
    <main className="min-h-svh bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <div className="mx-auto flex min-h-svh w-full max-w-[88rem] flex-col px-5 sm:px-8 lg:px-12">
        <LeagueStartHeader />

        <section
          aria-labelledby="start-heading"
          className="grid flex-1 content-center gap-12 py-14 sm:py-16 lg:grid-cols-[minmax(0,0.7fr)_minmax(28rem,1.3fr)] lg:gap-24 lg:py-12"
        >
          <div className="max-w-xl">
            <p className="mb-6 text-sm font-medium text-muted-foreground">
              Start a league
            </p>
            <h1
              id="start-heading"
              className="max-w-lg text-5xl leading-[0.98] font-semibold tracking-[-0.04em] text-balance sm:text-6xl"
            >
              Pick up where you left off.
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-8 text-muted-foreground">
              Select a saved league to continue, or start a new one in two clear
              steps.
            </p>
          </div>

          <section aria-labelledby="saves-heading" className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="saves-heading" className="text-sm font-semibold">
                  Previous saves
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Local leagues saved in this browser.
                </p>
              </div>
              {!isLoading && !error && (
                <p className="text-sm text-muted-foreground">
                  {saves.length} {saves.length === 1 ? "save" : "saves"}
                </p>
              )}
            </div>

            <Separator className="my-7" />

            <div>
              {isLoading && (
                <p className="py-8 text-sm text-muted-foreground" role="status">
                  Checking for saved leagues…
                </p>
              )}

              {!isLoading && error && (
                <Alert variant="destructive" className="my-8">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {!isLoading && !error && saves.length === 0 && (
                <Empty className="items-start rounded-none border-y border-border px-0 py-8 text-left">
                  <EmptyHeader className="items-start text-left">
                    <EmptyTitle>No saved leagues yet.</EmptyTitle>
                    <EmptyDescription>
                      Start a new league to create your first local save.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}

              {!isLoading && !error && saves.length > 0 && (
                <RadioGroup
                  value={selectedId ?? ""}
                  onValueChange={setSelectedId}
                  className="block"
                  aria-label="Select a saved league"
                >
                  <Table>
                    <TableCaption>
                      Saved leagues available to select.
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>League</TableHead>
                        <TableHead>Season</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead className="text-right">Updated</TableHead>
                        <TableHead className="text-right">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {saves.map((save) => {
                        const inputId = `saved-league-${save.id}`
                        const isSelected = save.id === selectedId

                        return (
                          <TableRow
                            key={save.id}
                            data-state={isSelected ? "selected" : undefined}
                          >
                            <TableCell className="font-medium">
                              <Label
                                htmlFor={inputId}
                                className="flex min-h-11 cursor-pointer items-center gap-3"
                              >
                                <RadioGroupItem
                                  id={inputId}
                                  value={save.id}
                                  aria-label={`Select ${save.name}`}
                                />
                                <span>{save.name}</span>
                              </Label>
                            </TableCell>
                          <TableCell className="text-muted-foreground tabular-nums">
                            {save.season}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {save.teamName ?? "No team selected"}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground tabular-nums">
                            {formatUpdatedAt(save.updatedAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="min-h-11"
                              aria-label={`Delete ${save.name}`}
                              onClick={() => setDeleteTarget(save)}
                            >
                              Delete
                            </Button>
                          </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </RadioGroup>
              )}
            </div>

            <Separator className="my-7" />

            {actionError && (
              <Alert variant="destructive" className="mb-5">
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4">
              <p
                className="max-w-md text-sm leading-6 text-muted-foreground"
                aria-live="polite"
              >
                {selectedSave
                  ? `${selectedSave.name} is selected.`
                  : "Create a league to make your first save."}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!selectedSave}
                  onClick={() => {
                    if (selectedSave) {
                      void navigate({
                        to: "/league",
                        search: { saveId: selectedSave.id },
                      })
                    }
                  }}
                >
                  Continue
                </Button>
                <Button
                  type="button"
                  size="lg"
                  onClick={() => setIsCreateFlow(true)}
                >
                  Start a new league
                  <span aria-hidden="true" className="ml-3">
                    ↗
                  </span>
                </Button>
              </div>
            </div>
          </section>
        </section>

        <AlertDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open && !isDeleting) setDeleteTarget(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the local save from this browser. You cannot undo
                this action.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>
                Keep save
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={isDeleting}
                onClick={(event) => {
                  event.preventDefault()
                  void handleDelete()
                }}
              >
                {isDeleting ? "Deleting…" : "Delete save"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <footer className="flex shrink-0 flex-col gap-2 border-t border-border py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Front Office Hoops V2</p>
          <p>The league loop starts here.</p>
        </footer>
      </div>
    </main>
  )
}
