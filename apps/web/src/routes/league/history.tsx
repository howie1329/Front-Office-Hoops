import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"

import { SeasonHistoryTable } from "@/components/league/SeasonHistoryTable"
import { formatMoney } from "@/components/league/lib/moneyFormat"
import { teamName } from "@/components/league/lib/teamFormat"
import { useLeagueContext } from "@/contexts/LeagueContext"
import type { SeasonState, TradeHistoryEntry } from "@workspace/shared/types"
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

type HistoryTab = "seasons" | "transactions"

export const Route = createFileRoute("/league/history")({
  component: LeagueHistoryPage,
})

function LeagueHistoryPage() {
  const { seasonState, seasonHistory, league } = useLeagueContext()
  const [activeTab, setActiveTab] = useState<HistoryTab>("seasons")

  if (!seasonState || !league) {
    return null
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="border-b pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>History</CardTitle>
              <CardDescription>
                Review completed seasons and league transactions.
              </CardDescription>
            </div>
            <div className="flex rounded-md border bg-muted/20 p-1">
              <HistoryTabButton
                active={activeTab === "seasons"}
                onClick={() => setActiveTab("seasons")}
              >
                Seasons
              </HistoryTabButton>
              <HistoryTabButton
                active={activeTab === "transactions"}
                onClick={() => setActiveTab("transactions")}
              >
                Transactions
              </HistoryTabButton>
            </div>
          </div>
        </CardHeader>
      </Card>

      {activeTab === "seasons" ? (
        <SeasonHistoryTable history={seasonHistory} teams={seasonState.teams} />
      ) : (
        <TradeTransactionsCard
          seasonState={seasonState}
          history={league.tradeHistory}
        />
      )}
    </div>
  )
}

function TradeTransactionsCard({
  seasonState,
  history,
}: {
  seasonState: SeasonState
  history: TradeHistoryEntry[]
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Transactions</CardTitle>
        <CardDescription>
          Completed trades are recorded with assets, salary, and value snapshots.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto py-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Season</TableHead>
              <TableHead>Day</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Assets sent</TableHead>
              <TableHead>Salary sent</TableHead>
              <TableHead>Net value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-sm text-muted-foreground"
                >
                  No trades completed yet.
                </TableCell>
              </TableRow>
            ) : null}
            {[...history]
              .reverse()
              .flatMap((entry) =>
                entry.teams.map((teamEntry) => (
                  <TableRow key={`${entry.id}_${teamEntry.teamId}`}>
                    <TableCell>{entry.season}</TableCell>
                    <TableCell>{entry.day}</TableCell>
                    <TableCell>
                      {teamName(seasonState, teamEntry.teamId)}
                    </TableCell>
                    <TableCell>{assetCount(teamEntry)}</TableCell>
                    <TableCell>
                      {formatMoney(teamEntry.outgoingSalary)}
                    </TableCell>
                    <TableCell>{teamEntry.netValue.toFixed(1)}</TableCell>
                  </TableRow>
                )),
              )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function HistoryTabButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={
        active
          ? "inline-flex h-7 items-center rounded-sm bg-background px-2 text-xs font-medium"
          : "inline-flex h-7 items-center rounded-sm px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
      }
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function assetCount(entry: TradeHistoryEntry["teams"][number]): number {
  return entry.sentPlayerIds.length + entry.sentPickIds.length
}
