import {
  runDraftDecisionBatch,
} from "@workspace/calibration"
import { runDraftDecisionLab } from "@workspace/sim-v2"
import type {
  DraftDecisionRunInput,
  DraftDecisionResult,
} from "@workspace/domain-v2"
import type { DraftCalibrationReport } from "@workspace/calibration"

type DraftWorkerRequest =
  | { type: "run"; input: DraftDecisionRunInput }
  | { type: "batch"; baseSeed: string; count: number; input?: DraftDecisionRunInput }

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<DraftWorkerRequest>) => void) | null
  postMessage: (message: unknown) => void
}

workerScope.onmessage = (event) => {
  try {
    if (event.data.type === "run") {
      workerScope.postMessage({
        type: "completed",
        result: runDraftDecisionLab(event.data.input),
      })
      return
    }
    const result = runDraftDecisionBatch({
      baseSeed: event.data.baseSeed,
      count: event.data.count,
      config: event.data.input?.config,
      scoutTiers: event.data.input?.scoutTiers,
      retainRuns: false,
      onProgress: (progress) => workerScope.postMessage({ type: "progress", progress }),
    })
    workerScope.postMessage({ type: "batch-completed", result })
  } catch (error) {
    workerScope.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Draft worker failed.",
    })
  }
}

export type { DraftCalibrationReport, DraftDecisionResult }
