import { NextResponse } from "next/server";
import { verifySession, readSessionFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const token = readSessionFromRequest(req);
  return NextResponse.json({ authenticated: verifySession(token) });
}
