import { NextResponse } from "next/server";
import { makeLogoutCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { ok: true },
    { headers: { "set-cookie": makeLogoutCookie() } }
  );
}
