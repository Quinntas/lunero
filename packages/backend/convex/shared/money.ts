// Pure helpers shared by the Convex backend and the web app.

export const MIN_CHARGE_CENTS = 50 // Stripe's minimum charge for BRL.
export const MAX_MILESTONES = 30

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

export function formatBRL(cents: number) {
  return brl.format(cents / 100)
}

export function sumCents(items: { priceCents: number }[]) {
  return items.reduce((total, item) => total + item.priceCents, 0)
}

/**
 * Splits the fixed platform fee across milestones proportionally to their
 * prices (largest remainder method), so that the shares always add up to the
 * exact fee and each milestone keeps `price - share` as its payout.
 */
export function allocateFee(prices: number[], feeCents: number): number[] {
  const total = prices.reduce((a, b) => a + b, 0)
  if (feeCents <= 0 || total <= 0) return prices.map(() => 0)
  if (feeCents >= total) throw new Error("Fee must be lower than the total price")

  const exact = prices.map((price) => (price * feeCents) / total)
  const shares = exact.map(Math.floor)
  let remainder = feeCents - shares.reduce((a, b) => a + b, 0)

  const byFraction = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction)
  for (const { index } of byFraction) {
    if (remainder === 0) break
    shares[index] = (shares[index] ?? 0) + 1
    remainder--
  }
  return shares
}

export function breakdown(prices: number[], feeCents: number) {
  const totalCents = prices.reduce((a, b) => a + b, 0)
  const shares = feeCents < totalCents ? allocateFee(prices, feeCents) : prices.map(() => 0)
  return {
    totalCents,
    feeCents,
    freelancerCents: totalCents - feeCents,
    payouts: prices.map((price, index) => price - (shares[index] ?? 0)),
  }
}
