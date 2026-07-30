import { runMatchupBatch } from "@workspace/calibration"
import type { GameMatchupFixture } from "@workspace/domain-v2"

type MatchupWorkerRequest = {
  fixture: GameMatchupFixture
  count: number
}

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<MatchupWorkerRequest>) => void) | null
  postMessage: (result: unknown) => void
}

workerScope.onmessage = (event) => {
  const { fixture, count } = event.data
  const report = runMatchupBatch({
    baseSeed: fixture.seed,
    count,
    createFixture: (seed) => ({ ...fixture, seed }),
    onProgress: (progress) => workerScope.postMessage({ type: "progress", progress }),
  })
  workerScope.postMessage({ type: "completed", report })
}
