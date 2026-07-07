import type { RotationEntry, SegmentKind } from "@workspace/shared/types"

export function blowoutMinuteShift(margin: number): number {
  if (margin >= 25) {
    return 8
  }
  if (margin >= 20) {
    return 6
  }
  if (margin >= 15) {
    return 4
  }
  return 0
}

export function blowoutEfficiencyPenalty(margin: number): number {
  return margin >= 25 ? 0.02 : 0
}

export function applyBlowoutRotation(
  rotation: RotationEntry[],
  margin: number,
  segment: SegmentKind,
): RotationEntry[] {
  if (segment !== "q4" || margin < 15) {
    return rotation
  }

  const shift = blowoutMinuteShift(margin)
  if (shift <= 0) {
    return rotation
  }

  const sorted = [...rotation].sort((a, b) => b.minutes - a.minutes)
  const starterIds = new Set(sorted.slice(0, 5).map((entry) => entry.player.id))
  const benchIds = new Set(sorted.slice(5).map((entry) => entry.player.id))

  return rotation.map((entry) => {
    if (starterIds.has(entry.player.id)) {
      return {
        ...entry,
        minutes: Math.max(0, entry.minutes - Math.round(shift * 0.8)),
      }
    }

    if (benchIds.has(entry.player.id) && entry.minutes > 0) {
      return {
        ...entry,
        minutes: entry.minutes + Math.round(shift * 0.4),
      }
    }

    return entry
  })
}

export function redistributeSegmentMinutes(
  rotation: RotationEntry[],
  targetTotal: number,
): RotationEntry[] {
  const currentTotal = rotation.reduce((sum, entry) => sum + entry.minutes, 0)

  if (currentTotal <= 0 || targetTotal <= 0) {
    return rotation.map((entry) => ({ ...entry, minutes: 0 }))
  }

  const scale = targetTotal / currentTotal
  const scaled = rotation.map((entry) => ({
    ...entry,
    minutes: Math.max(0, Math.round(entry.minutes * scale)),
  }))

  let remainder =
    targetTotal - scaled.reduce((sum, entry) => sum + entry.minutes, 0)
  const order = [...scaled].sort((a, b) => b.minutes - a.minutes)

  let pointer = 0
  while (remainder > 0 && order.length > 0) {
    const target = order[pointer % order.length]!
    const index = scaled.findIndex(
      (entry) => entry.player.id === target.player.id,
    )
    if (index >= 0) {
      scaled[index] = {
        ...scaled[index]!,
        minutes: scaled[index]!.minutes + 1,
      }
      remainder -= 1
    }
    pointer += 1
  }

  return scaled
}
