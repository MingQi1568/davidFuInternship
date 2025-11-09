import type { Security } from "./constants";

export const LIQUIDITY = 20;

export type Totals = Record<Security, number>;

export function computeCost(q: Totals, b: number = LIQUIDITY) {
  const sum = Object.values(q).reduce(
    (acc, shares) => acc + Math.exp(shares / b),
    0
  );
  return b * Math.log(sum);
}

export function currentPrices(
  totals: Totals,
  b: number = LIQUIDITY
): Record<Security, number> {
  const numerator = Object.fromEntries(
    Object.entries(totals).map(([security, shares]) => [
      security,
      Math.exp(shares / b),
    ])
  ) as Record<Security, number>;

  const denom = Object.values(numerator).reduce((acc, val) => acc + val, 0);
  return Object.fromEntries(
    Object.entries(numerator).map(([security, value]) => [
      security,
      value / denom,
    ])
  ) as Record<Security, number>;
}

export function quoteTrade({
  totals,
  security,
  amount,
  b = LIQUIDITY,
}: {
  totals: Totals;
  security: Security;
  amount: number;
  b?: number;
}) {
  if (!Number.isFinite(amount) || amount === 0) {
    throw new Error("Amount must be non-zero");
  }
  const before = computeCost(totals, b);
  const updated: Totals = { ...totals, [security]: totals[security] + amount };
  const after = computeCost(updated, b);
  const prices = {
    before: currentPrices(totals, b),
    after: currentPrices(updated, b),
  };
  return {
    cost: after - before,
    updatedTotals: updated,
    prices,
  };
}


