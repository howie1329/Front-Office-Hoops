import { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import type { Contract } from "@workspace/shared/types"
import {
  getPendingUserTeamOptions,
  getPlayerContractMarketValue,
} from "@workspace/sim"

import { CapSheetCard } from "@/components/league/CapSheetCard"
import { formatMoney } from "@/components/league/lib/moneyFormat"
import { useLeagueContext } from "@/contexts/LeagueContext"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
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

export const Route = createFileRoute("/league/team-options")({
  component: TeamOptionsPage,
})

type PendingDecision = {
  contract: Contract
  decision: "exercise" | "decline"
}

function TeamOptionsPage() {
  const navigate = useNavigate()
  const {
    league,
    userTeamId,
    offseasonPhase,
    canCompleteContractOptions,
    decideTeamOption,
    completeContractOptions,
  } = useLeagueContext()
  const [pendingDecision, setPendingDecision] =
    useState<PendingDecision | null>(null)

  if (!league || !userTeamId) {
    return <MessageCard message="Pick a team to manage contract options." />
  }

  if (offseasonPhase !== "contract_options") {
    return (
      <MessageCard message="Team options are resolved when the offseason opens, before staff negotiations." />
    )
  }

  const team = league.seasonState.teams.find(
    (entry) => entry.id === userTeamId
  )!
  const options = getPendingUserTeamOptions(league, userTeamId)
  const rows = options.flatMap((contract) => {
    const player = team.players.find((entry) => entry.id === contract.playerId)
    return player ? [{ contract, player }] : []
  })
  const decisionPlayer = pendingDecision
    ? team.players.find(
        (entry) => entry.id === pendingDecision.contract.playerId
      )
    : null

  const continueToStaff = () => {
    completeContractOptions()
    void navigate({ to: "/league/staff" })
  }

  return (
    <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <Card size="sm">
        <CardHeader className="border-b">
          <CardTitle>Team options</CardTitle>
          <CardDescription>
            Choose whether to guarantee each option-year salary for cap season{" "}
            {league.leagueFinancials.currentCapSeason}. Decisions are final.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {rows.length === 0 ? (
            <div className="rounded-md border bg-muted/20 px-3 py-3">
              <p className="text-sm font-medium">No team options remain</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Player options and AI team options have already been resolved.
                Continue to open staff negotiations.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Pos</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Option salary</TableHead>
                  <TableHead>Market range</TableHead>
                  <TableHead>Future terms</TableHead>
                  <TableHead className="text-right">Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ contract, player }) => {
                  const market = getPlayerContractMarketValue(league, player)
                  const future = contract.yearlySalaries.slice(1)
                  return (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">
                        {player.firstName} {player.lastName}
                      </TableCell>
                      <TableCell>{player.position}</TableCell>
                      <TableCell>{player.age}</TableCell>
                      <TableCell>
                        {formatMoney(contract.yearlySalaries[0] ?? 0)}
                      </TableCell>
                      <TableCell>
                        {formatMoney(market.lowSalary)}–
                        {formatMoney(market.highSalary)}
                      </TableCell>
                      <TableCell>
                        {future.length > 0
                          ? future.map(formatMoney).join(" · ")
                          : "Option year only"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              setPendingDecision({
                                contract,
                                decision: "exercise",
                              })
                            }
                          >
                            Exercise
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              setPendingDecision({
                                contract,
                                decision: "decline",
                              })
                            }
                          >
                            Decline
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}

          <div className="flex items-center justify-between gap-3 border-t pt-3">
            <p className="text-xs text-muted-foreground">
              {rows.length} decision{rows.length === 1 ? "" : "s"} remaining
            </p>
            <Button
              disabled={!canCompleteContractOptions}
              onClick={continueToStaff}
            >
              Continue to staff
            </Button>
          </div>
        </CardContent>
      </Card>

      <CapSheetCard league={league} teamId={userTeamId} />

      <AlertDialog
        open={Boolean(pendingDecision)}
        onOpenChange={(open) => !open && setPendingDecision(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDecision?.decision === "exercise"
                ? "Exercise"
                : "Decline"}{" "}
              {decisionPlayer
                ? `${decisionPlayer.firstName} ${decisionPlayer.lastName}'s option?`
                : "this option?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDecision?.decision === "exercise"
                ? "The option-year salary becomes fully guaranteed."
                : "The contract ends, the player enters free agency, and eligible rights remain as a cap hold."}{" "}
              This decision cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={
                pendingDecision?.decision === "decline"
                  ? "destructive"
                  : "default"
              }
              onClick={() => {
                if (pendingDecision) {
                  decideTeamOption(
                    pendingDecision.contract.id,
                    pendingDecision.decision
                  )
                }
                setPendingDecision(null)
              }}
            >
              Confirm {pendingDecision?.decision}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function MessageCard({ message }: { message: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team options</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  )
}
