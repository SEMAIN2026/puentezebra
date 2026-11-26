import { NextResponse } from "next/server";
import { verifySession, readSessionFromRequest } from "@/lib/auth";
import {
  deleteVersion,
  deleteReleaseFiles,
  listVersions,
} from "@/lib/turso";
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
    // 1) Borrar archivos permanentes de Turso (almacenamiento primario)
    await deleteReleaseFiles(version);

    // 2) Borrar la fila de la versión
    await deleteVersion(id);

    // 3) GitHub opcional (best-effort; si la cuenta está suspendida, se ignora)
    let ghDeleted = false;
    if (deleteGithub) {
      try {
        const cfg = getGithubConfig();
        const release = await getReleaseByTag({ cfg, tag });
        if (release) {
          await deleteRelease({ cfg, releaseId: release.id, tag });
          ghDeleted = true;
        }
      } catch {
        ghDeleted = false; // GitHub no disponible: la versión ya se borró de Turso
      }
    }

    // 4) Si borramos la latest, promover la siguiente
    const remaining = await listVersions();
    const hasLatest = remaining.some((v) => v.is_latest === 1);
    if (!hasLatest && remaining.length > 0) {
      const newest = remaining[0]; // ya viene ordenado DESC por id
      const { setLatest } = await import("@/lib/turso");
      await setLatest(newest.id);
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
