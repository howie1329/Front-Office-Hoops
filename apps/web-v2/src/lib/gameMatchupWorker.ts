import type { GameMatchupFixture } from "@workspace/domain-v2"
import type { MatchupBatchReport } from "@workspace/calibration"

export type MatchupBatchProgress = {
  completed: number
  total: number
  label: string
}

export function runMatchupBatchInWorker(
  fixture: GameMatchupFixture,
  count: number,
  options: {
    signal?: AbortSignal
    onProgress?: (progress: MatchupBatchProgress) => void
  } = {}
): Promise<MatchupBatchReport> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("../workers/matchup.worker.ts", import.meta.url),
      { type: "module" }
    )
    const signal = options.signal
    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort)
      worker.terminate()
    }
    const onAbort = () => {
      cleanup()
      reject(new DOMException("The matchup batch was aborted.", "AbortError"))
    }
    worker.onmessage = (event: MessageEvent<
      | { type: "progress"; progress: MatchupBatchProgress }
      | { type: "completed"; report: MatchupBatchReport }
    >) => {
      if (event.data.type === "progress") {
        options.onProgress?.(event.data.progress)
        return
      }
      cleanup()
      resolve(event.data.report)
    }
    worker.onerror = (event) => {
      cleanup()
      reject(new Error(event.message || "The matchup worker failed."))
    }
    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener("abort", onAbort, { once: true })
    worker.postMessage({ fixture, count })
  })
}
