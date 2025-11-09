import { NextResponse } from "next/server";
import { clearSession, getSessionTokenFromRequest } from "@/lib/users";

export async function POST() {
  const token = await getSessionTokenFromRequest();
  await clearSession(token);
  return NextResponse.json({ success: true });
}


