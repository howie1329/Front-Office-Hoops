export function nullableNumberSort<T extends Record<string, unknown>>(
  key: keyof T,
) {
  return (a: { original: T }, b: { original: T }) => {
    const first = a.original[key]
    const second = b.original[key]
    const firstValue = typeof first === "number" ? first : -1
    const secondValue = typeof second === "number" ? second : -1
    return firstValue - secondValue
  }
}

export function formatPerGameAverage(
  total: number | undefined,
  games: number | undefined,
): string {
  if (!total || !games) {
    return "—"
  }
  return (total / games).toFixed(1)
}
