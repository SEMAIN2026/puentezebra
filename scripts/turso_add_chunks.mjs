// Add chunked upload table to Turso
import { createClient } from "@libsql/client";

const url = "libsql://puentezebra-semain2026.aws-us-east-2.turso.io";
const authToken =
  "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTI3NjQ4NDAsImlkIjoiMDFhMTY5MWItY2MwMS03ODQ1LTg4ZTctOTM3Njc2YjBjYWI2Iiwia2lkIjoiOGVKeEVVYUNaekdxODJxSGdCREdCU3A4Yy16NzhvSVFmblN2VWQyUVEzbyIsInJpZCI6IjIzYWMzNjcxLWY4NzktNGQzNi1hMWI1LTgyYzA1ZTQxMTlkZCJ9.xy03emvhDl9MhezUGzBoaCnXDHZdnQEkfzuUvdfeFg905i3kCGUdht5nd44Wl6KDwuooKjFauhvc73UQiOroBg";

const client = createClient({ url, authToken });

const stmts = [
  `CREATE TABLE IF NOT EXISTS upload_chunks (
     session_id TEXT NOT NULL,
     file_index INTEGER NOT NULL,
     chunk_index INTEGER NOT NULL,
     data BLOB NOT NULL,
     PRIMARY KEY (session_id, file_index, chunk_index)
   )`,
  `CREATE TABLE IF NOT EXISTS upload_meta (
     session_id TEXT PRIMARY KEY,
     file_index INTEGER NOT NULL,
     total_chunks INTEGER NOT NULL,
     filename TEXT NOT NULL,
     received INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,
];

for (const sql of stmts) {
  try {
    await client.execute(sql);
    console.log("OK:", sql.substring(0, 60).replace(/\n/g, " "));
  } catch (e) {
    console.error("ERR:", e.message);
  }
}
console.log("\nDone.");
