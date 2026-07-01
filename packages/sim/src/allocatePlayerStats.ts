import type { PlayerGameStats, Rng, RotationEntry } from "@workspace/shared/types"

function scoringWeight(entry: RotationEntry): number {
  const { usage, shooting, inside } = entry.player.ratings
  return entry.minutes * usage * ((shooting + inside) / 2)
}

function distributePoints(
  rotation: RotationEntry[],
  teamScore: number,
): number[] {
  const weights = rotation.map(scoringWeight)
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)

  if (totalWeight === 0 || rotation.length === 0) {
    return []
  }

  const rawPoints = weights.map(
    (weight) => (weight / totalWeight) * teamScore,
  )
  const points = rawPoints.map((value) => Math.floor(value))
  let remainder = teamScore - points.reduce((sum, value) => sum + value, 0)

  const order = rawPoints
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction)

  let pointer = 0
  while (remainder > 0) {
    const target = order[pointer % order.length]
    if (target) {
      points[target.index] = (points[target.index] ?? 0) + 1
    }
    remainder -= 1
    pointer += 1
  }

  return points
}

function deriveShootingStats(
  entry: RotationEntry,
  points: number,
  rng: Rng,
): Pick<PlayerGameStats, "fgm" | "fga" | "tpm" | "tpa" | "ftm" | "fta"> {
  const { shooting, inside } = entry.player.ratings
  const threePointShare = Math.min(
    0.55,
    Math.max(0.15, (shooting - inside + 20) / 100),
  )
  const freeThrowPoints = Math.min(
    points,
    Math.round(points * rng.normal(0.18, 0.05)),
  )
  const fieldPoints = Math.max(0, points - freeThrowPoints)
  const threePointPoints = Math.min(
    fieldPoints,
    Math.round(fieldPoints * threePointShare),
  )
  const twoPointPoints = fieldPoints - threePointPoints

  const tpm = Math.floor(threePointPoints / 3)
  const tpa = Math.max(tpm, tpm + rng.int(1, 4))
  const twoPointMakes = Math.floor(twoPointPoints / 2)
  const twoPointAttempts = Math.max(twoPointMakes, twoPointMakes + rng.int(1, 4))
  const fgm = twoPointMakes + tpm
  const fga = Math.max(fgm, twoPointAttempts + tpa)
  const ftm = Math.floor(freeThrowPoints / 1)
  const fta = Math.max(ftm, ftm + rng.int(0, 2))

  return { fgm, fga, tpm, tpa, ftm, fta }
}

function jitterMinutes(minutes: number, rng: Rng): number {
  return Math.max(1, Math.round(minutes + rng.normal(0, 1)))
}

export function allocatePlayerStats(
  rotation: RotationEntry[],
  teamScore: number,
  teamId: string,
  rng: Rng,
): PlayerGameStats[] {
  if (rotation.length === 0) {
    return []
  }

  const pointsByPlayer = distributePoints(rotation, teamScore)
  const minutes = rotation.map((entry) => jitterMinutes(entry.minutes, rng))
  const totalMinutes = minutes.reduce((sum, value) => sum + value, 0)
  const minuteDelta = 240 - totalMinutes
  minutes[minutes.length - 1] = Math.max(
    1,
    (minutes[minutes.length - 1] ?? 0) + minuteDelta,
  )

  const sortedByMinutes = [...rotation]
    .map((entry, index) => ({ entry, index, minutes: minutes[index] ?? 0 }))
    .sort((a, b) => b.minutes - a.minutes)
  const starterIds = new Set(
    sortedByMinutes.slice(0, 5).map((item) => item.entry.player.id),
  )

  const totalReboundingWeight = rotation.reduce(
    (sum, entry, index) =>
      sum + entry.player.ratings.rebounding * (minutes[index] ?? 0),
    0,
  )
  const totalPassingWeight = rotation.reduce(
    (sum, entry, index) =>
      sum + entry.player.ratings.passing * (minutes[index] ?? 0),
    0,
  )

  const stats = rotation.map((entry, index) => {
    const pts = pointsByPlayer[index] ?? 0
    const playerMinutes = minutes[index] ?? 0
    const shooting = deriveShootingStats(entry, pts, rng)

    const rebWeight = entry.player.ratings.rebounding * playerMinutes
    const astWeight = entry.player.ratings.passing * playerMinutes
    const reb =
      totalReboundingWeight > 0
        ? Math.max(0, Math.round((rebWeight / totalReboundingWeight) * 44))
        : 0
    const ast =
      totalPassingWeight > 0
        ? Math.max(0, Math.round((astWeight / totalPassingWeight) * 28))
        : 0

    const stl = Math.max(0, Math.round(rng.normal(0.9, 0.6)))
    const blk = Math.max(
      0,
      Math.round(
        rng.normal(entry.player.position === "C" ? 0.8 : 0.3, 0.4),
      ),
    )
    const tov = Math.max(0, Math.round(rng.normal(1.4, 0.7)))

    return {
      playerId: entry.player.id,
      teamId,
      starter: starterIds.has(entry.player.id),
      minutes: playerMinutes,
      pts,
      ...shooting,
      reb,
      ast,
      stl,
      blk,
      tov,
    }
  })

  const fgmTotal = stats.reduce((sum, line) => sum + line.fgm, 0)
  const astTotal = stats.reduce((sum, line) => sum + line.ast, 0)

  if (astTotal > fgmTotal && fgmTotal > 0) {
    const scale = fgmTotal / astTotal
    for (const line of stats) {
      line.ast = Math.max(0, Math.round(line.ast * scale))
    }
  }

  return stats
}
