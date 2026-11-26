import { createClient, type Client } from "@libsql/client";
import { envValue } from "@/lib/env";

// Singleton Turso client. Safe for serverless (each invocation re-creates).
let _client: Client | null = null;

export function getTurso(): Client {
  if (_client) return _client;
  const url = envValue("TURSO_DATABASE_URL");
  const authToken = envValue("TURSO_AUTH_TOKEN");
  if (!url || !authToken) {
    throw new Error(
      "Faltan variables de entorno TURSO_DATABASE_URL / TURSO_AUTH_TOKEN"
    );
  }
  _client = createClient({ url, authToken });
  return _client;
}

export interface VersionRow {
  id: number;
  version: string;
  release_date: string;
  changelog: string | null;
  servidor_url: string;
  cliente_url: string;
  is_latest: number;
  created_at: string;
}

export async function listVersions(): Promise<VersionRow[]> {
  const c = getTurso();
  const res = await c.execute(
    "SELECT id, version, release_date, changelog, servidor_url, cliente_url, is_latest, created_at FROM versions ORDER BY id DESC"
  );
  return res.rows as unknown as VersionRow[];
}

export async function getLatestVersion(): Promise<VersionRow | null> {
  const c = getTurso();
  const res = await c.execute(
    "SELECT id, version, release_date, changelog, servidor_url, cliente_url, is_latest, created_at FROM versions WHERE is_latest = 1 ORDER BY id DESC LIMIT 1"
  );
  const rows = res.rows as unknown as VersionRow[];
  return rows[0] ?? null;
}

