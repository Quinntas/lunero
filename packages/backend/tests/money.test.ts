import { describe, expect, test } from "bun:test"
import { allocateFee, breakdown } from "../convex/shared/money"

describe("allocateFee", () => {
  test("shares add up to the exact fee", () => {
    const prices = [33_333, 33_333, 33_334]
    const shares = allocateFee(prices, 1_000)
    expect(shares.reduce((a, b) => a + b, 0)).toBe(1_000)
  })

  test("is proportional to the milestone price", () => {
    expect(allocateFee([30_000, 10_000], 1_000)).toEqual([750, 250])
  })

  test("zero fee keeps the full price", () => {
    expect(allocateFee([500, 700], 0)).toEqual([0, 0])
  })

  test("rejects a fee that eats the whole price", () => {
    expect(() => allocateFee([500], 500)).toThrow()
  })
})

describe("breakdown", () => {
  test("payouts add up to total minus fee", () => {
    const result = breakdown([12_345, 6_789, 1], 990)
    expect(result.totalCents).toBe(19_135)
    expect(result.payouts.reduce((a, b) => a + b, 0)).toBe(19_135 - 990)
  })
})
