import type { Team } from "./types"

export const SAMPLE_TEAMS: Team[] = [
  {
    id: "t_baltimore_foundry",
    name: "Baltimore Foundry",
    abbrev: "BAL",
    overall: 72,
    pace: 100,
  },
  {
    id: "t_portland_forge",
    name: "Portland Forge",
    abbrev: "POR",
    overall: 68,
    pace: 98,
  },
  {
    id: "t_austin_comets",
    name: "Austin Comets",
    abbrev: "AUS",
    overall: 61,
    pace: 102,
  },
  {
    id: "t_detroit_rivets",
    name: "Detroit Rivets",
    abbrev: "DET",
    overall: 55,
    pace: 97,
  },
  {
    id: "t_memphis_haze",
    name: "Memphis Haze",
    abbrev: "MEM",
    overall: 78,
    pace: 99,
  },
  {
    id: "t_reno_ghosts",
    name: "Reno Ghosts",
    abbrev: "RNO",
    overall: 52,
    pace: 101,
  },
]

export function getTeamById(id: string): Team | undefined {
  return SAMPLE_TEAMS.find((team) => team.id === id)
}
