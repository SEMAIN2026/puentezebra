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
