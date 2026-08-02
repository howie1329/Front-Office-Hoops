import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import * as React from "react"

import { V2LeagueRepository } from "@workspace/db-v2"
import type { LeagueSummary } from "@workspace/db-v2"
import type {
  LeagueCreationResult,
  LeagueTeamPreview,
} from "@workspace/sim-v2"

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
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Separator } from "@workspace/ui/components/separator"

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

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function LeagueStartHeader({
  onBack,
  isCreateFlow,
}: {
  onBack?: () => void
  isCreateFlow?: boolean
}) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-border py-5">
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
    null,
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
          : "The league could not be generated.",
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
            "The selected team could not be saved.",
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
          : "The selected team could not be saved.",
      )
    } finally {
      setIsSelecting(false)
    }
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
                <h2 id="create-step-heading" className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
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
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
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

            {step === "team-selection" && result && (
              <TeamSelectionStep
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

function TeamSelectionStep({
  previews,
  selectedTeamId,
  isSelecting,
  error,
  onSelect,
  onConfirm,
  onBack,
}: {
  previews: Array<LeagueTeamPreview>
  selectedTeamId: string | null
  isSelecting: boolean
  error: string | null
  onSelect: (teamId: string) => void
  onConfirm: () => void
  onBack: () => void
}) {
  return (
    <div className="flex flex-col gap-7">
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
        Every team starts with a complete roster. Select the organization whose
        direction you want to own.
      </p>

      <Table>
        <TableCaption>Generated teams available to select.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Team</TableHead>
            <TableHead>Roster</TableHead>
            <TableHead>Current ability</TableHead>
            <TableHead>Potential</TableHead>
            <TableHead>Market</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {previews.map((preview) => {
            const isSelected = preview.teamId === selectedTeamId
            const inputId = `team-choice-${preview.teamId}`

            return (
              <TableRow
                key={preview.teamId}
                data-state={isSelected ? "selected" : undefined}
              >
                <TableCell className="font-medium">
                  <label
                    htmlFor={inputId}
                    className="flex min-h-11 cursor-pointer items-center gap-3"
                  >
                    <input
                      id={inputId}
                      type="radio"
                      name="team-choice"
                      value={preview.teamId}
                      checked={isSelected}
                      onChange={() => onSelect(preview.teamId)}
                      className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    />
                    <span>{preview.name}</span>
                  </label>
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {preview.rosterSize}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {formatNumber(preview.topTenAverageAbility)}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {formatNumber(preview.averagePotential)}
                </TableCell>
                <TableCell className="capitalize text-muted-foreground">
                  {preview.marketSize}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button type="button" variant="ghost" onClick={onBack} disabled={isSelecting}>
          Back to setup
        </Button>
        <Button
          type="button"
          size="lg"
          onClick={onConfirm}
          disabled={!selectedTeamId || isSelecting}
        >
          {isSelecting ? "Saving league…" : "Enter with this team"}
          <span aria-hidden="true" className="ml-3">
            ↗
          </span>
        </Button>
      </div>
    </div>
  )
}

function LeagueStartPage() {
  const navigate = useNavigate()
  const [saves, setSaves] = React.useState<Array<LeagueSummary>>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<LeagueSummary | null>(null)
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
      .then(() => navigate({ to: "/league", search: { saveId: result.document.metadata.id } }))
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
                <p className="py-8 text-sm text-muted-foreground" role="alert">
                  {error}
                </p>
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
                <Table>
                  <TableCaption>Saved leagues available to select.</TableCaption>
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
                            <label
                              htmlFor={inputId}
                              className="flex min-h-11 cursor-pointer items-center gap-3"
                            >
                              <input
                                id={inputId}
                                type="radio"
                                name="saved-league"
                                value={save.id}
                                checked={isSelected}
                                onChange={() => setSelectedId(save.id)}
                                className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                              />
                              <span>{save.name}</span>
                            </label>
                          </TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {save.season}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {save.teamName ?? "No team selected"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
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
              )}
            </div>

            <Separator className="my-7" />

            {actionError && (
              <p className="mb-5 text-sm text-destructive" role="alert">
                {actionError}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="max-w-md text-sm leading-6 text-muted-foreground" aria-live="polite">
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
              <AlertDialogCancel disabled={isDeleting}>Keep save</AlertDialogCancel>
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
