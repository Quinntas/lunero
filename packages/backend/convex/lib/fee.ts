import { env } from "../_generated/server"

export function platformFeeCents() {
  const fee = Number.parseInt(env.LUNERO_FEE_CENTS, 10)
  if (!Number.isFinite(fee) || fee < 0) {
    throw new Error("LUNERO_FEE_CENTS must be a non-negative integer (centavos)")
  }
  return fee
}
