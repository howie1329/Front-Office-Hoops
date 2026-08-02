import { runCareerCohort, runMatchedCareerCohort } from "@workspace/calibration"
import type {
  CareerCohortReport,
  CareerMatchedCohortReport,
} from "@workspace/domain-v2"
import type {
  CareerCohortRunOptions,
  CareerMatchedCohortRunOptions,
  CareerProgress,
} from "@workspace/calibration"

type CareerWorkerRequest =
  | {
      type: "cohort"
      requestId: string
      options: Omit<CareerCohortRunOptions, "onProgress" | "shouldCancel">
    }
  | {
      type: "matched"
      requestId: string
      options: Omit<
        CareerMatchedCohortRunOptions,
        "onProgress" | "shouldCancel"
      >
    }
  | { type: "cancel"; requestId: string }

type CareerWorkerMessage =
  | { type: "progress"; requestId: string; progress: CareerProgress }
  | { type: "cohort-completed"; requestId: string; report: CareerCohortReport }
  | {
      type: "matched-completed"
      requestId: string
      report: CareerMatchedCohortReport
    }
  | { type: "failed"; requestId: string; message: string }

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<CareerWorkerRequest>) => void) | null
  postMessage: (message: CareerWorkerMessage) => void
}
const cancelledRequests = new Set<string>()

workerScope.onmessage = (event) => {
  if (event.data.type === "cancel") {
    cancelledRequests.add(event.data.requestId)
    return
  }

  const { requestId } = event.data
  try {
    const onProgress = (progress: CareerProgress) =>
      workerScope.postMessage({ type: "progress", requestId, progress })
    const shouldCancel = () => cancelledRequests.has(requestId)
    if (event.data.type === "matched") {
      const report = runMatchedCareerCohort({
        ...event.data.options,
        onProgress,
        shouldCancel,
      })
      workerScope.postMessage({ type: "matched-completed", requestId, report })
    } else {
      const report = runCareerCohort({
        ...event.data.options,
        onProgress,
        shouldCancel,
      })
      workerScope.postMessage({ type: "cohort-completed", requestId, report })
    }
  } catch (error) {
    workerScope.postMessage({
      type: "failed",
      requestId,
      message: error instanceof Error ? error.message : "Career worker failed.",
    })
  } finally {
    cancelledRequests.delete(requestId)
  }
}
