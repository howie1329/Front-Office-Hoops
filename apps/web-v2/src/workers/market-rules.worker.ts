import {
  runEconomySimulation,
  runFreeAgencySimulation,
} from "@workspace/sim-v2"
import type { ContractMarketFixture, EconomyConfig } from "@workspace/domain-v2"

type MarketWorkerRequest =
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
    }

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<MarketWorkerRequest>) => void) | null
  postMessage: (message: unknown) => void
}

workerScope.onmessage = (event) => {
  try {
    if (event.data.type === "free-agency") {
      workerScope.postMessage({
        type: "free-agency-completed",
        result: runFreeAgencySimulation(event.data.fixture, {
          userTeamId: event.data.userTeamId,
          onProgress: (progress) =>
            workerScope.postMessage({
              type: "free-agency-progress",
              progress,
            }),
        }),
      })
      return
    }

    workerScope.postMessage({
      type: "economy-completed",
      result: runEconomySimulation(
        event.data.seed,
        event.data.seasons,
        event.data.config
      ),
    })
  } catch (error) {
    workerScope.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Market worker failed.",
    })
  }
}
