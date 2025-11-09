import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { STARTING_CHIPS, type Security } from "./constants";
import { getDb, getSecurities } from "./db";
import { currentPrices, getMarketState, quotePurchase } from "./lmsr";
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
    return existing;
  }
  const id = randomUUID();
  db.prepare(`INSERT INTO users (id, name, chips) VALUES (?, ?, ?)`).run(
    id,
    trimmed,
    STARTING_CHIPS
  );
  for (const security of getSecurities()) {
    db.prepare(
      `INSERT INTO positions (id, user_id, security, shares) VALUES (?, ?, ?, 0)`
    ).run(randomUUID(), id, security);
  }

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
}: {
  token: string;
  security: Security;
  amount: number;
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

  const totals = getMarketState();
  const { cost } = quotePurchase(totals, security, amount);

  if (session.user.chips < cost) {
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
    updateMarket.run(amount, security);
    updateUser.run(cost, session.user.id);
    updatePosition.run(amount, session.user.id, security);
  });

  transaction();

  const refreshed = loadSession(token);
  if (!refreshed) {
    throw new Error("Session expired");
  }
  return refreshed;
}


