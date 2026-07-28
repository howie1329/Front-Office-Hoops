import { Link } from "@tanstack/react-router"

import { Button } from "@workspace/ui/components/button"

type LeagueTab = {
  to: string
  label: string
  exact?: boolean
}

const tabs: LeagueTab[] = [
  { to: "/league", label: "Dashboard", exact: true },
  { to: "/league/standings", label: "Standings" },
  { to: "/league/calendar", label: "Calendar" },
  { to: "/league/playoffs", label: "Playoffs" },
  { to: "/league/draft", label: "Draft" },
  { to: "/league/team-options", label: "Team Options" },
  { to: "/league/staff", label: "Staff" },
  { to: "/league/team", label: "My Team" },
  { to: "/league/trades", label: "Trades" },
  { to: "/league/stats", label: "Stats" },
  { to: "/league/history", label: "History" },
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
              activeOptions={tab.exact ? { exact: true } : undefined}
            >
              {tab.label}
            </Link>
          </Button>
        ))}
      </nav>
    </div>
  )
}
