import { runSeasonBatch } from "@workspace/calibration"
import { runSeason } from "@workspace/sim-v2"
import type { SeasonFixture } from "@workspace/domain-v2"

type WorkerRequest =
  | { type: "season"; fixture: SeasonFixture }
  | { type: "batch"; fixture: SeasonFixture; count: number }

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
  postMessage: (result: unknown) => void
}

workerScope.onmessage = (event) => {
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
}
