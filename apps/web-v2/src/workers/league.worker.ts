import { executeLeagueCommand } from "@workspace/sim-v2"
import type { WorkerRequest, WorkerResult } from "@workspace/sim-v2"

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
  postMessage: (result: WorkerResult) => void
}

workerScope.onmessage = (event) => {
  workerScope.postMessage(executeLeagueCommand(event.data))
}
