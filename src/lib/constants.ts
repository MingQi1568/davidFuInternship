export const SECURITIES = [
  "Jane Street",
  "Citadel",
  "Bridgewater",
  "D E Shaw",
  "Radix",
] as const;

export type Security = (typeof SECURITIES)[number];

export const STARTING_CHIPS = 100;


