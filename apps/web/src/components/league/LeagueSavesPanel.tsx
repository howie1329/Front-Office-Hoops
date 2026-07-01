import { Link, useNavigate } from "@tanstack/react-router"

import type { LeagueSummary } from "@workspace/shared/types"
import { LEAGUE_TEAM_COUNT } from "@workspace/shared/constants"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString()
}

function formatLeagueType(teamCount: number): string {
  return teamCount === LEAGUE_TEAM_COUNT ? "30-team" : `${teamCount}-team lab`
}

function formatStatus(userTeamId: string | null): string {
  return userTeamId ? "Ready" : "Needs team pick"
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
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Saved leagues</CardTitle>
          <CardDescription>
            Switch between saves, delete old leagues, or create a new one.
            Season Lab saves appear here as 6-team lab entries.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/">Home</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/league/create">Create new league</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {saves.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {saves.map((save) => {
                const isActive = save.id === activeId

                return (
                  <TableRow
                    key={save.id}
                    className={isActive ? "bg-muted/40" : undefined}
                  >
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{save.name}</span>
                        {isActive ? (
                          <span className="text-xs text-muted-foreground">
                            Active
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{formatLeagueType(save.teamCount)}</TableCell>
                    <TableCell>{formatStatus(save.userTeamId)}</TableCell>
                    <TableCell>{formatUpdatedAt(save.updatedAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {!isActive ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleSwitch(save)}
                          >
                            Switch
                          </Button>
                        ) : null}
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
          <p className="text-sm text-muted-foreground">
            No saved leagues yet. Create one to get started.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
