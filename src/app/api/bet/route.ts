import { NextResponse } from "next/server";
import { z } from "zod";
import { SECURITIES, type Security } from "@/lib/constants";
import {
  getSessionTokenFromRequest,
  loadSession,
  placeBet,
} from "@/lib/users";

const securities = [...SECURITIES];

const schema = z.object({
  security: z
    .string()
    .refine((value): value is Security => securities.includes(value as Security), {
      message: "Invalid security",
    }),
  amount: z.number().positive("Amount must be positive"),
  side: z.enum(["buy", "sell"]).default("buy"),
});

export async function POST(request: Request) {
  try {
    const token = await getSessionTokenFromRequest();
    if (!token) {
      return NextResponse.json({ message: "Not logged in" }, { status: 401 });
    }
    const session = loadSession(token);
    if (!session) {
      return NextResponse.json({ message: "Not logged in" }, { status: 401 });
    }

    const payload = await request.json();
    const { security, amount, side } = schema.parse(payload);

    const updated = placeBet({ token, security, amount, side });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Bet failed" },
      { status: 400 }
    );
  }
}


