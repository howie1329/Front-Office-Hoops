export const DEFAULT_PACE = 100

export const DEFAULT_HOME_COURT_ADVANTAGE = 3

export const BASE_OFF_RATING = 108

export const MIN_OVERALL = 40
export const MAX_OVERALL = 90

export const PLAYERS_PER_TEAM = 15
export const CAMP_ROSTER_MAX = 21
export const CAMP_EXTRA_PLAYERS = CAMP_ROSTER_MAX - PLAYERS_PER_TEAM
export const ROTATION_SIZE = 8
export const RATING_MIN = 40
export const RATING_MAX = 90
export const TEAM_MINUTES = 240

export const SIX_TEAM_GAMES_PER_TEAM = 10
export const DEFAULT_SEASON_LENGTH_DAYS = 30

export const LEAGUE_TEAM_COUNT = 30
export const NBA_GAMES_PER_TEAM = 82
export const NBA_SEASON_LENGTH_DAYS = 170
export const PRESEASON_LENGTH_DAYS = 14
export const PRESEASON_GAMES_PER_TEAM = 4
export const MINI_PRESEASON_LENGTH_DAYS = 7
export const MINI_PRESEASON_GAMES_PER_TEAM = 2
export const MAX_GAMES_PER_TEAM_PER_WEEK = 4
export const CONFERENCE_COUNT = 2
export const DIVISIONS_PER_CONFERENCE = 3
export const TEAMS_PER_DIVISION = 5
export const NBA_TOTAL_GAMES = (LEAGUE_TEAM_COUNT * NBA_GAMES_PER_TEAM) / 2

export const PLAYOFF_TEAMS_PER_CONFERENCE = 8
export const PLAYOFF_SERIES_LENGTH = 7
export const PLAYOFF_WINS_TO_ADVANCE = 4

export const SIX_TEAM_PLAYOFF_TEAMS = 4
export const SIX_TEAM_PLAYOFF_SERIES_LENGTH = 3
export const SIX_TEAM_PLAYOFF_WINS_TO_ADVANCE = 2

export const DEVELOPMENT_START_AGE = 19
export const PEAK_AGE_MIN = 26
export const PEAK_AGE_MAX = 33
export const VETERAN_MIN_AGE = 30

export const VETERAN_TAG = "veteran" as const

export const VETERAN_GROWTH_BONUS = 0.15
export const VETERAN_REGRESSION_BONUS = 0.1
export const REGRESSION_RAMP_YEARS = 4
export const GROWTH_RATE_SCALE = 0.35
export const POTENTIAL_OVERSHOOT_ALLOWANCE = 1

export const SKILL_KEYS = [
  "threePoint",
  "midRange",
  "freeThrow",
  "inside",
  "passing",
  "ballHandling",
  "rebounding",
  "defense",
  "stamina",
  "offensiveIQ",
  "defensiveIQ",
] as const

export const SCOUTING_LEVEL_MIN = 1
export const SCOUTING_LEVEL_MAX = 10
export const DEFAULT_SCOUTING_LEVEL = 5
export const OWN_ROSTER_SCOUTING_LEVEL = 9

export const IQ_SKILL_KEYS = ["offensiveIQ", "defensiveIQ"] as const
export const SHOOTING_SKILL_KEYS = ["threePoint", "midRange", "freeThrow"] as const

export const DRAFT_ROUNDS = 2
export const DRAFT_CLASS_MULTIPLIER = 1.5
export const FA_POOL_MIN_RATIO = 1.25
export const ROSTER_MIN = 6
export const ROSTER_MAX = PLAYERS_PER_TEAM
export const PRIMARY_POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const

export const ROOKIE_AGE_MIN = 19
export const ROOKIE_AGE_MAX = 22

export const ROOKIE_OVERALL_MIN = 45
export const ROOKIE_OVERALL_BASE = 52
export const ROOKIE_POTENTIAL_GAP_MIN = 8
export const ROOKIE_POTENTIAL_GAP_MAX = 20
