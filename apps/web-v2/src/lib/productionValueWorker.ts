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

export function runSeasonInWorker(
  fixture: SeasonFixture,
  options: {
    signal?: AbortSignal
    onProgress?: (progress: SeasonWorkerProgress) => void
    onCheckpoint?: (checkpoint: SeasonCheckpointReport) => void
  } = {}
): Promise<SeasonRunResult> {
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
      reject(new DOMException("The season run was aborted.", "AbortError"))
    }
    worker.onmessage = (event: MessageEvent<SeasonWorkerMessage>) => {
      if (event.data.type === "progress") {
        options.onProgress?.(event.data.progress)
        return
      }
      if (event.data.type === "checkpoint") {
        options.onCheckpoint?.(event.data.checkpoint)
        return
      }
      if (event.data.type !== "completed") return
      cleanup()
      resolve(event.data.result)
    }
    worker.onerror = (event) => {
      cleanup()
      reject(new Error(event.message || "The season worker failed."))
    }
    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener("abort", onAbort, { once: true })
    worker.postMessage({ type: "season", fixture })
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
      reject(new DOMException("The season batch was aborted.", "AbortError"))
    }
    worker.onmessage = (event: MessageEvent<SeasonWorkerMessage>) => {
      if (event.data.type === "progress") {
        options.onProgress?.(event.data.progress)
        return
      }
      if (event.data.type === "batch-completed") {
        cleanup()
        resolve(event.data.report)
      }
    }
    worker.onerror = (event) => {
      cleanup()
      reject(new Error(event.message || "The season worker failed."))
    }
    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener("abort", onAbort, { once: true })
    worker.postMessage({ type: "batch", fixture, count })
  })
}
