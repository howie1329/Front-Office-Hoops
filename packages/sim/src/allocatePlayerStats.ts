import type {
  PlayerGameStats,
  Rng,
  RotationEntry,
} from "@workspace/shared/types"

export type TeamStatComponents = {
  points: number
  fgm: number
  fga: number
  tpm: number
  tpa: number
  ftm: number
  fta: number
  orb: number
  drb: number
  ast: number
  stl: number
  blk: number
  tov: number
}

type StatKey = keyof Omit<TeamStatComponents, "points">

function weightedDistribute(
  total: number,
  weights: number[],
  rng: Rng
): number[] {
  if (weights.length === 0) {
    return []
  }

  const safeWeights = weights.map((weight) => Math.max(0.01, weight))
  const totalWeight = safeWeights.reduce((sum, weight) => sum + weight, 0)
  const raw = safeWeights.map((weight) => (weight / totalWeight) * total)
  const values = raw.map((value) => Math.floor(value))
  let remainder = total - values.reduce((sum, value) => sum + value, 0)

  const order = raw
    .map((value, index) => ({
      index,
      fraction: value - Math.floor(value) + rng.next() * 0.01,
    }))
    .sort((a, b) => b.fraction - a.fraction)

  let pointer = 0
  while (remainder > 0) {
    const target = order[pointer % order.length]
    if (target) {
      values[target.index] = (values[target.index] ?? 0) + 1
    }
    remainder -= 1
    pointer += 1
  }

  return values
}

function twoPointWeight(entry: RotationEntry): number {
  const { inside, shooting, usage } = entry.player.ratings
  return entry.minutes * usage * (inside * 0.65 + shooting * 0.35)
}

function threePointWeight(entry: RotationEntry): number {
  const { shooting, inside, usage } = entry.player.ratings
  const perimeterBias = Math.max(30, shooting + (shooting - inside) * 0.6)
  return entry.minutes * usage * perimeterBias
}

function freeThrowWeight(entry: RotationEntry): number {
  const { inside, usage } = entry.player.ratings
  return entry.minutes * usage * inside
}

function reboundWeight(entry: RotationEntry): number {
  return entry.minutes * entry.player.ratings.rebounding
}

function assistWeight(entry: RotationEntry): number {
  return entry.minutes * entry.player.ratings.passing
}

function blockWeight(entry: RotationEntry): number {
  const positionBonus =
    entry.player.position === "C"
      ? 1.35
      : entry.player.position === "PF"
        ? 1.15
        : 0.8
  return entry.minutes * entry.player.ratings.defense * positionBonus
}

function stealWeight(entry: RotationEntry): number {
  const guardBonus =
    entry.player.position === "PG" || entry.player.position === "SG" ? 1.2 : 0.9
  return entry.minutes * entry.player.ratings.defense * guardBonus
}

function turnoverWeight(entry: RotationEntry): number {
  const { usage, passing } = entry.player.ratings
  return entry.minutes * usage * Math.max(35, 95 - passing)
}

function capMakes(makes: number[], attempts: number[]): number[] {
  return makes.map((made, index) => Math.min(made, attempts[index] ?? 0))
}

function buildLegacyComponents(teamScore: number): TeamStatComponents {
  const tpm = Math.round((teamScore * 0.26) / 3)
  const ftm = Math.round(teamScore * 0.18)
  const twoPointMakes = Math.max(0, Math.round((teamScore - tpm * 3 - ftm) / 2))
  const fgm = twoPointMakes + tpm

  const components = {
    points: teamScore,
    fgm,
    fga: Math.max(fgm, Math.round(fgm / 0.47)),
    tpm,
    tpa: Math.max(tpm, Math.round(tpm / 0.36)),
    ftm,
    fta: Math.max(ftm, Math.round(ftm / 0.78)),
    orb: 10,
    drb: 34,
    ast: Math.round(fgm * 0.62),
    stl: 7,
    blk: 5,
    tov: 13,
  }
  reconcileComponentPoints(components, teamScore)

  return components
}

function componentPoints(stats: TeamStatComponents): number {
  return (stats.fgm - stats.tpm) * 2 + stats.tpm * 3 + stats.ftm
}

function reconcileComponentPoints(
  stats: TeamStatComponents,
  targetPoints: number
): TeamStatComponents {
  let delta = targetPoints - componentPoints(stats)

  if (delta > 0) {
    stats.ftm += delta
    stats.fta = Math.max(stats.fta, stats.ftm)
    stats.points = targetPoints
    return stats
  }

  while (delta < 0 && stats.ftm > 0) {
    stats.ftm -= 1
    delta += 1
  }

  while (delta < 0 && stats.tpm > 0) {
    stats.tpm -= 1
    stats.fgm -= 1
    delta += 3
  }

  while (delta < 0 && stats.fgm > stats.tpm) {
    stats.fgm -= 1
    delta += 2
  }

  if (delta > 0) {
    stats.ftm += delta
    stats.fta = Math.max(stats.fta, stats.ftm)
  }

  stats.points = targetPoints
  return stats
}

