"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SECURITIES } from "@/lib/constants";
import type { SessionData } from "@/lib/types";

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
      setMessage("Enter a positive amount to bet.");
      return;
    }
    setStatus("loading");
    setMessage(null);
    try {
      const response = await fetch("/api/bet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ security, amount }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.message ?? "Bet failed.");
        return;
      }
      setSession(payload as SessionData);
      setBetInputs((prev) => ({ ...prev, [security]: "" }));
      setMessage(`Placed bet of ${amount} on ${security}.`);
    } catch (error) {
      console.error(error);
      setMessage("Unexpected error placing bet.");
    } finally {
      setStatus("idle");
    }
  };

  const marketRows = useMemo(() => {
    if (!session) return [] as Array<{
      security: string;
      position: number;
      price: number;
      totalShares: number;
    }>;
    return SECURITIES.map((security) => {
      const position =
        session.positions.find((pos) => pos.security === security)?.shares ?? 0;
      const price = session.prices[security] ?? 0;
      const totalShares = session.totals[security] ?? 0;
      return { security, position, price, totalShares };
    });
  }, [session]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <header className="border-b border-white/10 bg-black/30 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            David Fu Internship Markets
          </h1>
          {session ? (
            <div className="flex items-center gap-6 text-sm text-slate-200">
              <div>
                <span className="font-medium">{session.user.name}</span>
                <span className="ml-3 rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-300">
                  {formatter.format(session.user.chips)} chips
                </span>
              </div>
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
              Sign in with your name to receive 100 chips and start trading who
              you think landed David&apos;s internship.
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
                  Prices follow the Logarithmic Market Scoring Rule (LMSR). If
                  David joins a firm, each share pays out 1 chip.
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
              <div className="grid grid-cols-1 gap-2 text-xs uppercase tracking-wide text-slate-400 sm:grid-cols-[2fr,1fr,1fr,1fr,1.2fr]">
                <span>Firm</span>
                <span>Price</span>
                <span>Your Shares</span>
                <span>Total Shares</span>
                <span>Amount to Buy</span>
              </div>
              <div className="space-y-3">
                {marketRows.map(({ security, position, price, totalShares }) => (
                  <div
                    key={security}
                    className="grid grid-cols-1 items-center gap-4 rounded-xl border border-white/5 bg-white/5 p-4 text-sm sm:grid-cols-[2fr,1fr,1fr,1fr,1.2fr]"
                  >
                    <div>
                      <p className="font-medium text-white">{security}</p>
                      <p className="text-xs text-slate-300">
                        LMSR price for a 1 chip payout.
                      </p>
                    </div>
                    <div className="font-mono text-base text-emerald-300">
                      {formatter.format(price)}
                    </div>
                    <div className="font-mono text-slate-100">
                      {formatter.format(position)}
                    </div>
                    <div className="font-mono text-slate-300">
                      {formatter.format(totalShares)}
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40"
                        inputMode="decimal"
                        placeholder="0.0"
                        value={betInputs[security] ?? ""}
                        onChange={(event) =>
                          setBetInputs((prev) => ({
                            ...prev,
                            [security]: event.target.value,
                          }))
                        }
                        disabled={isLoading}
                      />
                      <button
                        className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => void handleBet(security)}
                        disabled={isLoading}
                      >
                        {isLoading ? "..." : "Buy"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <footer className="mt-6 text-xs text-slate-400">
              Chips spent are deducted instantly based on the LMSR cost
              function. Markets remain open until David announces his final
              destination.
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
