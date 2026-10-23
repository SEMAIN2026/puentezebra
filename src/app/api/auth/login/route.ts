import { NextResponse } from "next/server";
import {
  verifyPassword,
  verifySession,
  makeSessionCookie,
  readSessionFromRequest,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const password = (body.password ?? "").trim();
  if (!password) {
    return NextResponse.json({ error: "Falta la contraseña" }, { status: 400 });
  }
  // If already logged in, just return success
  const existing = readSessionFromRequest(req);
  if (verifySession(existing)) {
    return NextResponse.json({ ok: true, already: true });
  }
  if (!verifyPassword(password)) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }
  const cookie = makeSessionCookie();
  return NextResponse.json(
    { ok: true },
    { headers: { "set-cookie": cookie } }
  );
}
