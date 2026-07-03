import {
  MAX_YEARS_BIRD,
  MAX_YEARS_OUTSIDE_FA,
  RAISE_PCT_BIRD,
  RAISE_PCT_STANDARD,
} from "@workspace/shared/financialConstants"
import type { Contract, ContractOption, SigningException } from "@workspace/shared/contractTypes"
import type { SeasonFinancials } from "@workspace/shared/financialTypes"
import type { Player, Rng } from "@workspace/shared/types"

import { calculateMaxSalary, calculateMinSalary, roundMoney } from "../capMath"

type InitialContractProfile = "young_minimum" | "standard"

export function createContractId(playerId: string, season: number): string {
  return `c_${playerId}_s${season}`
}

export function buildSalaryCurve(
  firstYearSalary: number,
  years: number,
  raisePct: number,
): number[] {
  const salaries: number[] = []
  let current = firstYearSalary

  for (let index = 0; index < years; index++) {
    salaries.push(roundMoney(current))
    current *= 1 + raisePct
  }

  return salaries
}

export function estimateSalaryFromOverall(
  overall: number,
  yearsOfService: number,
  seasonFinancials: SeasonFinancials,
): number {
  const minSalary = calculateMinSalary(seasonFinancials, yearsOfService)
  const maxSalary = calculateMaxSalary(
    seasonFinancials.salaryCap,
    yearsOfService,
  )
  const normalized = (overall - 40) / 50
  const salary = minSalary + normalized * (maxSalary - minSalary)
  return roundMoney(Math.max(minSalary, Math.min(maxSalary, salary)))
}

export function resolveInitialContractProfile(player: Player): InitialContractProfile {
  const yearsOfService = Math.max(0, player.yearsOfService ?? player.age - 19)

  if (player.age <= 22 && yearsOfService <= 2) {
    return "young_minimum"
  }

  if (player.age <= 24 && yearsOfService <= 3) {
    return "young_minimum"
  }

  return "standard"
}

export function generateInitialContract(
  player: Player,
  teamId: string,
  season: number,
  seasonFinancials: SeasonFinancials,
  rng: Rng,
): Contract {
  const profile = resolveInitialContractProfile(player)
  if (profile === "young_minimum") {
    return createMinimumContract(
      player,
      teamId,
      season,
      seasonFinancials,
      rng.int(1, 2),
    )
  }

  const yearsOfService = Math.max(0, player.age - 19)
  const salary = estimateSalaryFromOverall(
    player.ratings.overall,
    yearsOfService,
    seasonFinancials,
  )
  const years = rng.int(1, 4)
  const yearlySalaries = buildSalaryCurve(salary, years, RAISE_PCT_STANDARD)
  const endSeason = season + years - 1

  const options: ContractOption[] | undefined =
    years >= 2 && rng.next() > 0.6
      ? [{ yearIndex: years - 1, type: "team" }]
      : undefined

  return {
    id: createContractId(player.id, season),
    playerId: player.id,
    teamId,
    startSeason: season,
    endSeason,
    yearlySalaries,
    contractType: "standard",
    signingException: "cap_room",
    options,
    status: "active",
    signedSeason: season,
  }
}

export type InitialContractResult = {
  contracts: Contract[]
  players: Player[]
}

export function applyInitialContractsToPlayers(
  teams: { id: string; players: Player[] }[],
  contracts: Contract[],
): Player[] {
  const contractByPlayer = new Map(contracts.map((c) => [c.playerId, c]))

  return teams.flatMap((team) =>
    team.players.map((player) => {
      const contract = contractByPlayer.get(player.id)
      const yearsOfService = Math.max(0, player.age - 19)

      return {
        ...player,
        activeContractId: contract?.id ?? null,
        seasonsWithTeam: yearsOfService,
        yearsOfService,
      }
    }),
  )
}

export function generateInitialContractsForLeague(
  teams: { id: string; players: Player[] }[],
  season: number,
  seasonFinancials: SeasonFinancials,
  rng: Rng,
): InitialContractResult {
  const contracts: Contract[] = []

  for (const team of teams) {
    for (const player of team.players) {
      contracts.push(
        generateInitialContract(player, team.id, season, seasonFinancials, rng),
      )
    }
  }

  const players = applyInitialContractsToPlayers(teams, contracts)

  return { contracts, players }
}

export function createMinimumContract(
  player: Player,
  teamId: string,
  season: number,
  seasonFinancials: SeasonFinancials,
  years = 1,
): Contract {
  const salary = calculateMinSalary(seasonFinancials, player.yearsOfService)

  return {
    id: createContractId(player.id, season),
    playerId: player.id,
    teamId,
    startSeason: season,
    endSeason: season + years - 1,
    yearlySalaries: buildSalaryCurve(salary, years, RAISE_PCT_STANDARD),
    contractType: "minimum",
    signingException: "minimum",
    status: "active",
    signedSeason: season,
  }
}

export function createSignedContract(
  player: Player,
  teamId: string,
  season: number,
  firstYearSalary: number,
  years: number,
  signingException: SigningException,
): Contract {
  const raisePct =
    signingException === "bird" || signingException === "early_bird"
      ? RAISE_PCT_BIRD
      : RAISE_PCT_STANDARD
  const maxYears =
    signingException === "bird" ? MAX_YEARS_BIRD : MAX_YEARS_OUTSIDE_FA
  const contractYears = Math.min(years, maxYears)

  return {
    id: createContractId(player.id, season),
    playerId: player.id,
    teamId,
    startSeason: season,
    endSeason: season + contractYears - 1,
    yearlySalaries: buildSalaryCurve(firstYearSalary, contractYears, raisePct),
    contractType: signingException === "minimum" ? "minimum" : "standard",
    signingException,
    status: "active",
    signedSeason: season,
  }
}

export function createRookieScaleContract(
  player: Player,
  pickNumber: number,
  teamId: string,
  season: number,
  seasonFinancials: SeasonFinancials,
  round: number,
): Contract {
  const slot = Math.max(0, Math.min(pickNumber - 1, seasonFinancials.rookieScale.length - 1))
  const baseSalary =
    round === 1
      ? seasonFinancials.rookieScale[slot]!
      : roundMoney(seasonFinancials.minimumSalaries.tier1 * 1.2)

  const yearlySalaries = [
    baseSalary,
    roundMoney(baseSalary * 1.05),
    roundMoney(baseSalary * 1.1),
    roundMoney(baseSalary * 1.15),
  ]

  return {
    id: createContractId(player.id, season),
    playerId: player.id,
    teamId,
    startSeason: season,
    endSeason: season + 3,
    yearlySalaries,
    contractType: round === 1 ? "rookie_scale" : "minimum",
    signingException: round === 1 ? "rookie_scale" : "minimum",
    options: [
      { yearIndex: 2, type: "team" },
      { yearIndex: 3, type: "team" },
    ],
    status: "active",
    signedSeason: season,
  }
}

export function waiveContract(contract: Contract): Contract {
  return { ...contract, status: "waived" }
}
