// Full end-to-end chunked upload + finalize test against local server
// Usage: bun run scripts/test_full_upload.mjs
import { readFileSync, statSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SESSION = `e2e-${Date.now()}`;
const CHUNK_SIZE = 3 * 1024 * 1024;
const PASSWORD = "PuenteZebra2026!";

console.log(`Base URL: ${BASE}`);
console.log(`Session: ${SESSION}`);

// 1) Login
console.log("\n=== Login ===");
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: PASSWORD }),
});
console.log("  status:", loginRes.status);
const cookie = loginRes.headers.get("set-cookie");
if (!cookie) {
  console.error("No set-cookie header!");
  process.exit(1);
}
const cookieVal = cookie.split(";")[0];
console.log("  cookie:", cookieVal.substring(0, 40) + "...");

// 2) Upload both files in chunks
async function uploadFile(filePath, fileIndex) {
  const size = statSync(filePath).size;
  const totalChunks = Math.ceil(size / CHUNK_SIZE);
  const buf = readFileSync(filePath);
  console.log(
    `\n=== Uploading ${filePath} (${(size / 1024 / 1024).toFixed(2)} MB, ${totalChunks} chunks) ===`
  );
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, size);
    const chunk = buf.subarray(start, end);
    const form = new FormData();
    form.append("sessionId", SESSION);
    form.append("fileIndex", String(fileIndex));
    form.append("chunkIndex", String(i));
    form.append("totalChunks", String(totalChunks));
    form.append("filename", filePath.split("/").pop() ?? `file${fileIndex}.bin`);
    form.append("chunk", new Blob([chunk]), `chunk-${i}.bin`);
    const res = await fetch(`${BASE}/api/admin/upload-chunk`, {
      method: "POST",
      headers: { cookie: cookieVal },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(`  chunk ${i} failed:`, data);
      process.exit(1);
    }
    console.log(
      `  chunk ${i + 1}/${totalChunks}: received=${data.received} complete=${data.complete}`
    );
  }
}

await uploadFile("/tmp/puentezebra_v1/PuenteZebra-SERVIDOR.exe", 0);
await uploadFile("/tmp/puentezebra_v1/PuenteZebra-CLIENTE.exe", 1);

// 3) Finalize - use a test version number (semver)
console.log("\n=== Finalize ===");
const randN = Math.floor(Math.random() * 1000) + 100;
const version = `0.0.${randN}`;
const finRes = await fetch(`${BASE}/api/admin/upload-finalize`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    cookie: cookieVal,
  },
  body: JSON.stringify({
    sessionId: SESSION,
    version,
    releaseDate: new Date().toISOString().substring(0, 10),
    changelog: `Prueba end-to-end del flujo de subida por chunks (v${version}).`,
    isLatest: false,
  }),
});
const finData = await finRes.json();
console.log("  status:", finRes.status);
console.log("  response:", JSON.stringify(finData, null, 2));

if (!finRes.ok) {
  console.error("FINALIZE FAILED");
  process.exit(1);
}

console.log("\n=== SUCCESS ===");
console.log("Version:", version);
console.log("Tag:", finData.tag);
console.log("SERVIDOR:", finData.servidorUrl);
console.log("CLIENTE:", finData.clienteUrl);
console.log("Release:", finData.releaseUrl);

// 4) Cleanup: delete the test version + GitHub release
console.log("\n=== Cleanup test version ===");
const delRes = await fetch(`${BASE}/api/admin/delete`, {
  method: "POST",
  headers: { "Content-Type": "application/json", cookie: cookieVal },
  body: JSON.stringify({
    id: finData.id,
    version: version,
    deleteGithub: true,
  }),
});
const delData = await delRes.json();
console.log("  delete:", JSON.stringify(delData));
