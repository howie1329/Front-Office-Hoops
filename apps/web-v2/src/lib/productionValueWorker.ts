import type {
  SeasonCheckpointReport,
  SeasonFixture,
  SeasonRunProgress,
  SeasonRunResult,
} from "@workspace/domain-v2"
import type { SeasonBatchReport } from "@workspace/calibration"

export type SeasonWorkerProgress = SeasonRunProgress & {
  season?: number
  totalSeasons?: number
}

type SeasonWorkerMessage =
  | { type: "progress"; progress: SeasonWorkerProgress }
  | { type: "checkpoint"; checkpoint: SeasonCheckpointReport }
  | { type: "completed"; result: SeasonRunResult }
  | { type: "batch-completed"; report: SeasonBatchReport }
  | { type: "error"; error: { name: string; message: string } }

type SeasonWorkerRunOptions<TResult> = {
  request:
    | { type: "season"; fixture: SeasonFixture }
    | {
        type: "batch"
        fixture: SeasonFixture
        count: number
      }
  signal?: AbortSignal
  onProgress?: (progress: SeasonWorkerProgress) => void
  onMessage: (message: SeasonWorkerMessage) => TResult | undefined
  abortMessage: string
}

function runSeasonWorker<TResult>(
  options: SeasonWorkerRunOptions<TResult>
): Promise<TResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("../workers/production-value.worker.ts", import.meta.url),
      { type: "module" }
    )
    const signal = options.signal
    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort)
      worker.terminate()
    }
    const onAbort = () => {
      cleanup()
      reject(new DOMException(options.abortMessage, "AbortError"))
    }
    const rejectWithError = (error: unknown) => {
      cleanup()
      reject(error instanceof Error ? error : new Error(String(error)))
    }

    worker.onmessage = (event: MessageEvent<SeasonWorkerMessage>) => {
      if (event.data.type === "progress") {
        options.onProgress?.(event.data.progress)
        return
      }
      if (event.data.type === "error") {
        rejectWithError(
          new Error(`${event.data.error.name}: ${event.data.error.message}`)
        )
        return
      }
      try {
        const result = options.onMessage(event.data)
        if (result !== undefined) {
          cleanup()
          resolve(result)
        }
      } catch (error) {
        rejectWithError(error)
      }
    }
    worker.onerror = (event) => {
      rejectWithError(new Error(event.message || "The season worker failed."))
    }
    worker.onmessageerror = () => {
      rejectWithError(
        new Error("The season worker response could not be deserialized.")
      )
    }
    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener("abort", onAbort, { once: true })
    try {
      worker.postMessage(options.request)
    } catch (error) {
      rejectWithError(error)
    }
  })
}

export function runSeasonInWorker(
  fixture: SeasonFixture,
  options: {
    signal?: AbortSignal
    onProgress?: (progress: SeasonWorkerProgress) => void
    onCheckpoint?: (checkpoint: SeasonCheckpointReport) => void
  } = {}
): Promise<SeasonRunResult> {
  return runSeasonWorker({
    request: { type: "season", fixture },
    signal: options.signal,
    onProgress: options.onProgress,
    abortMessage: "The season run was aborted.",
    onMessage: (message) => {
      if (message.type === "checkpoint") {
        options.onCheckpoint?.(message.checkpoint)
        return undefined
      }
      return message.type === "completed" ? message.result : undefined
    },
  })
}

export function runSeasonBatchInWorker(
  fixture: SeasonFixture,
  count: number,
  options: {
    signal?: AbortSignal
    onProgress?: (progress: SeasonWorkerProgress) => void
  } = {}
): Promise<SeasonBatchReport> {
  return runSeasonWorker({
    request: { type: "batch", fixture, count },
    signal: options.signal,
    onProgress: options.onProgress,
    abortMessage: "The season batch was aborted.",
    onMessage: (message) =>
      message.type === "batch-completed" ? message.report : undefined,
  })
}
