export function formatMoney(millions: number): string {
  return `$${millions.toFixed(1)}M`
}

export function formatTolerance(
  tolerance: "tax_averse" | "prudent" | "competitive" | "all_in",
): string {
  switch (tolerance) {
    case "tax_averse":
      return "Tax averse"
    case "prudent":
      return "Prudent"
    case "competitive":
      return "Competitive"
    case "all_in":
      return "All-in"
  }
}

export function formatTeamMode(mode: "selling" | "buying" | "contending"): string {
  switch (mode) {
    case "selling":
      return "Selling"
    case "buying":
      return "Buying"
    case "contending":
      return "Contending"
  }
}

export function formatMarketTier(tier: "large" | "mid" | "small"): string {
  switch (tier) {
    case "large":
      return "Large market"
    case "mid":
      return "Mid market"
    case "small":
      return "Small market"
  }
}
