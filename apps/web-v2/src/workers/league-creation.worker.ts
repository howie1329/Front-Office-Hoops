import { createLeague } from "@workspace/sim-v2"
import type {
  LeagueCreationInput,
  LeagueCreationResult,
} from "@workspace/sim-v2"

export type LeagueCreationWorkerRequest = {
  requestId: string
  input: LeagueCreationInput
}

export type LeagueCreationWorkerResult =
  | {
      requestId: string
      status: "completed"
      result: LeagueCreationResult
    }
  | {
      requestId: string
      status: "failed"
      message: string
    }

const workerScope = globalThis as unknown as {
  onmessage: (event: MessageEvent<LeagueCreationWorkerRequest>) => void
  postMessage: (message: LeagueCreationWorkerResult) => void
}

workerScope.onmessage = (event) => {
  try {
    workerScope.postMessage({
      requestId: event.data.requestId,
      status: "completed",
      result: createLeague(event.data.input),
    })
  } catch (error) {
    workerScope.postMessage({
      requestId: event.data.requestId,
      status: "failed",
      message: error instanceof Error ? error.message : "League creation failed.",
    })
  }
}
