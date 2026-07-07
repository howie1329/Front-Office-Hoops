import type { CoachingPhilosophy } from "./gameSimTypes"

export type HeadCoach = {
  id: string
  name: string
  philosophy: CoachingPhilosophy
  overall: number
  offense: number
  defense: number
  development: number
}
