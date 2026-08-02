import type { ContractMarketFixture, EconomyConfig } from "@workspace/domain-v2"
import type {
  EconomySimulationResult,
  FreeAgencySimulationProgress,
  FreeAgencySimulationResult,
} from "@workspace/sim-v2"

type WorkerMessage =
  | { type: "free-agency-completed"; result: FreeAgencySimulationResult }
  | { type: "free-agency-progress"; progress: FreeAgencySimulationProgress }
  | { type: "economy-completed"; result: EconomySimulationResult }
  | { type: "error"; message: string }

function runWorker<T>(
  request:
    | {
        type: "free-agency"
        fixture: ContractMarketFixture
        userTeamId: string | null
      }
    | {
        type: "economy"
        seed: string
        seasons: number
        config: EconomyConfig
      },
  expectedType: WorkerMessage["type"],
  onProgress?: (progress: FreeAgencySimulationProgress) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("../workers/market-rules.worker.ts", import.meta.url),
      { type: "module" }
    )
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      if (event.data.type === "error") {
        worker.terminate()
        reject(new Error(event.data.message))
        return
      }
      if (event.data.type === "free-agency-progress") {
        onProgress?.(event.data.progress)
        return
      }
      worker.terminate()
      if (event.data.type !== expectedType) {
        reject(new Error("The market worker returned an unexpected result."))
        return
      }
      resolve(event.data.result as T)
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message || "The market worker failed."))
    }
    worker.postMessage(request)
  })
}

export function runFreeAgencyInWorker(
  fixture: ContractMarketFixture,
  userTeamId: string | null,
  onProgress?: (progress: FreeAgencySimulationProgress) => void
): Promise<FreeAgencySimulationResult> {
  return runWorker<FreeAgencySimulationResult>(
    { type: "free-agency", fixture, userTeamId },
    "free-agency-completed",
    onProgress
  )
}

export function runEconomyInWorker(
  seed: string,
  seasons: number,
  config: EconomyConfig
): Promise<EconomySimulationResult> {
  return runWorker<EconomySimulationResult>(
    { type: "economy", seed, seasons, config },
    "economy-completed"
  )
}
