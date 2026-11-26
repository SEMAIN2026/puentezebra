import { NextResponse } from "next/server";
import { verifySession, readSessionFromRequest } from "@/lib/auth";
import {
  deleteApkVersion,
  deleteReleaseFiles,
  listApkVersions,
  setLatestApk,
} from "@/lib/turso";
import {
  getGithubConfig,
  getReleaseByTag,
  deleteRelease,
} from "@/lib/github";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  try {
    // 1) Borrar el APK de release_files (almacenamiento primario)
    await deleteReleaseFiles(`android-${version}`);

    // 2) Borrar la fila
    await deleteApkVersion(id);

    // 3) GitHub opcional (best-effort)
    let ghDeleted = false;
    if (body.deleteGithub === true) {
      try {
        const cfg = getGithubConfig();
        const release = await getReleaseByTag({
          cfg,
          tag: `android-v${version}`,
        });
        if (release) {
          await deleteRelease({
            cfg,
            releaseId: release.id,
            tag: `android-v${version}`,
          });
          ghDeleted = true;
        }
      } catch {
        ghDeleted = false;
      }
    }

    // 4) Si borramos la latest, promover la siguiente
    const remaining = await listApkVersions();
    const hasLatest = remaining.some((v) => v.is_latest === 1);
    if (!hasLatest && remaining.length > 0) {
      await setLatestApk(remaining[0].id);
    }

    return NextResponse.json({
      ok: true,
      ghDeleted,
      promoted: !hasLatest && remaining.length > 0,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
