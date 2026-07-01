import { createFileRoute } from "@tanstack/react-router"

import { LeagueSavesPanel } from "@/components/league/LeagueSavesPanel"
import { useLeagueContext } from "@/contexts/LeagueContext"

export const Route = createFileRoute("/league/saves")({
  component: LeagueSavesPage,
})

function LeagueSavesPage() {
  const { saves, activeLeagueId, switchLeague, deleteLeague, error } =
    useLeagueContext()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-medium">Manage saves</h1>
        <p className="text-xs text-muted-foreground">
          Choose which league is active or remove saves you no longer need.
        </p>
      </div>

      <LeagueSavesPanel
        saves={saves}
        activeId={activeLeagueId}
        onSwitch={switchLeague}
        onDelete={deleteLeague}
      />

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
