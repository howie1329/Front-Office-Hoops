import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
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
  const { status, createProductLeague, error } = useLeagueContext()
  const [name, setName] = useState("My League")
  const [seed, setSeed] = useState("league-demo")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)

    try {
      await createProductLeague(
        name.trim() || "My League",
        seed.trim() || "league-demo"
      )
      void navigate({ to: "/league/pick-team" })
    } catch {
      // error surfaced via context
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-2xl flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            League setup
          </p>
          <div>
            <h1 className="text-xl leading-tight font-medium">Create league</h1>
            <p className="text-sm leading-7 text-muted-foreground">
              Name the save, choose an optional seed, then pick the team you
              want to run.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/">Home</Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <Card>
          <CardHeader>
            <CardTitle>New league</CardTitle>
            <CardDescription>
              The league starts as a full 30-team save. You will choose your
              team on the next screen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => void handleSubmit(event)}
            >
              <div className="grid gap-2">
                <Label htmlFor="league-name">League name</Label>
                <Input
                  id="league-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="My League"
                />
                <p className="text-xs text-muted-foreground">
                  This is the save name shown on the home screen and saves list.
                </p>
              </div>

              <div className="grid gap-2 rounded-md bg-muted/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="league-seed">Seed</Label>
                  <span className="text-xs text-muted-foreground">
                    Optional
                  </span>
                </div>
                <Input
                  id="league-seed"
                  value={seed}
                  onChange={(event) => setSeed(event.target.value)}
                  placeholder="league-demo"
                />
                <p className="text-xs text-muted-foreground">
                  Same seed creates the same league setup. Leave it blank to use
                  league-demo.
                </p>
              </div>

              {error ? (
                <p className="text-xs text-destructive">{error}</p>
              ) : null}

              <div className="flex flex-col gap-2 border-t pt-4">
                <Button
                  type="submit"
                  disabled={submitting || status === "loading"}
                >
                  {submitting ? "Creating..." : "Create league and pick team"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Next: pick the team you want to run.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What gets generated</CardTitle>
            <CardDescription>
              A complete league foundation for the first season.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col divide-y rounded-md border text-xs">
              <div className="flex items-center justify-between gap-3 p-3">
                <span className="font-medium">30 teams</span>
                <span className="text-muted-foreground">Full league</span>
              </div>
              <div className="flex items-center justify-between gap-3 p-3">
                <span className="font-medium">82-game schedule</span>
                <span className="text-muted-foreground">Regular season</span>
              </div>
              <div className="flex items-center justify-between gap-3 p-3">
                <span className="font-medium">Rosters and ratings</span>
                <span className="text-muted-foreground">Seeded setup</span>
              </div>
              <div className="flex items-center justify-between gap-3 p-3">
                <span className="font-medium">League path</span>
                <span className="text-muted-foreground">
                  Draft, free agency, playoffs
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
