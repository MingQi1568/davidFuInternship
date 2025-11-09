import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createOrGetUser,
  createSession,
  loadSession,
} from "@/lib/users";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(64, "Name too long"),
});

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { name } = schema.parse(payload);

    const user = createOrGetUser(name);
    const token = await createSession(user.id);
    const session = loadSession(token);

    return NextResponse.json(session);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    return NextResponse.json({ message: "Login failed" }, { status: 500 });
  }
}


