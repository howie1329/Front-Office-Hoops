import {
  MAX_YEARS_BIRD,
  MAX_YEARS_OUTSIDE_FA,
  RAISE_PCT_BIRD,
  RAISE_PCT_STANDARD,
} from "@workspace/shared/financialConstants"
import type {
  Contract,
  ContractOption,
  SigningException,
} from "@workspace/shared/contractTypes"
import type {
  SeasonFinancials,
  TeamFinancials,
} from "@workspace/shared/financialTypes"
import type { Player, Rng } from "@workspace/shared/types"

import { calculateMaxSalary, calculateMinSalary, roundMoney } from "../capMath"
import { getTeamPayroll } from "../payroll"
import { calculateContractValue } from "../../playerValue"

type InitialContractProfile = "minimum" | "young_bargain" | "standard"

export function createContractId(playerId: string, season: number): string {
  return `c_${playerId}_s${season}`
}

export function buildSalaryCurve(
  firstYearSalary: number,
  years: number,
  raisePct: number
): number[] {
  const salaries: number[] = []
  let current = firstYearSalary

  for (let index = 0; index < years; index++) {
    salaries.push(roundMoney(current))
    current *= 1 + raisePct
  }

  return salaries
}

export function estimateSalaryFromValue(
  value: number,
  yearsOfService: number,
  seasonFinancials: SeasonFinancials
): number {
  const minSalary = calculateMinSalary(seasonFinancials, yearsOfService)
  const maxSalary = calculateMaxSalary(
    seasonFinancials.salaryCap,
    yearsOfService
  )
  const normalized = Math.max(0, Math.min(1, (value - 42) / 43))
  const salary = minSalary + normalized ** 1.35 * (maxSalary - minSalary)
  return roundMoney(Math.max(minSalary, Math.min(maxSalary, salary)))
}

export function resolveInitialContractProfile(
  player: Player
): InitialContractProfile {
  const yearsOfService = Math.max(0, player.yearsOfService ?? player.age - 19)
  const value = calculateContractValue(player)

  if (player.age <= 22 && yearsOfService <= 2) {
    return value < 56 && player.ratings.overall < 64
      ? "minimum"
      : "young_bargain"
  }

  if (player.age <= 24 && yearsOfService <= 3) {
    return value < 52 && player.ratings.overall < 60
      ? "minimum"
      : "young_bargain"
  }

  if (value < 44 && player.ratings.overall < 52) {
    return "minimum"
  }

  return "standard"
}

function youngBargainDiscount(player: Player): number {
  if (player.ratings.overall >= 74 || calculateContractValue(player) >= 66) {
    return 0.78
  }
  if (player.ratings.overall >= 68 || calculateContractValue(player) >= 60) {
    return 0.68
  }
  return 0.58
}

export function generateInitialContract(
  player: Player,
  teamId: string,
  season: number,
  seasonFinancials: SeasonFinancials,
  rng: Rng
): Contract {
  const profile = resolveInitialContractProfile(player)
  if (profile === "minimum") {
    return createMinimumContract(
      player,
      teamId,
      season,
      seasonFinancials,
      rng.int(1, 2)
    )
  }

  const yearsOfService = Math.max(0, player.age - 19)
  const value = calculateContractValue(player)
  const salary = roundMoney(
    estimateSalaryFromValue(
      value,
      yearsOfService,
      seasonFinancials
    ) *
      (profile === "young_bargain" ? youngBargainDiscount(player) : 1)
  )
  const minSalary = calculateMinSalary(
    seasonFinancials,
    yearsOfService,
  )
  const years = profile === "young_bargain" ? rng.int(2, 3) : rng.int(1, 4)
  const yearlySalaries = buildSalaryCurve(
    Math.max(minSalary, salary),
    years,
    RAISE_PCT_STANDARD
  )
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
  contracts: Contract[]
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
    })
  )
}

export function generateInitialContractsForLeague(
  teams: { id: string; players: Player[] }[],
  season: number,
  seasonFinancials: SeasonFinancials,
  rng: Rng
): InitialContractResult {
  const contracts: Contract[] = []

  for (const team of teams) {
    for (const player of team.players) {
      contracts.push(
        generateInitialContract(player, team.id, season, seasonFinancials, rng)
      )
    }
  }

  const players = applyInitialContractsToPlayers(teams, contracts)

  return { contracts, players }
}

