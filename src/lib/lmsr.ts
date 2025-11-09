import type { Security } from "./constants";
import { getDb, getSecurities } from "./db";

const B = 20; // liquidity parameter

export type Totals = Record<Security, number>;

export function getMarketState(): Totals {
  const db = getDb();
  const rows = db
    .prepare(`SELECT security, shares FROM market_totals`)
    .all() as { security: Security; shares: number }[];
  const totals: Totals = Object.fromEntries(
    getSecurities().map((security) => [security, 0])
  ) as Totals;
  for (const row of rows) {
    totals[row.security] = row.shares;
  }
  return totals;
}

export function computeCost(q: Totals) {
  const sum = Object.values(q).reduce(
    (acc, shares) => acc + Math.exp(shares / B),
    0
  );
  return B * Math.log(sum);
}

export function currentPrices(totals: Totals) {
  const numerator = Object.fromEntries(
    Object.entries(totals).map(([security, shares]) => [
      security,
      Math.exp(shares / B),
    ])
  ) as Record<Security, number>;

  const denom = Object.values(numerator).reduce((acc, val) => acc + val, 0);
  const prices: Record<Security, number> = Object.fromEntries(
    Object.entries(numerator).map(([security, value]) => [
      security,
      value / denom,
    ])
  ) as Record<Security, number>;
  return prices;
}

export function quotePurchase(totals: Totals, security: Security, amount: number) {
  if (amount <= 0) {
    throw new Error("Amount must be positive");
  }

  const before = computeCost(totals);
  const updated = { ...totals, [security]: totals[security] + amount };
  const after = computeCost(updated);
  const prices = currentPrices(totals);
  return {
    cost: after - before,
    price: prices[security],
    updatedTotals: updated,
  };
}


