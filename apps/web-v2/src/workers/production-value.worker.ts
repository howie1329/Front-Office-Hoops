import { runSeasonBatch } from "@workspace/calibration"
import { runSeason } from "@workspace/sim-v2"
import type { SeasonFixture } from "@workspace/domain-v2"

type WorkerRequest =
  | { type: "season"; fixture: SeasonFixture }
  | { type: "batch"; fixture: SeasonFixture; count: number }

type WorkerResponse =
  | { type: "progress"; progress: unknown }
  | { type: "checkpoint"; checkpoint: unknown }
  | { type: "completed"; result: unknown }
  | { type: "batch-completed"; report: unknown }
  | { type: "error"; error: { name: string; message: string } }

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
  postMessage: (result: WorkerResponse) => void
}

workerScope.onmessage = (event) => {
  try {
    if (event.data.type === "season") {
      const result = runSeason(event.data.fixture, {
        onProgress: (progress) =>
          workerScope.postMessage({ type: "progress", progress }),
        onCheckpoint: (checkpoint) =>
          workerScope.postMessage({ type: "checkpoint", checkpoint }),
      })
      workerScope.postMessage({ type: "completed", result })
      return
    }

    const report = runSeasonBatch({
      baseSeed: event.data.fixture.seed,
      count: event.data.count,
      createFixture: (seed) => ({
        ...event.data.fixture,
        seed,
        schedule: event.data.fixture.schedule.map((game) => ({
          ...game,
          id: `${seed}:${game.id}`,
        })),
      }),
      onProgress: (progress) =>
        workerScope.postMessage({ type: "progress", progress }),
    })
    workerScope.postMessage({ type: "batch-completed", report })
  } catch (error) {
    workerScope.postMessage({
      type: "error",
      error: {
        name: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : String(error),
      },
    })
  }
}
