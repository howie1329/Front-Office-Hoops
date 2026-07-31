import type { CareerCohortReport } from "@workspace/domain-v2"
import type {
  CareerCohortRunOptions,
  CareerProgress,
} from "@workspace/calibration"

export type CareerWorkerProgress = CareerProgress

type CareerWorkerMessage =
  | { type: "progress"; requestId: string; progress: CareerWorkerProgress }
  | { type: "cohort-completed"; requestId: string; report: CareerCohortReport }
  | { type: "failed"; requestId: string; message: string }

function createRequestId(): string {
  return `career-worker-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function runInWorker<T>(
  request: Record<string, unknown>,
  options: {
    signal?: AbortSignal
    onProgress?: (progress: CareerWorkerProgress) => void
  }
): Promise<T> {
  return new Promise((resolve, reject) => {
    const requestId = createRequestId()
    const worker = new Worker(
      new URL("../workers/career-cohort.worker.ts", import.meta.url),
      { type: "module" }
    )
    const signal = options.signal
    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort)
      worker.terminate()
    }
    const onAbort = () => {
      worker.postMessage({ type: "cancel", requestId })
      cleanup()
      reject(new DOMException("The career run was aborted.", "AbortError"))
    }

    worker.onmessage = (event: MessageEvent<CareerWorkerMessage>) => {
      if (event.data.requestId !== requestId) return
      if (event.data.type === "progress") {
        options.onProgress?.(event.data.progress)
        return
      }
      if (event.data.type === "failed") {
        cleanup()
        reject(new Error(event.data.message))
        return
      }
      cleanup()
      resolve(event.data.report as T)
    }
    worker.onerror = (event) => {
      cleanup()
      reject(new Error(event.message || "The career worker failed."))
    }
    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener("abort", onAbort, { once: true })
    worker.postMessage({ ...request, requestId })
  })
}

export function runCareerCohortInWorker(
  options: CareerCohortRunOptions & {
    signal?: AbortSignal
  }
): Promise<CareerCohortReport> {
  const { signal, onProgress, shouldCancel, ...runOptions } = options
  void shouldCancel
  return runInWorker(
    { type: "cohort", options: runOptions },
    { signal, onProgress }
  )
}
