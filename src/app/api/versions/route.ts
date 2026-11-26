import { NextResponse } from "next/server";
import { listVersions, getLatestVersion } from "@/lib/turso";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const onlyLatest = url.searchParams.get("latest") === "1";
  try {
    if (onlyLatest) {
      const v = await getLatestVersion();
      return NextResponse.json({ latest: v });
    }
    const list = await listVersions();
    return NextResponse.json({ versions: list });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
