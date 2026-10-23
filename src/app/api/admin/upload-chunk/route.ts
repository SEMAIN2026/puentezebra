import { NextResponse } from "next/server";
import { verifySession, readSessionFromRequest } from "@/lib/auth";
import { putChunk } from "@/lib/turso";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_CHUNK_BYTES = 3.5 * 1024 * 1024; // 3.5 MB per chunk (safe under Vercel 4.5MB limit)

export async function POST(req: Request) {
  const token = readSessionFromRequest(req);
  if (!verifySession(token)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Se esperaba multipart/form-data" },
      { status: 400 }
    );
  }
  const sessionId = (form.get("sessionId") as string | null)?.trim();
  const fileIndexStr = (form.get("fileIndex") as string | null)?.trim();
  const chunkIndexStr = (form.get("chunkIndex") as string | null)?.trim();
  const totalChunksStr = (form.get("totalChunks") as string | null)?.trim();
  const filename = (form.get("filename") as string | null)?.trim();
  const chunkBlob = form.get("chunk") as Blob | null;

  if (!sessionId || fileIndexStr == null || chunkIndexStr == null || !totalChunksStr || !filename || !chunkBlob) {
    return NextResponse.json({ error: "Faltan campos en el chunk" }, { status: 400 });
  }
  const fileIndex = Number(fileIndexStr);
  const chunkIndex = Number(chunkIndexStr);
  const totalChunks = Number(totalChunksStr);
  if (!Number.isFinite(fileIndex) || !Number.isFinite(chunkIndex) || !Number.isFinite(totalChunks)) {
    return NextResponse.json({ error: "Índices inválidos" }, { status: 400 });
  }
  if (chunkBlob.size > MAX_CHUNK_BYTES) {
    return NextResponse.json(
      { error: `Chunk demasiado grande (${chunkBlob.size} > ${MAX_CHUNK_BYTES}). Usa trozos más pequeños.` },
      { status: 400 }
    );
  }
  const data = new Uint8Array(await chunkBlob.arrayBuffer());
  const { received } = await putChunk({
    sessionId,
    fileIndex,
    chunkIndex,
    totalChunks,
    filename,
    data,
  });
  return NextResponse.json({
    ok: true,
    sessionId,
    fileIndex,
    chunkIndex,
    totalChunks,
    received,
    complete: received >= totalChunks,
  });
}
