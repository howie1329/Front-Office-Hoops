import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router"
import { useState } from "react"

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

import { useLeagueContext } from "@/contexts/LeagueContext"

export const Route = createFileRoute("/league/create")({
  component: LeagueCreatePage,
})

function LeagueCreatePage() {
  const navigate = useNavigate()
  const { status, userTeamId, createProductLeague, error } = useLeagueContext()
  const [name, setName] = useState("My League")
  const [seed, setSeed] = useState("league-demo")
  const [submitting, setSubmitting] = useState(false)

  if (status === "ready" && userTeamId) {
    return <Navigate to="/league" />
  }

  if (status === "ready" && !userTeamId) {
    return <Navigate to="/league/pick-team" />
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)

    try {
      await createProductLeague(name.trim() || "My League", seed.trim() || "league-demo")
      void navigate({ to: "/league/pick-team" })
    } catch {
      // error surfaced via context
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-medium">Create league</h1>
          <p className="text-xs text-muted-foreground">
            Generate a 30-team league with an 82-game schedule.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/">Home</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New league</CardTitle>
          <CardDescription>
            Pick a name and seed. The seed controls procedural team generation
            and schedule shuffling.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={(event) => void handleSubmit(event)}>
            <div className="grid gap-2">
              <Label htmlFor="league-name">League name</Label>
              <Input
                id="league-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="My League"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="league-seed">Seed</Label>
              <Input
                id="league-seed"
                value={seed}
                onChange={(event) => setSeed(event.target.value)}
                placeholder="league-demo"
              />
            </div>

            {error ? <p className="text-xs text-destructive">{error}</p> : null}

            <Button type="submit" disabled={submitting || status === "loading"}>
              {submitting ? "Creating…" : "Create league"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
