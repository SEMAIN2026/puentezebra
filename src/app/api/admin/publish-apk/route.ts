import { NextResponse } from "next/server";
import { verifySession, readSessionFromRequest } from "@/lib/auth";
import {
  putReleaseChunk,
  deleteReleaseFiles,
  getApkVersionRow,
  insertApkVersion,
  updateApkVersion,
} from "@/lib/turso";
import {
  getGithubConfig,
  createRelease,
  uploadAsset,
  getReleaseByTag,
} from "@/lib/github";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_APK_BYTES = 4 * 1024 * 1024; // Vercel permite ~4.5MB por request

export async function POST(req: Request) {
  const token = readSessionFromRequest(req);
  if (!verifySession(token)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Formulario inválido" }, { status: 400 });
  }

  const version = String(form.get("version") ?? "").trim();
  const versionCode = Number(String(form.get("versionCode") ?? "").trim());
  const releaseDate = String(form.get("releaseDate") ?? "").trim();
  const changelog = String(form.get("changelog") ?? "").trim();
  const isLatest = String(form.get("isLatest") ?? "true") === "true";
  const file = form.get("apk");

  if (!version || !releaseDate || !file) {
    return NextResponse.json(
      { error: "Faltan campos: version, releaseDate, apk (archivo)" },
      { status: 400 }
    );
  }
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    return NextResponse.json(
      { error: "La versión debe tener formato X.Y.Z (ej. 1.0.1)" },
      { status: 400 }
    );
  }
  if (
    !Number.isInteger(versionCode) ||
    versionCode < 1 ||
    versionCode > 2_000_000_000
  ) {
    return NextResponse.json(
      {
        error:
          "El código de versión (versionCode) debe ser un entero mayor o igual a 1",
      },
      { status: 400 }
    );
  }
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Falta el archivo .apk" },
      { status: 400 }
    );
  }
  if (file.size <= 0 || file.size > MAX_APK_BYTES) {
    return NextResponse.json(
      { error: `El APK pesa ${file.size} bytes; el máximo es 4MB en esta vía.` },
      { status: 400 }
    );
  }
  if (!file.name.toLowerCase().endsWith(".apk")) {
    return NextResponse.json(
      { error: "El archivo debe ser un .apk" },
      { status: 400 }
    );
  }

  const data = new Uint8Array(await file.arrayBuffer());
  if (data.length < 4 || data[0] !== 0x50 || data[1] !== 0x4b) {
    return NextResponse.json(
      { error: "El archivo no parece un APK válido (firma ZIP ausente)" },
      { status: 400 }
    );
  }

  const storageVersion = `android-${version}`;
  const tag = `android-v${version}`;

  try {
    // 1) Guardar en Turso (release_files) como almacenamiento primario
    await deleteReleaseFiles(storageVersion);
    const CHUNK = 3 * 1024 * 1024;
    let chunks = 0;
    for (let off = 0; off < data.length; off += CHUNK) {
      await putReleaseChunk({
        version: storageVersion,
        fileIndex: 0,
        chunkIndex: chunks,
        data: data.subarray(off, Math.min(off + CHUNK, data.length)),
      });
      chunks++;
    }

    // 2) GitHub opcional (best-effort; nunca rompe la publicación)
    let ghUrl: string | null = null;
    try {
      const cfg = getGithubConfig();
      let release = await getReleaseByTag({ cfg, tag });
      if (!release) {
        release = await createRelease({
          cfg,
          tag,
          name: `PuenteZebra Móvil v${version}`,
          body: changelog || `Versión Android ${version}`,
        });
      }
      ghUrl = await uploadAsset({
        cfg,
        releaseId: release.id,
        filename: `PuenteZebra-Movil-v${version}.apk`,
        data: data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength
        ),
        contentType: "application/vnd.android.package-archive",
      });
    } catch {
      ghUrl = null; // GitHub no disponible: seguimos con Turso
    }

    const apkUrl = ghUrl ?? `/api/download/${storageVersion}/APK`;

    // 3) Insertar o actualizar la fila (version UNIQUE)
    const existing = await getApkVersionRow(version);
    let id: number;
    if (existing) {
      await updateApkVersion(existing.id, {
        version,
        version_code: versionCode,
        release_date: releaseDate,
        changelog,
        apk_url: apkUrl,
        is_latest: isLatest,
      });
      id = existing.id;
    } else {
      id = await insertApkVersion({
        version,
        version_code: versionCode,
        release_date: releaseDate,
        changelog,
        apk_url: apkUrl,
        is_latest: isLatest,
      });
    }

    return NextResponse.json({
      ok: true,
      id,
      version,
      versionCode,
      apkUrl,
      chunks,
      github: { url: ghUrl, ok: Boolean(ghUrl) },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
