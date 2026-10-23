import { NextResponse } from "next/server";
import { verifySession, readSessionFromRequest } from "@/lib/auth";
import {
  assembleChunks,
  cleanupSession,
  insertVersion,
} from "@/lib/turso";
import {
  getGithubConfig,
  createRelease,
  uploadAsset,
  getReleaseByTag,
  deleteRelease,
  tagFromVersion,
} from "@/lib/github";

export const runtime = "nodejs";
export const maxDuration = 120;

interface FinalizeBody {
  sessionId?: string;
  version?: string;
  releaseDate?: string;
  changelog?: string;
  isLatest?: boolean;
}

export async function POST(req: Request) {
  const token = readSessionFromRequest(req);
  if (!verifySession(token)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  let body: FinalizeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim();
  const version = body.version?.trim();
  const releaseDate = body.releaseDate?.trim();
  const changelog = body.changelog?.trim() ?? "";
  const isLatest = body.isLatest === true;

  if (!sessionId || !version || !releaseDate) {
    return NextResponse.json(
      { error: "Faltan campos: sessionId, version, releaseDate" },
      { status: 400 }
    );
  }
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    return NextResponse.json(
      { error: "La versión debe tener formato X.Y.Z (ej. 1.2.0)" },
      { status: 400 }
    );
  }

  const cfg = getGithubConfig();
  const tag = tagFromVersion(version);

  try {
    // 1) Assemble both files
    const [servidor, cliente] = await Promise.all([
      assembleChunks({ sessionId, fileIndex: 0 }),
      assembleChunks({ sessionId, fileIndex: 1 }),
    ]);

    if (servidor.totalChunks === 0 || cliente.totalChunks === 0) {
      return NextResponse.json(
        { error: "Faltan chunks. Verifica que ambos archivos se hayan subido completo." },
        { status: 400 }
      );
    }

    // 2) Create or reuse GitHub release
    let release = await getReleaseByTag({ cfg, tag });
    if (!release) {
      release = await createRelease({
        cfg,
        tag,
        name: `PuenteZebra ${tag}`,
        body: changelog || `Versión ${version}`,
      });
    }

    // 3) Upload both assets (server -> GitHub, no Vercel body limit)
    const servidorUrl = await uploadAsset({
      cfg,
      releaseId: release.id,
      filename: "PuenteZebra-SERVIDOR.exe",
      data: servidor.data.buffer,
      contentType: "application/vnd.microsoft.portable-executable",
    });
    const clienteUrl = await uploadAsset({
      cfg,
      releaseId: release.id,
      filename: "PuenteZebra-CLIENTE.exe",
      data: cliente.data.buffer,
      contentType: "application/vnd.microsoft.portable-executable",
    });

    // 4) Insert into Turso
    const id = await insertVersion({
      version,
      release_date: releaseDate,
      changelog,
      servidor_url: servidorUrl,
      cliente_url: clienteUrl,
      is_latest: isLatest,
    });

    // 5) Cleanup chunks
    await cleanupSession(sessionId);

    return NextResponse.json({
      ok: true,
      id,
      version,
      tag,
      servidorUrl,
      clienteUrl,
      releaseUrl: release.htmlUrl,
    });
  } catch (e) {
    // Best-effort cleanup on error
    try {
      if (sessionId) await cleanupSession(sessionId);
    } catch {}
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
