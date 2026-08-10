import { executeLeagueCommand } from "@workspace/sim-v2"
import type {
  WorkerProgressMessage,
  WorkerRequest,
  WorkerResult,
} from "@workspace/sim-v2"

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
  postMessage: (result: WorkerResult | WorkerProgressMessage) => void
}

workerScope.onmessage = (event) => {
  workerScope.postMessage(
    executeLeagueCommand(event.data, {
      onProgress: (message) => workerScope.postMessage(message),
    })
  )
}