function initialContractYears(player: Player, value: number, rng: Rng): number {
  if (player.age <= 24 && player.yearsOfService <= 3) {
    return rng.int(1, 2)
  }
  if (player.age >= 33) {
    return value >= 72 ? rng.int(1, 2) : 1
  }
  if (value >= 78) {
    return rng.int(3, 4)
  }
  if (value >= 65) {
    return rng.int(2, 4)
  }
  return rng.int(1, 2)
}

function teamPayrollTargetMultiplier(
  team: { overall: number },
  teamFinance: TeamFinancials
): number {
  const quality =
    team.overall >= 78
      ? 1.08
      : team.overall >= 72
        ? 1
        : team.overall >= 66
          ? 0.92
          : 0.84
  const market =
    teamFinance.spendingProfile.marketTier === "large"
      ? 1.05
      : teamFinance.spendingProfile.marketTier === "small"
        ? 0.96
        : 1
  const tolerance =
    teamFinance.spendingProfile.taxTolerance === "all_in"
      ? 1.08
      : teamFinance.spendingProfile.taxTolerance === "competitive"
        ? 1.04
        : teamFinance.spendingProfile.taxTolerance === "tax_averse"
          ? 0.92
          : 1

  return quality * market * tolerance
}

function openingPayrollCeiling(
  team: { overall: number },
  teamFinance: TeamFinancials,
  seasonFinancials: SeasonFinancials
): number {
  const quality =
    team.overall >= 82
      ? 1.48
      : team.overall >= 78
        ? 1.35
        : team.overall >= 72
          ? 1.18
          : 1.02
  const tolerance =
    teamFinance.spendingProfile.taxTolerance === "all_in"
      ? 1.12
      : teamFinance.spendingProfile.taxTolerance === "competitive"
        ? 1.05
        : teamFinance.spendingProfile.taxTolerance === "tax_averse"
          ? 0.92
          : 1
  const market =
    teamFinance.spendingProfile.marketTier === "large"
      ? 1.04
      : teamFinance.spendingProfile.marketTier === "small"
        ? 0.96
        : 1

  return roundMoney(
    Math.min(
      seasonFinancials.salaryCap * 1.82,
      seasonFinancials.salaryCap * quality * tolerance * market
    )
  )
}

function openingPayrollFloor(
  team: { overall: number },
  teamFinance: TeamFinancials,
  seasonFinancials: SeasonFinancials
): number {
  const quality =
    team.overall >= 78
      ? 1.02
      : team.overall >= 72
        ? 0.96
        : team.overall >= 66
          ? 0.88
          : 0.78
  const tolerance =
    teamFinance.spendingProfile.taxTolerance === "tax_averse"
      ? 0.94
      : teamFinance.spendingProfile.taxTolerance === "all_in"
        ? 1.04
        : 1

  return roundMoney(seasonFinancials.minimumTeamSalary * quality * tolerance)
}

function withUpdatedSalaryAndYears(
  contract: Contract,
  firstYearSalary: number,
  years: number
): Contract {
  return {
    ...contract,
    endSeason: contract.startSeason + years - 1,
    yearlySalaries: buildSalaryCurve(
      firstYearSalary,
      years,
      RAISE_PCT_STANDARD
    ),
    options:
      years >= 3 && contract.options
        ? contract.options.filter((option) => option.yearIndex < years)
        : contract.options,
  }
}

function withStandardContract(
  contract: Contract,
  firstYearSalary: number,
  years: number
): Contract {
  return {
    ...withUpdatedSalaryAndYears(contract, firstYearSalary, years),
    contractType: "standard",
    signingException: "cap_room",
  }
}

