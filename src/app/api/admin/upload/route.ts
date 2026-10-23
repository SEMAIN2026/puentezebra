import { NextResponse } from "next/server";
import { verifySession, readSessionFromRequest } from "@/lib/auth";
import {
  getGithubConfig,
  createRelease,
  uploadAsset,
  getReleaseByTag,
  tagFromVersion,
  assetUrlFor,
  deleteRelease,
} from "@/lib/github";
import { insertVersion } from "@/lib/turso";

export const runtime = "nodejs";
// Allow large uploads (2 x ~12MB exes + metadata). Default body limit is 4MB.
export const maxDuration = 120;

interface UploadBody {
  version?: string;
  releaseDate?: string;
  changelog?: string;
  isLatest?: boolean;
  servidorUrl?: string; // optional pre-existing URL
  clienteUrl?: string; // optional pre-existing URL
}

const MAX_EXE_BYTES = 50 * 1024 * 1024; // 50 MB safety cap

export async function POST(req: Request) {
  // 1) Auth check
  const token = readSessionFromRequest(req);
  if (!verifySession(token)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const cfg = getGithubConfig();

  // 2) Parse multipart/form-data
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Se esperaba multipart/form-data" },
      { status: 400 }
    );
  }

  const version = (form.get("version") as string | null)?.trim();
  const releaseDate = (form.get("releaseDate") as string | null)?.trim();
  const changelog = (form.get("changelog") as string | null)?.trim() ?? "";
  const isLatestStr = (form.get("isLatest") as string | null);
  const isLatest = isLatestStr === "1" || isLatestStr === "true";
  const servidorUrlExisting = (form.get("servidorUrl") as string | null)?.trim();
  const clienteUrlExisting = (form.get("clienteUrl") as string | null)?.trim();

  if (!version || !releaseDate) {
    return NextResponse.json(
      { error: "Faltan campos obligatorios: version, releaseDate" },
      { status: 400 }
    );
  }

  // Validate version format (semver-like)
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    return NextResponse.json(
      { error: "La versión debe tener formato X.Y.Z (ej. 1.2.0)" },
      { status: 400 }
    );
  }

  const servidorFile = form.get("servidorFile") as File | null;
  const clienteFile = form.get("clienteFile") as File | null;

  // Either a file or an existing URL must be present for each
  if (!servidorFile && !servidorUrlExisting) {
    return NextResponse.json(
      { error: "Falta el archivo SERVIDOR.exe o una URL existente" },
      { status: 400 }
    );
  }
  if (!clienteFile && !clienteUrlExisting) {
    return NextResponse.json(
      { error: "Falta el archivo CLIENTE.exe o una URL existente" },
      { status: 400 }
    );
  }

  if (servidorFile && servidorFile.size > MAX_EXE_BYTES) {
    return NextResponse.json(
      { error: "El archivo SERVIDOR excede 50 MB" },
      { status: 400 }
    );
  }
  if (clienteFile && clienteFile.size > MAX_EXE_BYTES) {
    return NextResponse.json(
      { error: "El archivo CLIENTE excede 50 MB" },
      { status: 400 }
    );
  }

  const tag = tagFromVersion(version);

  try {
    // 3) Create or reuse GitHub release
    let release = await getReleaseByTag({ cfg, tag });
    if (!release) {
      release = await createRelease({
        cfg,
        tag,
        name: `PuenteZebra ${tag}`,
        body: changelog || `Versión ${version}`,
      });
    }

    // 4) Upload assets (if files provided)
    let servidorUrl = servidorUrlExisting;
    let clienteUrl = clienteUrlExisting;

    if (servidorFile) {
      const data = await servidorFile.arrayBuffer();
      servidorUrl = await uploadAsset({
        cfg,
        releaseId: release.id,
        filename: "PuenteZebra-SERVIDOR.exe",
        data,
        contentType: "application/vnd.microsoft.portable-executable",
      });
    }
    if (clienteFile) {
      const data = await clienteFile.arrayBuffer();
      clienteUrl = await uploadAsset({
        cfg,
        releaseId: release.id,
        filename: "PuenteZebra-CLIENTE.exe",
        data,
        contentType: "application/vnd.microsoft.portable-executable",
      });
    }

    if (!servidorUrl || !clienteUrl) {
      // Rollback: delete the release we just created
      await deleteRelease({ cfg, releaseId: release.id, tag });
      return NextResponse.json(
        { error: "No se pudo obtener URLs de descarga" },
        { status: 500 }
      );
    }

    // 5) Insert into Turso
    const id = await insertVersion({
      version,
      release_date: releaseDate,
      changelog,
      servidor_url: servidorUrl,
      cliente_url: clienteUrl,
      is_latest: isLatest,
    });

    return NextResponse.json({
      ok: true,
      id,
      version,
      tag,
      servidorUrl,
      clienteUrl,
      releaseUrl: release.htmlUrl,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
