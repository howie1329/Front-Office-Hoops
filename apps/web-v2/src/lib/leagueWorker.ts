import type { WorkerRequest, WorkerResult } from "@workspace/sim-v2"

export function runLeagueCommand(request: WorkerRequest): Promise<WorkerResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("../workers/league.worker.ts", import.meta.url),
      { type: "module" },
    )

    worker.onmessage = (event: MessageEvent<WorkerResult>) => {
      worker.terminate()
      resolve(event.data)
    }

    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message || "The league worker failed."))
    }

    worker.postMessage(request)
  })
}
