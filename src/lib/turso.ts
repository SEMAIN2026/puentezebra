import { createClient, type Client } from "@libsql/client";

// Singleton Turso client. Safe for serverless (each invocation re-creates).
let _client: Client | null = null;

export function getTurso(): Client {
  if (_client) return _client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
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
