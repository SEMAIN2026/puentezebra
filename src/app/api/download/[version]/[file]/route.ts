import { NextResponse } from "next/server";
import { getReleaseFileMeta, getReleaseChunk } from "@/lib/turso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sirve los archivos guardados en Turso (release_files) para cualquier
// versión:  /api/download/2.0.0/SERVIDOR  /api/download/2.0.0/CLIENTE
// y el APK Android:                        /api/download/android-1.0.0/APK
export async function GET(
  req: Request,
  ctx: { params: Promise<{ version: string; file: string }> }
) {
  const { version, file } = await ctx.params;

  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(version)) {
    return NextResponse.json({ error: "Versión inválida" }, { status: 400 });
  }
  const name = file.toUpperCase();

  let fileIndex: number;
  let filename: string;
  let contentType: string;

  if (version.startsWith("android-")) {
    fileIndex = 0;
    filename = `PuenteZebra-Movil-${version.substring(8)}.apk`;
    contentType = "application/vnd.android.package-archive";
  } else if (name === "SERVIDOR") {
    fileIndex = 0;
    filename = "PuenteZebra-SERVIDOR.exe";
    contentType = "application/vnd.microsoft.portable-executable";
  } else if (name === "CLIENTE") {
    fileIndex = 1;
    filename = "PuenteZebra-CLIENTE.exe";
    contentType = "application/vnd.microsoft.portable-executable";
  } else {
    return NextResponse.json(
      { error: "Archivo desconocido (SERVIDOR | CLIENTE | APK)" },
      { status: 404 }
    );
  }

  try {
    const meta = await getReleaseFileMeta(version, fileIndex);
    if (!meta) {
      return NextResponse.json(
        { error: `No hay archivos guardados para ${version}/${name}` },
        { status: 404 }
      );
    }

    const totalChunks = meta.totalChunks;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for (let i = 0; i < totalChunks; i++) {
            const chunk = await getReleaseChunk(version, fileIndex, i);
            if (!chunk) {
              throw new Error(`Falta el trozo ${i} de ${version}/${name}`);
            }
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (e) {
          controller.error(
            e instanceof Error ? e : new Error("Error al leer el archivo")
          );
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(meta.totalBytes),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
