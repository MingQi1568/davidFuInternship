import { NextResponse } from "next/server";
import {
  getSessionTokenFromRequest,
  loadSession,
} from "@/lib/users";

export async function GET() {
  const token = await getSessionTokenFromRequest();
  if (!token) {
    return NextResponse.json({ message: "Not logged in" }, { status: 401 });
  }
  const session = loadSession(token);
  if (!session) {
    return NextResponse.json({ message: "Session expired" }, { status: 401 });
  }
  return NextResponse.json(session);
}


