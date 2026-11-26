import { NextResponse } from "next/server";
import { getLatestVersion } from "@/lib/turso";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const v = await getLatestVersion();
    return NextResponse.json({ latest: v });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
