import { Link } from "@tanstack/react-router"

import { Button } from "@workspace/ui/components/button"

const tabs = [
  { to: "/league", label: "Dashboard", exact: true },
  { to: "/league/standings", label: "Standings" },
  { to: "/league/schedule", label: "Schedule" },
  { to: "/league/team", label: "My Team" },
  { to: "/league/stats", label: "Stats" },
  { to: "/league/saves", label: "Saves" },
] as const

export function LeagueNav({ leagueName }: { leagueName?: string }) {
  return (
    <div className="flex flex-col gap-3 border-b pb-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-medium">{leagueName ?? "League"}</h1>
          <p className="text-xs text-muted-foreground">Front Office Hoops</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/">Home</Link>
        </Button>
      </div>

      <nav className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Button key={tab.to} variant="outline" size="sm" asChild>
            <Link
              to={tab.to}
              activeOptions={"exact" in tab && tab.exact ? { exact: true } : undefined}
            >
              {tab.label}
            </Link>
          </Button>
        ))}
      </nav>
    </div>
  )
}