export function allocatePlayerStats(
  rotation: RotationEntry[],
  teamStatsOrScore: TeamStatComponents | number,
  teamId: string,
  rng: Rng
): PlayerGameStats[] {
  if (rotation.length === 0) {
    return []
  }

  const teamStats = reconcileComponentPoints(
    typeof teamStatsOrScore === "number"
      ? buildLegacyComponents(teamStatsOrScore)
      : { ...teamStatsOrScore },
    typeof teamStatsOrScore === "number"
      ? teamStatsOrScore
      : teamStatsOrScore.points
  )

  const minutes = rotation.map((entry) => entry.minutes)
  const starterIds = new Set(
    [...rotation]
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5)
      .map((entry) => entry.player.id)
  )

  const twoPointAttempts = teamStats.fga - teamStats.tpa
  const twoPointMakes = teamStats.fgm - teamStats.tpm

  const tpa = weightedDistribute(
    teamStats.tpa,
    rotation.map(threePointWeight),
    rng
  )
  const twoPa = weightedDistribute(
    twoPointAttempts,
    rotation.map(twoPointWeight),
    rng
  )
  const fta = weightedDistribute(
    teamStats.fta,
    rotation.map(freeThrowWeight),
    rng
  )
  const tpm = capMakes(
    weightedDistribute(teamStats.tpm, rotation.map(threePointWeight), rng),
    tpa
  )
  const twoPm = capMakes(
    weightedDistribute(twoPointMakes, rotation.map(twoPointWeight), rng),
    twoPa
  )
  const ftm = capMakes(
    weightedDistribute(teamStats.ftm, rotation.map(freeThrowWeight), rng),
    fta
  )

  const distributed: Record<StatKey, number[]> = {
    fgm: [],
    fga: [],
    tpm,
    tpa,
    ftm,
    fta,
    orb: weightedDistribute(teamStats.orb, rotation.map(reboundWeight), rng),
    drb: weightedDistribute(teamStats.drb, rotation.map(reboundWeight), rng),
    ast: weightedDistribute(teamStats.ast, rotation.map(assistWeight), rng),
    stl: weightedDistribute(teamStats.stl, rotation.map(stealWeight), rng),
    blk: weightedDistribute(teamStats.blk, rotation.map(blockWeight), rng),
    tov: weightedDistribute(teamStats.tov, rotation.map(turnoverWeight), rng),
  }

  distributed.fgm = rotation.map(
    (_, index) => (twoPm[index] ?? 0) + (tpm[index] ?? 0)
  )
  distributed.fga = rotation.map(
    (_, index) => (twoPa[index] ?? 0) + (tpa[index] ?? 0)
  )

  const stats = rotation.map((entry, index) => ({
    playerId: entry.player.id,
    teamId,
    starter: entry.starter ?? starterIds.has(entry.player.id),
    minutes: minutes[index] ?? 0,
    pts: (twoPm[index] ?? 0) * 2 + (tpm[index] ?? 0) * 3 + (ftm[index] ?? 0),
    fgm: distributed.fgm[index] ?? 0,
    fga: distributed.fga[index] ?? 0,
    tpm: distributed.tpm[index] ?? 0,
    tpa: distributed.tpa[index] ?? 0,
    ftm: distributed.ftm[index] ?? 0,
    fta: distributed.fta[index] ?? 0,
    reb: (distributed.orb[index] ?? 0) + (distributed.drb[index] ?? 0),
    ast: distributed.ast[index] ?? 0,
    stl: distributed.stl[index] ?? 0,
    blk: distributed.blk[index] ?? 0,
    tov: distributed.tov[index] ?? 0,
  }))

  const pointDelta =
    teamStats.points - stats.reduce((sum, line) => sum + line.pts, 0)
  const adjustmentTarget = stats
    .map((line, index) => ({ line, index }))
    .sort((a, b) => b.line.minutes - a.line.minutes)[0]

  if (adjustmentTarget && pointDelta !== 0) {
    const line = stats[adjustmentTarget.index]!
    line.pts += pointDelta
    line.ftm = Math.max(0, line.ftm + pointDelta)
    line.fta = Math.max(line.fta, line.ftm)
  }

  return stats
}
