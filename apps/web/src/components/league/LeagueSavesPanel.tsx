import { Link, useNavigate } from "@tanstack/react-router"

import type { LeagueSummary } from "@workspace/shared/types"
import { LEAGUE_TEAM_COUNT } from "@workspace/shared/constants"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function formatLeagueType(teamCount: number): string {
  return teamCount === LEAGUE_TEAM_COUNT ? "30-team" : `${teamCount}-team lab`
}

function formatStatus(userTeamId: string | null): string {
  return userTeamId ? "Ready" : "Needs team"
}

type LeagueSavesPanelProps = {
  saves: LeagueSummary[]
  activeId: string | null
  onSwitch: (id: string) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
}

export function LeagueSavesPanel({
  saves,
  activeId,
  onSwitch,
  onDelete,
}: LeagueSavesPanelProps) {
  const navigate = useNavigate()

  async function handleSwitch(save: LeagueSummary) {
    await onSwitch(save.id)
    void navigate({
      to: save.userTeamId ? "/league" : "/league/pick-team",
    })
  }

  async function handleDelete(save: LeagueSummary) {
    const confirmed = window.confirm(
      `Delete "${save.name}"? This cannot be undone.`,
    )

    if (!confirmed) {
      return
    }

    await onDelete(save.id)
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      {saves.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4">League</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="px-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {saves.map((save) => {
              const isActive = save.id === activeId
              const primaryAction = isActive
                ? save.userTeamId
                  ? "Continue"
                  : "Finish setup"
                : "Switch"

              return (
                <TableRow
                  key={save.id}
                  className={isActive ? "bg-muted/35" : undefined}
                >
                  <TableCell className="px-4 py-3">
                    <div className="flex min-w-52 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{save.name}</span>
                        {isActive ? <Badge variant="secondary">Active</Badge> : null}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Season {save.season}
                        {save.teamName ? ` · ${save.teamName}` : ""}
                        {save.wins !== null && save.losses !== null
                          ? ` · ${save.wins}-${save.losses}`
                          : ""}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{formatLeagueType(save.teamCount)}</TableCell>
                  <TableCell>
                    <Badge variant={save.userTeamId ? "outline" : "secondary"}>
                      {formatStatus(save.userTeamId)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatUpdatedAt(save.updatedAt)}
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant={isActive ? "default" : "secondary"}
                        size="sm"
                        onClick={() => void handleSwitch(save)}
                      >
                        {primaryAction}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleDelete(save)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      ) : (
        <div className="flex min-h-60 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
          <div className="max-w-sm">
            <h2 className="text-base font-medium">No saved leagues yet</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Create a league, pick a team, and your saves will appear here for
              quick switching.
            </p>
          </div>
          <Button asChild>
            <Link to="/league/create">Create league</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
