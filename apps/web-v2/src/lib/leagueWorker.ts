import type { WorkerRequest, WorkerResult } from "@workspace/sim-v2"

export type RunLeagueCommandOptions = {
  signal?: AbortSignal
}

export function runLeagueCommand(
  request: WorkerRequest,
  options: RunLeagueCommandOptions = {}
): Promise<WorkerResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("../workers/league.worker.ts", import.meta.url),
      { type: "module" }
    )
    const signal = options.signal

    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort)
      worker.terminate()
    }

    const onAbort = () => {
      cleanup()
      reject(
        new DOMException("The league worker request was aborted.", "AbortError")
      )
    }

    worker.onmessage = (event: MessageEvent<WorkerResult>) => {
      cleanup()
      resolve(event.data)
    }

    worker.onerror = (event) => {
      cleanup()
      reject(new Error(event.message || "The league worker failed."))
    }

    worker.onmessageerror = () => {
      cleanup()
      reject(new Error("The league worker response could not be deserialized."))
    }

    if (signal?.aborted) {
      onAbort()
      return
    }

    signal?.addEventListener("abort", onAbort, { once: true })

    try {
      worker.postMessage(request)
    } catch (error) {
      cleanup()
      reject(error)
    }
  })
}
