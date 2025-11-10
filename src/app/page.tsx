"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FIRMS } from "@/lib/constants";
import type { SessionData } from "@/lib/types";
import { quoteTrade } from "@/lib/lmsrMath";

type FetchState = "idle" | "loading";

const formatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 3,
  minimumFractionDigits: 0,
});

export default function Home() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [status, setStatus] = useState<FetchState>("idle");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [betInputs, setBetInputs] = useState<Record<string, string>>({});
  const [betSides, setBetSides] = useState<Record<string, "buy" | "sell">>({});

  const isLoading = status === "loading";

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch("/api/me", {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
        },
      });
      if (!response.ok) {
        setSession(null);
        return;
      }
      const data = (await response.json()) as SessionData;
      setSession(data);
      setMessage(null);
    } catch (error) {
      console.error(error);
      setSession(null);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setMessage("Please enter your name.");
      return;
    }
    setStatus("loading");
    setMessage(null);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const error = await response.json();
        setMessage(error.message ?? "Login failed.");
        return;
      }
      const data = (await response.json()) as SessionData;
      setSession(data);
      setName("");
      setBetInputs({});
    } catch (error) {
      console.error(error);
      setMessage("Unexpected error logging in.");
    } finally {
      setStatus("idle");
    }
  };

  const handleBet = async (security: string) => {
    if (!session) return;
    const raw = betInputs[security] ?? "0";
    const amount = Number.parseFloat(raw);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Enter a positive number of shares.");
      return;
    }
    const side = betSides[security] ?? "buy";
    setStatus("loading");
    setMessage(null);
    try {
      const response = await fetch("/api/bet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ security, amount, side }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.message ?? "Bet failed.");
        return;
      }
      setSession(payload as SessionData);
      setBetInputs((prev) => ({ ...prev, [security]: "" }));
      setMessage(`Placed ${side} order of ${amount} share(s) for ${security}.`);
    } catch (error) {
      console.error(error);
      setMessage("Unexpected error placing order.");
    } finally {
      setStatus("idle");
    }
  };

  const handleLogout = async () => {
    setStatus("loading");
    setMessage(null);
    try {
      await fetch("/api/logout", {
        method: "POST",
      });
      setSession(null);
      setBetInputs({});
      setBetSides({});
      setMessage("You have been logged out.");
    } catch (error) {
      console.error(error);
      setMessage("Unexpected error logging out.");
    } finally {
      setStatus("idle");
    }
  };

  const marketRows = useMemo(() => {
    if (!session)
      return [] as Array<{
        name: string;
        logo: string;
        position: number;
        price: number;
        totalShares: number;
      }>;
    return FIRMS.map((firm) => {
      const position =
        session.positions.find((pos) => pos.security === firm.name)?.shares ?? 0;
      const price = session.prices[firm.name] ?? 0;
      const totalShares = session.totals[firm.name] ?? 0;
      return { name: firm.name, logo: firm.logo, position, price, totalShares };
    });
  }, [session]);

  const quotes = useMemo(() => {
    if (!session) return {} as Record<string, number | null>;
    const result: Record<string, number | null> = {};
    for (const firm of FIRMS) {
      const raw = betInputs[firm.name];
      const amount = Number.parseFloat(raw ?? "");
      if (!Number.isFinite(amount) || amount <= 0) {
        result[firm.name] = null;
        continue;
      }
      const side = betSides[firm.name] ?? "buy";
      try {
        const { cost } = quoteTrade({
          totals: session.totals,
          security: firm.name,
          amount: side === "sell" ? -amount : amount,
        });
        result[firm.name] = cost;
      } catch {
        result[firm.name] = null;
      }
    }
    return result;
  }, [betInputs, betSides, session]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <header className="border-b border-white/10 bg-black/30 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            David Fu Internship Market
          </h1>
          {session ? (
            <div className="flex items-center gap-6 text-sm text-slate-200">
              <div>
                <span className="font-medium">{session.user.name}</span>
                <span className="ml-3 rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-300">
                  {formatter.format(session.user.chips)} chips
                </span>
              </div>
              <button
                className="rounded-lg border border-white/10 px-3 py-2 text-xs uppercase tracking-wide text-slate-200 transition hover:border-emerald-300 hover:text-emerald-200 disabled:cursor-wait"
                onClick={() => void handleLogout()}
                disabled={isLoading}
              >
                Logout
              </button>
            </div>
          ) : (
            <span className="text-sm text-slate-300">
              Start by logging in with your name.
            </span>
          )}
        </div>
      </header>
      <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
        {!session ? (
          <section className="rounded-2xl border border-white/10 bg-black/40 p-8 shadow-xl">
            <h2 className="text-xl font-semibold">Enter the market</h2>
            <p className="mt-2 text-sm text-slate-300">
              Sign in with your name to receive 100 chips and start trading
              shares on where you think David&apos;s internship landed.
            </p>
            <form className="mt-6 flex flex-col gap-4" onSubmit={handleLogin}>
              <label className="text-sm font-medium text-slate-200">
                Name
                <input
                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/10 px-4 py-3 text-base text-white placeholder-slate-400 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  disabled={isLoading}
                />
              </label>
              <button
                className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-5 py-3 font-medium text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? "Signing you in..." : "Join the market"}
              </button>
            </form>
          </section>
        ) : (
          <section className="rounded-2xl border border-white/10 bg-black/40 p-8 shadow-xl">
            <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Markets</h2>
                <p className="text-sm text-slate-300">
                  Each share in a firm will payout 1 chip if David eventually joins them, and 0 otherwise. Enter the number of shares you want to buy or sell and
                  review the quoted chip cost before placing your order. You can think of price as probability.
                </p>
              </div>
              <button
                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 transition hover:border-emerald-300 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void refreshSession()}
                disabled={isLoading}
              >
                Refresh
              </button>
            </header>
            <div className="mt-6 grid gap-4">
              <div className="space-y-3">
                {marketRows.map(({ name: security, logo, position, price, totalShares }) => {
                  const side = betSides[security] ?? "buy";
                  const raw = betInputs[security] ?? "";
                  const amount = Number.parseFloat(raw);
                  const quote = quotes[security];
                  const insufficientShares =
                    side === "sell" && Number.isFinite(amount) && amount > position;
                  return (
                    <div
                      key={security}
                      className="flex flex-col gap-4 rounded-xl border border-white/5 bg-white/5 p-5 text-sm sm:flex-row sm:items-center"
                    >
                      <div className="flex flex-1 items-center gap-4">
                        <Image
                          src={logo}
                          alt={`${security} logo`}
                          width={56}
                          height={56}
                          className="h-14 w-14 flex-shrink-0 rounded-xl border border-white/10 object-cover"
                        />
                        <div className="space-y-1">
                          <p className="text-lg font-semibold text-white">{security}</p>
                          <p className="text-xs uppercase tracking-wide text-slate-400">
                            Price (chips per share): <span className="font-mono text-emerald-300">{formatter.format(price)}</span>
                          </p>
                          <div className="flex flex-wrap gap-4 text-xs text-slate-300">
                            <span>
                              Your Shares: <span className="font-mono text-slate-100">{formatter.format(position)}</span>
                            </span>
                            <span>
                              Total Shares: <span className="font-mono text-slate-200">{formatter.format(totalShares)}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 sm:w-64">
                        <div className="flex items-center gap-2 text-xs uppercase text-slate-300">
                          <label className="flex items-center gap-1">
                            <input
                              type="radio"
                              name={`${security}-side`}
                              checked={side === "buy"}
                              onChange={() =>
                                setBetSides((prev) => ({ ...prev, [security]: "buy" }))
                              }
                            />
                            Buy
                          </label>
                          <label className="flex items-center gap-1">
                            <input
                              type="radio"
                              name={`${security}-side`}
                              checked={side === "sell"}
                              onChange={() =>
                                setBetSides((prev) => ({ ...prev, [security]: "sell" }))
                              }
                            />
                            Sell
                          </label>
                        </div>
                        <input
                          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
                          inputMode="decimal"
                          placeholder="0 shares"
                          value={raw}
                          onChange={(event) =>
                            setBetInputs((prev) => ({
                              ...prev,
                              [security]: event.target.value,
                            }))
                          }
                          disabled={isLoading}
                        />
                        <div className="text-xs text-slate-300">
                          {quote !== null && Number.isFinite(quote) && raw !== "" ? (
                            <span>
                              Quote: <span className="font-mono text-emerald-200">{formatter.format(Math.abs(quote))}</span>
                              {" "}chips {quote >= 0 ? (side === "buy" ? "required" : "refunded") : side === "sell" ? "received" : "credited"}
                            </span>
                          ) : (
                            <span>Enter shares to see the current price quote.</span>
                          )}
                          {insufficientShares ? (
                            <span className="block text-amber-300">Not enough shares to sell that amount.</span>
                          ) : null}
                        </div>
                        <button
                          className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => void handleBet(security)}
                          disabled={isLoading || insufficientShares}
                        >
                          {isLoading ? "..." : side === "buy" ? "Buy" : "Sell"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <footer className="mt-6 text-xs text-slate-400">
              Prices update automatically as traders buy or sell shares. Chips
              move immediately whenever an order is filled.
            </footer>
          </section>
        )}
        {message ? (
          <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {message}
          </div>
        ) : null}
      </main>
    </div>
  );
}
