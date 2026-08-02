import type {
  DraftDecisionResult,
  DraftDecisionRunInput,
} from "@workspace/domain-v2"
import type { DraftCalibrationArm, DraftCalibrationReport, DraftMatchedCalibrationReport } from "@workspace/calibration"

type WorkerMessage =
  | { type: "completed"; result: DraftDecisionResult }
  | { type: "batch-completed"; result: DraftCalibrationReport }
  | { type: "matched-completed"; result: DraftMatchedCalibrationReport }
  | { type: "progress"; progress: { completed: number; total: number; label: string } }
  | { type: "error"; message: string }

export function runDraftDecisionInWorker(input: DraftDecisionRunInput): Promise<DraftDecisionResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/draft-decision.worker.ts", import.meta.url), { type: "module" })
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      if (event.data.type === "error") {
        worker.terminate()
        reject(new Error(event.data.message))
        return
      }
      if (event.data.type !== "completed") return
      worker.terminate()
      resolve(event.data.result)
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message || "The draft worker failed."))
    }
    worker.postMessage({ type: "run", input })
  })
}

export function runDraftMatchedCalibrationInWorker(
  seed: string,
  arms: Array<DraftCalibrationArm>,
): Promise<DraftMatchedCalibrationReport> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/draft-decision.worker.ts", import.meta.url), { type: "module" })
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      if (event.data.type === "error") {
        worker.terminate()
        reject(new Error(event.data.message))
        return
      }
      if (event.data.type !== "matched-completed") return
      worker.terminate()
      resolve(event.data.result)
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message || "The matched draft calibration worker failed."))
    }
    worker.postMessage({ type: "matched", seed, arms })
  })
}

export function runDraftCalibrationInWorker(
  baseSeed: string,
  count: number,
  input?: DraftDecisionRunInput,
  onProgress?: (progress: { completed: number; total: number; label: string }) => void
): Promise<DraftCalibrationReport> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../workers/draft-decision.worker.ts", import.meta.url), { type: "module" })
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      if (event.data.type === "error") {
        worker.terminate()
        reject(new Error(event.data.message))
        return
      }
      if (event.data.type === "progress") {
        onProgress?.(event.data.progress)
        return
      }
      if (event.data.type !== "batch-completed") return
      worker.terminate()
      resolve(event.data.result)
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message || "The draft calibration worker failed."))
    }
    worker.postMessage({ type: "batch", baseSeed, count, input })
  })
}
