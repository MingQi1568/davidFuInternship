import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { STARTING_CHIPS, type Security } from "./constants";
import { getDb, getSecurities } from "./db";
import { currentPrices, evaluateTrade, getMarketState } from "./lmsr";
import type { PositionRecord, SessionData, UserRecord } from "./types";

const SESSION_COOKIE = "session_token";
async function getCookieStore() {
  try {
    return await cookies();
  } catch {
    // When invoked outside of request context
    return null;
  }
}

function ensurePositionsForUser(userId: string) {
  const db = getDb();
  const existing = db
    .prepare(`SELECT security FROM positions WHERE user_id = ?`)
    .all(userId) as { security: Security }[];
  const existingSet = new Set(existing.map((row) => row.security));
  for (const security of getSecurities()) {
    if (!existingSet.has(security)) {
      db.prepare(
        `INSERT INTO positions (id, user_id, security, shares) VALUES (?, ?, ?, 0)`
      ).run(randomUUID(), userId, security);
    }
  }
}

export async function getSessionTokenFromRequest(): Promise<string | null> {
  const store = await getCookieStore();
  if (!store) {
    return null;
  }
  const cookie = store.get(SESSION_COOKIE);
  return cookie?.value ?? null;
}

export function createOrGetUser(name: string) {
  const db = getDb();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Name is required");
  }
  const existing = db
    .prepare(`SELECT id, name, chips FROM users WHERE name = ?`)
    .get(trimmed) as UserRecord | undefined;
  if (existing) {
    ensurePositionsForUser(existing.id);
    return existing;
  }
  const id = randomUUID();
  db.prepare(`INSERT INTO users (id, name, chips) VALUES (?, ?, ?)`).run(
    id,
    trimmed,
    STARTING_CHIPS
  );
  ensurePositionsForUser(id);

  return {
    id,
    name: trimmed,
    chips: STARTING_CHIPS,
  };
}

export async function createSession(userId: string) {
  const db = getDb();
  const token = randomUUID();
  db.prepare(`INSERT INTO sessions (token, user_id) VALUES (?, ?)`).run(
    token,
    userId
  );
  const store = await getCookieStore();
  await store?.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return token;
}

export async function clearSession(token: string | null) {
  if (!token) return;
  const db = getDb();
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
  const store = await getCookieStore();
  await store?.delete(SESSION_COOKIE);
}

export function loadSession(
  token: string | null
): SessionData | null {
  if (!token) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.name, u.chips
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token) as UserRecord | undefined;
  if (!row) {
    return null;
  }
  ensurePositionsForUser(row.id);

  const positions = db
    .prepare(
      `SELECT security, shares
       FROM positions
       WHERE user_id = ?
       ORDER BY security`
    )
    .all(row.id) as PositionRecord[];

  const totals = getMarketState();
  const prices = currentPrices(totals);

  return {
    user: row,
    positions,
    totals,
    prices,
  };
}

export function placeBet({
  token,
  security,
  amount,
  side,
}: {
  token: string;
  security: Security;
  amount: number;
  side: "buy" | "sell";
}): SessionData {
  const db = getDb();
  const session = loadSession(token);
  if (!session) {
    throw new Error("Invalid session");
  }
  if (!(getSecurities() as readonly string[]).includes(security)) {
    throw new Error("Invalid security");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be positive");
  }

  const tradeAmount = side === "sell" ? -amount : amount;

  const totals = getMarketState();
  const { cost } = evaluateTrade(totals, security, tradeAmount);

  const position = session.positions.find((pos) => pos.security === security);
  const currentShares = position?.shares ?? 0;

  if (side === "sell" && currentShares < amount - 1e-9) {
    throw new Error("Not enough shares to sell");
  }

  const resultingChips = session.user.chips - cost;
  if (side === "buy" && resultingChips < -1e-9) {
    throw new Error("Not enough chips");
  }

  const updateMarket = db.prepare(
    `UPDATE market_totals SET shares = shares + ? WHERE security = ?`
  );
  const updateUser = db.prepare(
    `UPDATE users SET chips = chips - ? WHERE id = ?`
  );
  const updatePosition = db.prepare(
    `UPDATE positions SET shares = shares + ? WHERE user_id = ? AND security = ?`
  );

  const transaction = db.transaction(() => {
    updateMarket.run(tradeAmount, security);
    updateUser.run(cost, session.user.id);
    updatePosition.run(tradeAmount, session.user.id, security);
  });

  transaction();

  const refreshed = loadSession(token);
  if (!refreshed) {
    throw new Error("Session expired");
  }
  return refreshed;
}


