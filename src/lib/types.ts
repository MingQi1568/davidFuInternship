import type { Security } from "./constants";

export type UserRecord = {
  id: string;
  name: string;
  chips: number;
};

export type PositionRecord = {
  security: Security;
  shares: number;
};

export type SessionData = {
  user: UserRecord;
  positions: PositionRecord[];
  totals: Record<Security, number>;
  prices: Record<Security, number>;
};


