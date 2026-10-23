// Fix upload_meta table - PRIMARY KEY needs (session_id, file_index)
import { createClient } from "@libsql/client";

const url = "libsql://puentezebra-semain2026.aws-us-east-2.turso.io";
const authToken =
  "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTI3NjQ4NDAsImlkIjoiMDFhMTY5MWItY2MwMS03ODQ1LTg4ZTctOTM3Njc2YjBjYWI2Iiwia2lkIjoiOGVKeEVVYUNaekdxODJxSGdCREdCU3A4Yy16NzhvSVFmblN2VWQyUVEzbyIsInJpZCI6IjIzYWMzNjcxLWY4NzktNGQzNi1hMWI1LTgyYzA1ZTQxMTlkZCJ9.xy03emvhDl9MhezUGzBoaCnXDHZdnQEkfzuUvdfeFg905i3kCGUdht5nd44Wl6KDwuooKjFauhvc73UQiOroBg";

const client = createClient({ url, authToken });

// Drop the bad table and recreate with correct PK
await client.execute("DROP TABLE IF EXISTS upload_meta");
await client.execute(`CREATE TABLE upload_meta (
  session_id TEXT NOT NULL,
  file_index INTEGER NOT NULL,
  total_chunks INTEGER NOT NULL,
  filename TEXT NOT NULL,
  received INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (session_id, file_index)
)`);
console.log("upload_meta recreated with composite PK.");

// Verify
const res = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
console.log("Tables:", JSON.stringify(res.rows.map((r) => r.name)));
