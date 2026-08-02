import type { V2LeagueRepository } from "@workspace/db-v2"
import type { WorkerRequest, WorkerResult } from "@workspace/sim-v2"

import { runLeagueCommand } from "./leagueWorker"
import type { RunLeagueCommandOptions } from "./leagueWorker"

export async function runAndCommitLeagueCommand(
  request: WorkerRequest,
  repository: V2LeagueRepository,
  options?: RunLeagueCommandOptions
): Promise<WorkerResult> {
  const result = await runLeagueCommand(request, options)
  if (result.status === "completed" && result.league) {
    await repository.save(result.league)
  }
  return result
}
