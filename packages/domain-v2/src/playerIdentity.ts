import type { PlayerIdentity } from "./types"

export function formatPlayerIdentity(identity: PlayerIdentity): string | null {
  const components = [identity.firstName, identity.lastName].filter(
    (component): component is string => component !== null
  )

  return components.length > 0 ? components.join(" ") : null
}
