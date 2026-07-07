export type SegmentModifiers = {
  efficiencyShift: number
  tpaRateShift: number
  ftaRateShift: number
  tovRateShift: number
  homeCourtPoints: number
  fatiguePenalty: number
  benchDragMultiplier: number
}

export const EMPTY_SEGMENT_MODIFIERS: SegmentModifiers = {
  efficiencyShift: 0,
  tpaRateShift: 0,
  ftaRateShift: 0,
  tovRateShift: 0,
  homeCourtPoints: 0,
  fatiguePenalty: 0,
  benchDragMultiplier: 1,
}
