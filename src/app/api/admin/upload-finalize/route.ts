import { NextResponse } from "next/server";
import { verifySession, readSessionFromRequest } from "@/lib/auth";
import {
  assembleChunks,
  cleanupSession,
  putReleaseChunk,
  deleteReleaseFile,
  getVersionRow,
  getTurso,
} from "@/lib/turso";
import {
  getGithubConfig,
  createRelease,
  uploadAsset,
  getReleaseByTag,
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

// Guarda el archivo ensamblado en Turso (release_files) en trozos de 3MB.
async function storeInTurso(
  version: string,
  fileIndex: number,
  data: Uint8Array
): Promise<number> {
  const CHUNK = 3 * 1024 * 1024;
  // Arreglo v2: se borra SOLO el archivo indicado. Antes se borraban TODOS los
  // archivos de la versión, y guardar el CLIENTE después del SERVIDOR dejaba
  // al SERVIDOR sin copia en Turso (si GitHub fallaba, su enlace era un 404).
  await deleteReleaseFile(version, fileIndex);
  let chunks = 0;
  for (let off = 0; off < data.length || off === 0; off += CHUNK) {
    const end = Math.min(off + CHUNK, data.length);
    await putReleaseChunk({
      version,
      fileIndex,
      chunkIndex: chunks,
      data: data.subarray(off, end),
    });
    chunks++;
    if (end >= data.length) break;
  }
  return chunks;
}

// GitHub es OPCIONAL (la cuenta puede estar suspendida; Turso es el
// almacenamiento primario). Devuelve la URL del asset o null.
async function tryGithubAsset(
  version: string,
  changelog: string,
  filename: string,
  data: Uint8Array
): Promise<string | null> {
  try {
    const cfg = getGithubConfig();
    const tag = tagFromVersion(version);
    let release = await getReleaseByTag({ cfg, tag });
    if (!release) {
      release = await createRelease({
        cfg,
        tag,
        name: `PuenteZebra ${tag}`,
        body: changelog || `Versión ${version}`,
      });
    }
    const url = await uploadAsset({
      cfg,
      releaseId: release.id,
      filename,
      data: data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength
      ) as ArrayBuffer,
      contentType: "application/vnd.microsoft.portable-executable",
    });
    return url;
  } catch {
    return null; // GitHub no disponible: seguimos con Turso
  }
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

  try {
    // 1) Ensamblar ambos archivos desde los chunks
    const [servidor, cliente] = await Promise.all([
      assembleChunks({ sessionId, fileIndex: 0 }),
      assembleChunks({ sessionId, fileIndex: 1 }),
    ]);

    if (servidor.totalChunks === 0 || cliente.totalChunks === 0) {
      return NextResponse.json(
        {
          error:
            "Faltan chunks. Verifica que ambos archivos se hayan subido completo.",
        },
        { status: 400 }
      );
    }

    // 2) Guardar permanentemente en Turso (almacenamiento primario)
    const chunksServidor = await storeInTurso(version, 0, servidor.data);
    const chunksCliente = await storeInTurso(version, 1, cliente.data);

    // 3) GitHub opcional (best-effort, nunca rompe la publicación)
    const [ghServidor, ghCliente] = await Promise.all([
      tryGithubAsset(version, changelog, "PuenteZebra-SERVIDOR.exe", servidor.data),
      tryGithubAsset(version, changelog, "PuenteZebra-CLIENTE.exe", cliente.data),
    ]);

    const servidorUrl =
      ghServidor ?? `/api/download/${version}/SERVIDOR`;
    const clienteUrl = ghCliente ?? `/api/download/${version}/CLIENTE`;

    // 4) Insertar o actualizar la fila de la versión (version es UNIQUE)
    const existing = await getVersionRow(version);
    let id: number;
    if (existing) {
      const c = getTurso();
      if (isLatest) await c.execute("UPDATE versions SET is_latest = 0");
      await c.execute({
        sql: `UPDATE versions SET release_date = ?, changelog = ?, servidor_url = ?, cliente_url = ?${
          isLatest ? ", is_latest = 1" : ""
        } WHERE id = ?`,
        args: [releaseDate, changelog, servidorUrl, clienteUrl, existing.id],
      });
      id = existing.id;
    } else {
      const { insertVersion } = await import("@/lib/turso");
      id = await insertVersion({
        version,
        release_date: releaseDate,
        changelog,
        servidor_url: servidorUrl,
        cliente_url: clienteUrl,
        is_latest: isLatest,
      });
    }

    // 5) Limpieza de chunks temporales
    await cleanupSession(sessionId);

    return NextResponse.json({
      ok: true,
      id,
      version,
      storage: "turso",
      github: {
        servidor: ghServidor,
        cliente: ghCliente,
        ok: Boolean(ghServidor && ghCliente),
      },
      chunks: { servidor: chunksServidor, cliente: chunksCliente },
      servidorUrl,
      clienteUrl,
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
