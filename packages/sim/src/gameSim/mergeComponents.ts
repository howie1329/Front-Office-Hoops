import type { TeamStatComponents } from "../allocatePlayerStats"

export function emptyComponents(): TeamStatComponents {
  return {
    points: 0,
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0,
    orb: 0,
    drb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
  }
}

export function mergeComponents(
  target: TeamStatComponents,
  source: TeamStatComponents,
): TeamStatComponents {
  target.points += source.points
  target.fgm += source.fgm
  target.fga += source.fga
  target.tpm += source.tpm
  target.tpa += source.tpa
  target.ftm += source.ftm
  target.fta += source.fta
  target.orb += source.orb
  target.drb += source.drb
  target.ast += source.ast
  target.stl += source.stl
  target.blk += source.blk
  target.tov += source.tov
  return target
}
