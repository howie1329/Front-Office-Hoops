export const ACTIVE_LEAGUE_KEY = "foh:activeLeagueId"

export function getActiveLeagueId(): string | null {
  if (typeof window === "undefined") {
    return null
  }

  return window.localStorage.getItem(ACTIVE_LEAGUE_KEY)
}

export function setActiveLeagueId(id: string): void {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(ACTIVE_LEAGUE_KEY, id)
}

export function clearActiveLeagueId(): void {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem(ACTIVE_LEAGUE_KEY)
}