export async function insertVersion(v: {
  version: string;
  release_date: string;
  changelog: string;
  servidor_url: string;
  cliente_url: string;
  is_latest: boolean;
}): Promise<number> {
  const c = getTurso();
  if (v.is_latest) {
    await c.execute("UPDATE versions SET is_latest = 0");
  }
  const res = await c.execute({
    sql: `INSERT INTO versions (version, release_date, changelog, servidor_url, cliente_url, is_latest)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      v.version,
      v.release_date,
      v.changelog,
      v.servidor_url,
      v.cliente_url,
      v.is_latest ? 1 : 0,
    ],
  });
  return Number(res.lastInsertRowid);
}

export async function deleteVersion(id: number): Promise<void> {
  const c = getTurso();
  await c.execute({ sql: "DELETE FROM versions WHERE id = ?", args: [id] });
}

export async function setLatest(id: number): Promise<void> {
  const c = getTurso();
  await c.execute("UPDATE versions SET is_latest = 0");
  await c.execute({ sql: "UPDATE versions SET is_latest = 1 WHERE id = ?", args: [id] });
}

/* -------- Chunked upload helpers -------- */

export async function putChunk(opts: {
  sessionId: string;
  fileIndex: number;
  chunkIndex: number;
  totalChunks: number;
  filename: string;
  data: Uint8Array;
}): Promise<{ received: number }> {
  const c = getTurso();
  await c.execute({
    sql: `INSERT INTO upload_chunks (session_id, file_index, chunk_index, data)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(session_id, file_index, chunk_index) DO UPDATE SET data = excluded.data`,
    args: [opts.sessionId, opts.fileIndex, opts.chunkIndex, opts.data],
  });
  // Upsert meta
  await c.execute({
    sql: `INSERT INTO upload_meta (session_id, file_index, total_chunks, filename, received, created_at)
          VALUES (?, ?, ?, ?, 1, datetime('now'))
          ON CONFLICT(session_id, file_index) DO UPDATE SET
            total_chunks = excluded.total_chunks,
            filename = excluded.filename`,
    args: [opts.sessionId, opts.fileIndex, opts.totalChunks, opts.filename],
  });
  // Increment received counter
  await c.execute({
    sql: `UPDATE upload_meta SET received = (
            SELECT COUNT(*) FROM upload_chunks
            WHERE session_id = ? AND file_index = ?
          ) WHERE session_id = ? AND file_index = ?`,
    args: [opts.sessionId, opts.fileIndex, opts.sessionId, opts.fileIndex],
  });
  const res = await c.execute({
    sql: `SELECT received FROM upload_meta WHERE session_id = ? AND file_index = ?`,
    args: [opts.sessionId, opts.fileIndex],
  });
  const row = res.rows[0] as { received?: number } | undefined;
  return { received: Number(row?.received ?? 0) };
}

export async function assembleChunks(opts: {
  sessionId: string;
  fileIndex: number;
}): Promise<{ data: Uint8Array; filename: string; totalChunks: number }> {
  const c = getTurso();
  const metaRes = await c.execute({
    sql: `SELECT total_chunks, filename FROM upload_meta WHERE session_id = ? AND file_index = ?`,
    args: [opts.sessionId, opts.fileIndex],
  });
  const meta = metaRes.rows[0] as
    | { total_chunks?: number; filename?: string }
    | undefined;
  if (!meta) {
    throw new Error(`No hay metadatos para session=${opts.sessionId} file=${opts.fileIndex}`);
  }
  const totalChunks = Number(meta.total_chunks ?? 0);
  const filename = String(meta.filename ?? "");
  const dataRes = await c.execute({
    sql: `SELECT data FROM upload_chunks WHERE session_id = ? AND file_index = ? ORDER BY chunk_index ASC`,
    args: [opts.sessionId, opts.fileIndex],
  });
  const parts: Uint8Array[] = [];
  for (const row of dataRes.rows) {
    const b = row.data as Uint8Array | ArrayBuffer | Buffer;
    if (b instanceof Uint8Array) parts.push(b);
    else if (b instanceof ArrayBuffer) parts.push(new Uint8Array(b));
    else parts.push(new Uint8Array(b as unknown as ArrayBufferLike));
  }
  // Concatenate
  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(totalLen);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return { data: out, filename, totalChunks };
}

export async function cleanupSession(sessionId: string): Promise<void> {
  const c = getTurso();
  await c.execute({
    sql: `DELETE FROM upload_chunks WHERE session_id = ?`,
    args: [sessionId],
  });
  await c.execute({
    sql: `DELETE FROM upload_meta WHERE session_id = ?`,
    args: [sessionId],
  });
}

/* -------- Almacenamiento permanente de archivos (release_files) -------- */
/* Los .exe se guardan troceados (3MB) en Turso y se sirven por streaming
   desde /api/download/[version]/[file]. No depende de GitHub. */

export async function putReleaseChunk(opts: {
  version: string;
  fileIndex: number;
  chunkIndex: number;
  data: Uint8Array;
}): Promise<void> {
  const c = getTurso();
  await c.execute({
    sql: `INSERT INTO release_files (version, file_index, chunk_index, data)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(version, file_index, chunk_index) DO UPDATE SET data = excluded.data`,
    args: [opts.version, opts.fileIndex, opts.chunkIndex, opts.data],
  });
}

export async function deleteReleaseFiles(version: string): Promise<void> {
  const c = getTurso();
  await c.execute({
    sql: `DELETE FROM release_files WHERE version = ?`,
    args: [version],
  });
}

// Borra SOLO los trozos de un archivo (fileIndex) de una versión, sin tocar
// los del otro archivo. Arreglo importante: antes storeInTurso borraba TODOS
// los archivos de la versión antes de guardar cada uno, así que guardar el
// CLIENTE después del SERVIDOR BORRABA al SERVIDOR de Turso sin darse cuenta
// (y si GitHub fallaba, su enlace quedaba roto: /api/download → 404).
export async function deleteReleaseFile(
  version: string,
  fileIndex: number
): Promise<void> {
  const c = getTurso();
  await c.execute({
    sql: `DELETE FROM release_files WHERE version = ? AND file_index = ?`,
    args: [version, fileIndex],
  });
}

export interface ReleaseFileMeta {
  totalChunks: number;
  totalBytes: number;
}

export async function getReleaseFileMeta(
  version: string,
  fileIndex: number
): Promise<ReleaseFileMeta | null> {
  const c = getTurso();
  const res = await c.execute({
    sql: `SELECT COUNT(*) AS chunks, COALESCE(SUM(LENGTH(data)), 0) AS bytes
          FROM release_files WHERE version = ? AND file_index = ?`,
    args: [version, fileIndex],
  });
  const row = res.rows[0] as { chunks?: number; bytes?: number } | undefined;
  if (!row || Number(row.chunks ?? 0) === 0) return null;
  return {
    totalChunks: Number(row.chunks ?? 0),
    totalBytes: Number(row.bytes ?? 0),
  };
}

export async function getReleaseChunk(
  version: string,
  fileIndex: number,
  chunkIndex: number
): Promise<Uint8Array | null> {
  const c = getTurso();
  const res = await c.execute({
    sql: `SELECT data FROM release_files
          WHERE version = ? AND file_index = ? AND chunk_index = ?`,
    args: [version, fileIndex, chunkIndex],
  });
  const row = res.rows[0] as { data?: unknown } | undefined;
  if (!row || row.data == null) return null;
  const b = row.data as Uint8Array | ArrayBuffer | Buffer;
  if (b instanceof Uint8Array) return b;
  if (b instanceof ArrayBuffer) return new Uint8Array(b);
  return new Uint8Array(b as unknown as ArrayBufferLike);
}

export async function getVersionRow(
  version: string
): Promise<VersionRow | null> {
  const c = getTurso();
  const res = await c.execute({
    sql: `SELECT id, version, release_date, changelog, servidor_url, cliente_url, is_latest, created_at
          FROM versions WHERE version = ?`,
    args: [version],
  });
  const rows = res.rows as unknown as VersionRow[];
  return rows[0] ?? null;
}

/* -------- APK Android (apk_versions) -------- */

export interface ApkVersionRow {
  id: number;
  version: string;
  version_code: number;
  release_date: string;
  changelog: string | null;
  apk_url: string;
  is_latest: number;
  created_at: string;
}

const APK_COLS =
  "id, version, version_code, release_date, changelog, apk_url, is_latest, created_at";

export async function listApkVersions(): Promise<ApkVersionRow[]> {
  const c = getTurso();
  const res = await c.execute(
    `SELECT ${APK_COLS} FROM apk_versions ORDER BY id DESC`
  );
  return res.rows as unknown as ApkVersionRow[];
}

export async function getLatestApkVersion(): Promise<ApkVersionRow | null> {
  const c = getTurso();
  const res = await c.execute(
    `SELECT ${APK_COLS} FROM apk_versions WHERE is_latest = 1 ORDER BY id DESC LIMIT 1`
  );
  const rows = res.rows as unknown as ApkVersionRow[];
  return rows[0] ?? null;
}

export async function getApkVersionRow(
  version: string
): Promise<ApkVersionRow | null> {
  const c = getTurso();
  const res = await c.execute({
    sql: `SELECT ${APK_COLS} FROM apk_versions WHERE version = ?`,
    args: [version],
  });
  const rows = res.rows as unknown as ApkVersionRow[];
  return rows[0] ?? null;
}

export async function insertApkVersion(v: {
  version: string;
  version_code: number;
  release_date: string;
  changelog: string;
  apk_url: string;
  is_latest: boolean;
}): Promise<number> {
  const c = getTurso();
  if (v.is_latest) {
    await c.execute("UPDATE apk_versions SET is_latest = 0");
  }
  const res = await c.execute({
    sql: `INSERT INTO apk_versions (version, version_code, release_date, changelog, apk_url, is_latest)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      v.version,
      v.version_code,
      v.release_date,
      v.changelog,
      v.apk_url,
      v.is_latest ? 1 : 0,
    ],
  });
  return Number(res.lastInsertRowid);
}

export async function updateApkVersion(
  id: number,
  v: {
    version: string;
    version_code: number;
    release_date: string;
    changelog: string;
    apk_url: string;
    is_latest: boolean;
  }
): Promise<void> {
  const c = getTurso();
  if (v.is_latest) {
    await c.execute("UPDATE apk_versions SET is_latest = 0");
  }
  await c.execute({
    sql: `UPDATE apk_versions SET version = ?, version_code = ?, release_date = ?, changelog = ?,
          apk_url = ?${v.is_latest ? ", is_latest = 1" : ""} WHERE id = ?`,
    args: [
      v.version,
      v.version_code,
      v.release_date,
      v.changelog,
      v.apk_url,
      id,
    ],
  });
}

export async function deleteApkVersion(id: number): Promise<void> {
  const c = getTurso();
  await c.execute({ sql: "DELETE FROM apk_versions WHERE id = ?", args: [id] });
}

export async function setLatestApk(id: number): Promise<void> {
  const c = getTurso();
  await c.execute("UPDATE apk_versions SET is_latest = 0");
  await c.execute({
    sql: "UPDATE apk_versions SET is_latest = 1 WHERE id = ?",
    args: [id],
  });
}
