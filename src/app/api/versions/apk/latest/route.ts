import { NextResponse } from "next/server";
import { getLatestApkVersion } from "@/lib/turso";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const row = await getLatestApkVersion();
    if (!row) {
      return NextResponse.json({ latest: null });
    }
    const origin = new URL(req.url).origin;
    const url = row.apk_url.startsWith("http")
      ? row.apk_url
      : origin + row.apk_url;
    return NextResponse.json({
      latest: {
        ...row,
        versionCode: row.version_code,
        url,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 }
    );
  }
}
