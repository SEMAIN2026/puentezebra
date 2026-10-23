import { NextResponse } from "next/server";
import { verifySession, readSessionFromRequest } from "@/lib/auth";
import { deleteVersion, listVersions } from "@/lib/turso";
import {
  getGithubConfig,
  getReleaseByTag,
  deleteRelease,
  tagFromVersion,
} from "@/lib/github";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token = readSessionFromRequest(req);
  if (!verifySession(token)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  let body: { id?: number; version?: string; deleteGithub?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const id = Number(body.id);
  const version = body.version?.trim();
  if (!id || !version) {
    return NextResponse.json({ error: "Faltan id / version" }, { status: 400 });
  }
  const tag = tagFromVersion(version);
  const deleteGithub = body.deleteGithub === true;

  try {
    // 1) Delete from Turso
    await deleteVersion(id);

    // 2) Optionally delete from GitHub
    let ghDeleted = false;
    if (deleteGithub) {
      const cfg = getGithubConfig();
      const release = await getReleaseByTag({ cfg, tag });
      if (release) {
        await deleteRelease({ cfg, releaseId: release.id, tag });
        ghDeleted = true;
      }
    }

    // 3) If we deleted the latest, promote the next one
    const remaining = await listVersions();
    const hasLatest = remaining.some((v) => v.is_latest === 1);
    if (!hasLatest && remaining.length > 0) {
      // promote newest
      const newest = remaining[0]; // already sorted DESC by id
      const { setLatest } = await import("@/lib/turso");
      await setLatest(newest.id);
    }

    return NextResponse.json({ ok: true, ghDeleted, promoted: !hasLatest && remaining.length > 0 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
