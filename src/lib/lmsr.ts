import type { Security } from "./constants";
import { getDb, getSecurities } from "./db";
import {
  computeCost,
  currentPrices,
  quoteTrade,
  type Totals,
} from "./lmsrMath";

export type { Totals } from "./lmsrMath";

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

export { computeCost, currentPrices };

export function evaluateTrade(totals: Totals, security: Security, amount: number) {
  return quoteTrade({ totals, security, amount });
}