export function normalizeInitialContractsForLeague(
  teams: { id: string; overall: number; players: Player[] }[],
  contracts: Contract[],
  teamFinancials: TeamFinancials[],
  seasonFinancials: SeasonFinancials,
  rng: Rng
): Contract[] {
  let normalized = contracts

  for (const team of teams) {
    const teamFinance = teamFinancials.find((entry) => entry.teamId === team.id)
    if (!teamFinance) {
      continue
    }

    const payrollMultiplier = teamPayrollTargetMultiplier(team, teamFinance)
    const playersByValue = [...team.players].sort(
      (a, b) => calculateContractValue(b) - calculateContractValue(a)
    )
    const badContractIndex =
      rng.next() < 0.18 ? rng.int(3, playersByValue.length - 1) : -1

    normalized = normalized.map((contract) => {
      if (contract.teamId !== team.id) {
        return contract
      }

      const player = team.players.find(
        (entry) => entry.id === contract.playerId
      )
      if (!player || contract.contractType === "minimum") {
        return contract
      }

      const value = calculateContractValue(player)
      const yearsOfService = Math.max(0, player.yearsOfService)
      const rank = playersByValue.findIndex((entry) => entry.id === player.id)
      const rankMultiplier = rank <= 1 ? 1.08 : rank <= 4 ? 1 : 0.92
      const noiseMultiplier = 0.94 + rng.next() * 0.12
      const badContractMultiplier =
        rank === badContractIndex && player.age >= 28 ? 1.18 : 1
      const salary = roundMoney(
        estimateSalaryFromValue(value, yearsOfService, seasonFinancials) *
          payrollMultiplier *
          rankMultiplier *
          noiseMultiplier *
          badContractMultiplier
      )
      const minSalary = calculateMinSalary(seasonFinancials, yearsOfService)
      const maxSalary = calculateMaxSalary(
        seasonFinancials.salaryCap,
        yearsOfService
      )
      const years = Math.min(
        4,
        initialContractYears(player, value, rng) +
          (badContractMultiplier > 1 ? 1 : 0)
      )

      return withUpdatedSalaryAndYears(
        contract,
        Math.max(minSalary, Math.min(maxSalary, salary)),
        years
      )
    })

    const payroll = getTeamPayroll(team.id, normalized)
    const floor = openingPayrollFloor(team, teamFinance, seasonFinancials)
    if (payroll < floor) {
      const scale = floor / Math.max(1, payroll)
      normalized = normalized.map((contract) => {
        if (contract.teamId !== team.id) {
          return contract
        }
        const player = team.players.find(
          (entry) => entry.id === contract.playerId
        )
        if (!player) {
          return contract
        }
        const maxSalary = calculateMaxSalary(
          seasonFinancials.salaryCap,
          player.yearsOfService
        )
        const value = calculateContractValue(player)
        const valueSalary = estimateSalaryFromValue(
          value,
          player.yearsOfService,
          seasonFinancials
        )
        const targetSalary =
          contract.contractType === "minimum"
            ? Math.max(
                contract.yearlySalaries[0]!,
                valueSalary *
                  (player.age <= 24 && value >= 54 ? 0.55 : 0.38)
              )
            : contract.yearlySalaries[0]! * scale

        return withStandardContract(
          contract,
          Math.min(maxSalary, roundMoney(targetSalary)),
          Math.max(contract.yearlySalaries.length, player.age <= 24 ? 2 : 1)
        )
      })
    }

    const payrollAfterInitialFloor = getTeamPayroll(team.id, normalized)
    if (payrollAfterInitialFloor < floor) {
      const scale = floor / Math.max(1, payrollAfterInitialFloor)
      normalized = normalized.map((contract) => {
        if (contract.teamId !== team.id) {
          return contract
        }
        const player = team.players.find(
          (entry) => entry.id === contract.playerId
        )
        if (!player) {
          return contract
        }
        const maxSalary = calculateMaxSalary(
          seasonFinancials.salaryCap,
          player.yearsOfService
        )
        return withStandardContract(
          contract,
          Math.min(
            maxSalary,
            roundMoney(contract.yearlySalaries[0]! * scale)
          ),
          contract.yearlySalaries.length
        )
      })
    }

    const ceiling = openingPayrollCeiling(team, teamFinance, seasonFinancials)
    const payrollAfterFloor = getTeamPayroll(team.id, normalized)
    if (payrollAfterFloor > ceiling) {
      const scale = ceiling / payrollAfterFloor
      normalized = normalized.map((contract) => {
        if (
          contract.teamId !== team.id ||
          contract.contractType === "minimum"
        ) {
          return contract
        }
        const player = team.players.find(
          (entry) => entry.id === contract.playerId
        )
        if (!player) {
          return contract
        }
        const minSalary = calculateMinSalary(
          seasonFinancials,
          player.yearsOfService
        )
        return withUpdatedSalaryAndYears(
          contract,
          Math.max(
            minSalary,
            roundMoney(contract.yearlySalaries[0]! * scale)
          ),
          contract.yearlySalaries.length
        )
      })
    }
  }

  return normalized
}

export function createMinimumContract(
  player: Player,
  teamId: string,
  season: number,
  seasonFinancials: SeasonFinancials,
  years = 1
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
  signingException: SigningException
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
  round: number
): Contract {
  const slot = Math.max(
    0,
    Math.min(pickNumber - 1, seasonFinancials.rookieScale.length - 1)
  )
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
