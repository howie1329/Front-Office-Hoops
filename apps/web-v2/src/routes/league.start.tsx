import { createFileRoute, Link } from "@tanstack/react-router"
import * as React from "react"

import { V2LeagueRepository } from "@workspace/db-v2"
import type { LeagueSummary } from "@workspace/db-v2"

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

export const Route = createFileRoute("/league/start")({
  component: LeagueStartPage,
})

const repository = new V2LeagueRepository()

function formatUpdatedAt(updatedAt: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(updatedAt))
}

function LeagueStartPage() {
  const [saves, setSaves] = React.useState<Array<LeagueSummary>>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<LeagueSummary | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

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
    setError(null)

    try {
      await repository.remove(deleteTarget.id)

      const remainingSaves = saves.filter((save) => save.id !== deleteTarget.id)
      setSaves(remainingSaves)
      if (selectedId === deleteTarget.id) {
        setSelectedId(remainingSaves[0]?.id ?? null)
      }
      setDeleteTarget(null)
    } catch {
      setError("That league could not be deleted from this browser.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <main className="min-h-svh bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <div className="mx-auto flex min-h-svh w-full max-w-[88rem] flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex shrink-0 items-center justify-between border-b border-border py-5">
          <Link
            to="/"
            className="text-sm font-semibold tracking-[-0.02em] transition-colors hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Front Office Hoops <span className="text-muted-foreground">/ V2</span>
          </Link>
          <Link
            to="/"
            className="text-sm font-medium text-muted-foreground underline decoration-border underline-offset-8 transition-colors hover:text-foreground hover:decoration-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Back to the game
          </Link>
        </header>

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
              Select a saved league to continue, or start a new one when league
              creation is ready.
            </p>
          </div>

          <section aria-labelledby="saves-heading" className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4">
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

            <div className="mt-7">
              {isLoading && (
                <p className="border-y border-border py-8 text-sm text-muted-foreground" role="status">
                  Checking for saved leagues…
                </p>
              )}

              {!isLoading && error && (
                <p className="border-y border-border py-8 text-sm text-muted-foreground" role="alert">
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
                      <TableHead className="text-right"><span className="sr-only">Actions</span></TableHead>
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

            <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
              <p className="max-w-md text-sm leading-6 text-muted-foreground" aria-live="polite">
                {selectedSave
                  ? `${selectedSave.name} is selected. Save manager is next in V2.`
                  : "League creation is next in V2."}
              </p>
              <Button
                type="button"
                disabled
                size="lg"
              >
                Start a new league <span aria-hidden="true" className="ml-3">↗</span>
              </Button>
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
