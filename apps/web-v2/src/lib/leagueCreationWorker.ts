import type {
  LeagueCreationInput,
  LeagueCreationResult,
} from "@workspace/sim-v2"

import type {
  LeagueCreationWorkerRequest,
  LeagueCreationWorkerResult,
} from "../workers/league-creation.worker"

export function runLeagueCreation(
  input: LeagueCreationInput,
  options: { signal?: AbortSignal } = {},
): Promise<LeagueCreationResult> {
  return new Promise((resolve, reject) => {
    const request: LeagueCreationWorkerRequest = {
      requestId: `league-creation:${crypto.randomUUID()}`,
      input,
    }
    const worker = new Worker(
      new URL("../workers/league-creation.worker.ts", import.meta.url),
      { type: "module" },
    )
    const signal = options.signal

    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort)
      worker.terminate()
    }
    const onAbort = () => {
      cleanup()
      reject(new DOMException("League creation was aborted.", "AbortError"))
    }

    worker.onmessage = (event: MessageEvent<LeagueCreationWorkerResult>) => {
      cleanup()
      if (event.data.status === "completed") {
        resolve(event.data.result)
      } else {
        reject(new Error(event.data.message))
      }
    }
    worker.onerror = (event) => {
      cleanup()
      reject(new Error(event.message || "The league creation worker failed."))
    }

    if (signal?.aborted) {
      onAbort()
      return
    }

    signal?.addEventListener("abort", onAbort, { once: true })
    worker.postMessage(request)
  })
}
