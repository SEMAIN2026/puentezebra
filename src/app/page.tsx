"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  Printer,
  Download,
  Server,
  Monitor,
  ShieldCheck,
  Settings2,
  LogOut,
  Loader2,
  Package,
  ChevronRight,
  Trash2,
  Star,
  Pencil,
  Github,
  ExternalLink,
  Info,
} from "lucide-react";

interface VersionRow {
  id: number;
  version: string;
  release_date: string;
  changelog: string | null;
  servidor_url: string;
  cliente_url: string;
  is_latest: number;
  created_at: string;
}

type View = "public" | "login" | "admin";

export default function Home() {
  const [view, setView] = useState<View>("public");
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/versions", { cache: "no-store" });
      const data = await res.json();
      setVersions(data.versions ?? []);
    } catch (e) {
      toast.error("No se pudo cargar la lista de versiones");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refresh();
    // Check auth status
    fetch("/api/auth/check")
      .then((r) => r.json())
      .then((d) => setAuthed(!!d.authenticated))
      .catch(() => {});
  }, [refresh]);

  // Hash-based view routing (#admin)
  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.replace(/^#/, "").toLowerCase();
      if (h === "admin") {
        setView(authed ? "admin" : "login");
      } else {
        setView("public");
      }
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [authed]);

  const latest = versions.find((v) => v.is_latest === 1) ?? versions[0] ?? null;
  const older = versions.filter((v) => v.id !== latest?.id);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-zinc-50 via-white to-zinc-100 text-zinc-900">
      <Header
        authed={authed}
        onLogout={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          setAuthed(false);
          window.location.hash = "";
          toast.success("Sesión cerrada");
        }}
        onAdminClick={() => {
          window.location.hash = authed ? "admin" : "admin";
          setView(authed ? "admin" : "login");
        }}
      />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        {view === "public" && (
          <PublicView latest={latest} older={older} loading={loading} />
        )}
        {view === "login" && (
          <LoginView
            onSuccess={() => {
              setAuthed(true);
              setView("admin");
            }}
          />
        )}
        {view === "admin" && authed && (
          <AdminView
            versions={versions}
            onChanged={refresh}
            onExit={() => {
              window.location.hash = "";
              setView("public");
            }}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}

/* ---------------- Header ---------------- */

function Header({
  authed,
  onLogout,
  onAdminClick,
}: {
  authed: boolean;
  onLogout: () => void;
  onAdminClick: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-white/80 border-b border-zinc-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-md bg-zinc-900 grid place-items-center text-white font-bold text-sm">
            PZ
          </div>
          <span className="font-semibold tracking-tight">PuenteZebra</span>
        </a>
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/SEMAIN2026/puentezebra"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900 transition-colors px-2 py-1.5"
          >
            <Github className="w-4 h-4" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          {authed ? (
            <>
              <Button variant="ghost" size="sm" onClick={onAdminClick}>
                <Settings2 className="w-4 h-4 mr-1" />
                Panel
              </Button>
              <Button variant="outline" size="sm" onClick={onLogout}>
                <LogOut className="w-4 h-4 mr-1" />
                Salir
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={onAdminClick}>
              <ShieldCheck className="w-4 h-4 mr-1" />
              Admin
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

/* ---------------- Public View ---------------- */

function PublicView({
  latest,
  older,
  loading,
}: {
  latest: VersionRow | null;
  older: VersionRow[];
  loading: boolean;
}) {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 text-white text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {loading ? "Cargando…" : latest ? `Última versión: v${latest.version}` : "Sin versiones todavía"}
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
          Descargas de{" "}
          <span className="relative inline-block">
            <span className="relative z-10">PuenteZebra</span>
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-1 h-3 bg-zinc-300/70 -z-0"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, #000 0 8px, transparent 8px 16px)",
                opacity: 0.15,
              }}
            />
          </span>
        </h1>
        <p className="max-w-2xl mx-auto text-zinc-600 text-base sm:text-lg">
          Sistema de impresión Zebra ZD220 en red. El servidor recibe trabajos
          por la red local desde una impresora virtual instalada en los PCs de
          tus compañeros. Descarga aquí los dos ejecutables y sigue las
          instrucciones del archivo <code className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-900 text-sm">LEEME.txt</code>.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> Windows 10/11 64-bit
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Printer className="w-4 h-4" /> Zebra ZD220
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Monitor className="w-4 h-4" /> Impresora virtual
          </span>
        </div>
      </section>

      {/* Latest download */}
      {loading ? (
        <Card className="border-zinc-200">
          <CardContent className="py-16 flex items-center justify-center text-zinc-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Cargando…
          </CardContent>
        </Card>
      ) : latest ? (
        <LatestDownloadCard version={latest} />
      ) : (
        <Card className="border-dashed border-zinc-300 bg-zinc-50">
          <CardContent className="py-16 text-center text-zinc-500">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
            Aún no hay versiones publicadas.
          </CardContent>
        </Card>
      )}

      {/* Older versions */}
      {older.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Versiones anteriores</h2>
            <Badge variant="secondary" className="font-mono">
              {older.length}
            </Badge>
          </div>
          <Accordion type="single" collapsible className="space-y-2">
            {older.map((v) => (
              <AccordionItem
                key={v.id}
                value={`v-${v.id}`}
                className="border border-zinc-200 rounded-lg px-4 bg-white"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 w-full">
                    <span className="font-mono font-semibold">v{v.version}</span>
                    <span className="text-sm text-zinc-500">
                      {formatDate(v.release_date)}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <VersionDetail v={v} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )}

      {/* Instructions */}
      <InstructionsSection />
    </div>
  );
}

function LatestDownloadCard({ version }: { version: VersionRow }) {
  return (
    <Card className="overflow-hidden border-zinc-900/10 shadow-xl shadow-zinc-900/5">
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 text-white px-6 sm:px-8 py-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-zinc-400 mb-1">
            Última versión
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono">
            v{version.version}
          </div>
        </div>
        <div className="text-right text-sm text-zinc-300">
          <div>Publicada: {formatDate(version.release_date)}</div>
          <div className="flex items-center gap-1 justify-end mt-1">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>Recomendada</span>
          </div>
        </div>
      </div>
      <CardContent className="p-6 sm:p-8 space-y-6">
        {version.changelog && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5">
              <Info className="w-4 h-4" /> Novedades
            </h3>
            <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700 bg-zinc-50 rounded-md p-4 border border-zinc-100 max-h-72 overflow-y-auto">
              {version.changelog}
            </pre>
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <DownloadTile
            href={version.servidor_url}
            title="SERVIDOR"
            subtitle="Para tu PC con la Zebra ZD220"
            icon={<Server className="w-5 h-5" />}
            filename={`PuenteZebra-SERVIDOR.exe`}
            primary
          />
          <DownloadTile
            href={version.cliente_url}
            title="CLIENTE"
            subtitle="Para los PCs de los compañeros"
            icon={<Monitor className="w-5 h-5" />}
            filename={`PuenteZebra-CLIENTE.exe`}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function DownloadTile({
  href,
  title,
  subtitle,
  icon,
  filename,
  primary,
}: {
  href: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  filename: string;
  primary?: boolean;
}) {
  return (
    <a
      href={href}
      download
      className={`group block rounded-xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-md ${
        primary
          ? "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800"
          : "border-zinc-200 bg-white hover:border-zinc-300"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className={`w-10 h-10 rounded-lg grid place-items-center ${
            primary ? "bg-white/10" : "bg-zinc-100"
          }`}
        >
          {icon}
        </div>
        <Download
          className={`w-4 h-4 transition-transform group-hover:translate-y-0.5 ${
            primary ? "text-white" : "text-zinc-500"
          }`}
        />
      </div>
      <div className="font-bold text-base">{title}</div>
      <div
        className={`text-xs mt-0.5 mb-2 ${
          primary ? "text-zinc-300" : "text-zinc-500"
        }`}
      >
        {subtitle}
      </div>
      <div
        className={`font-mono text-[11px] truncate ${
          primary ? "text-zinc-400" : "text-zinc-400"
        }`}
      >
        {filename}
      </div>
    </a>
  );
}

function VersionDetail({ v }: { v: VersionRow }) {
  return (
    <div className="space-y-3 pb-2">
      {v.changelog && (
        <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700 bg-zinc-50 rounded-md p-3 border border-zinc-100 max-h-60 overflow-y-auto">
          {v.changelog}
        </pre>
      )}
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="default">
          <a href={v.servidor_url} download>
            <Server className="w-4 h-4 mr-1.5" /> SERVIDOR
          </a>
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={v.cliente_url} download>
            <Monitor className="w-4 h-4 mr-1.5" /> CLIENTE
          </a>
        </Button>
      </div>
    </div>
  );
}

function InstructionsSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">¿Cómo se instala?</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="border-zinc-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="w-4 h-4" /> En tu PC (SERVIDOR)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-600 space-y-2">
            <p>
              1. Descarga y ejecuta <code className="px-1 rounded bg-zinc-100">PuenteZebra-SERVIDOR.exe</code>.
            </p>
            <p>
              2. En el menú de la bandeja, selecciona tu impresora Zebra ZD220 como destino.
            </p>
            <p>
              3. Pulsa <em>Abrir puerto en firewall</em> para que los compañeros puedan enviar trabajos.
            </p>
            <p>
              4. Marca <em>Inicio con Windows</em> si quieres que se ejecute solo al arrancar.
            </p>
          </CardContent>
        </Card>
        <Card className="border-zinc-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Monitor className="w-4 h-4" /> En el PC del compañero (CLIENTE)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-600 space-y-2">
            <p>
              1. Descarga y ejecuta <code className="px-1 rounded bg-zinc-100">PuenteZebra-CLIENTE.exe</code>.
            </p>
            <p>
              2. Pulsa <em>Instalar impresora virtual</em> (pedirá permisos de administrador).
            </p>
            <p>
              3. Indica la IP de tu PC servidor y guarda.
            </p>
            <p>
              4. Imprime desde cualquier programa a <em>"Zebra ZD220 (Red)"</em> y llegará a tu Zebra.
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
        <strong>Importante:</strong> ambos PCs deben estar en la misma red local
        (mismo Wi-Fi o cable). Si usas VPN o redes separadas, configura las
        reglas de firewall de forma manual.
      </div>
    </section>
  );
}

/* ---------------- Login View ---------------- */

function LoginView({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Error al iniciar sesión");
        return;
      }
      toast.success("Bienvenido al panel de administración");
      onSuccess();
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto">
      <Card className="border-zinc-200">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-zinc-900 grid place-items-center text-white mb-2">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <CardTitle>Panel de administración</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pw">Contraseña</Label>
              <Input
                id="pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Introduce la contraseña de admin"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Entrando…
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Admin View ---------------- */

function AdminView({
  versions,
  onChanged,
  onExit,
}: {
  versions: VersionRow[];
  onChanged: () => Promise<void> | void;
  onExit: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Panel de administración</h1>
          <p className="text-sm text-zinc-500">
            Publica nuevas versiones de PuenteZebra. Los archivos se suben a
            GitHub Releases y los metadatos a Turso.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onExit}>
            <ChevronRight className="w-4 h-4 mr-1 rotate-180" /> Ver página
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Package className="w-4 h-4 mr-2" /> Nueva versión
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Publicar nueva versión</DialogTitle>
                <DialogDescription>
                  Sube los dos archivos .exe. Se creará un release en GitHub
                  con tag <code className="px-1 rounded bg-zinc-100">vX.Y.Z</code> y se
                  añadirá el registro en la base de datos.
                </DialogDescription>
              </DialogHeader>
              <UploadForm
                onDone={async () => {
                  setOpen(false);
                  await onChanged();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <VersionsAdminTable versions={versions} onChanged={onChanged} />
    </div>
  );
}

function UploadForm({ onDone }: { onDone: () => Promise<void> | void }) {
  const [version, setVersion] = useState("");
  const [releaseDate, setReleaseDate] = useState(
    new Date().toISOString().substring(0, 10)
  );
  const [changelog, setChangelog] = useState("");
  const [isLatest, setIsLatest] = useState(true);
  const [servidorFile, setServidorFile] = useState<File | null>(null);
  const [clienteFile, setClienteFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{
    phase: "idle" | "uploading" | "finalizing" | "done";
    current: number; // bytes uploaded
    total: number; // total bytes
    label: string;
  }>({ phase: "idle", current: 0, total: 0, label: "" });

  const CHUNK_SIZE = 3 * 1024 * 1024; // 3MB per chunk (safe under Vercel 4.5MB)

  const uploadFileInChunks = async (
    sessionId: string,
    file: File,
    fileIndex: number
  ): Promise<void> => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const blob = file.slice(start, end);
      const form = new FormData();
      form.append("sessionId", sessionId);
      form.append("fileIndex", String(fileIndex));
      form.append("chunkIndex", String(i));
      form.append("totalChunks", String(totalChunks));
      form.append("filename", file.name);
      form.append("chunk", blob, `chunk-${i}.bin`);
      const res = await fetch("/api/admin/upload-chunk", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error ?? `Error subiendo chunk ${i} del archivo ${fileIndex}`
        );
      }
      setProgress((p) => ({
        ...p,
        current: p.current + (end - start),
        label: `Subiendo ${fileIndex === 0 ? "SERVIDOR" : "CLIENTE"} — chunk ${i + 1}/${totalChunks}`,
      }));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!version || !releaseDate) {
      toast.error("Versión y fecha son obligatorias");
      return;
    }
    if (!servidorFile || !clienteFile) {
      toast.error("Debes adjuntar ambos archivos .exe");
      return;
    }
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      toast.error("La versión debe tener formato X.Y.Z (ej. 1.2.0)");
      return;
    }
    setSubmitting(true);
    const totalBytes = servidorFile.size + clienteFile.size;
    setProgress({ phase: "uploading", current: 0, total: totalBytes, label: "Iniciando…" });
    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      // Upload SERVIDOR chunks
      await uploadFileInChunks(sessionId, servidorFile, 0);
      // Upload CLIENTE chunks
      await uploadFileInChunks(sessionId, clienteFile, 1);
      // Finalize
      setProgress((p) => ({ ...p, phase: "finalizing", label: "Subiendo a GitHub Releases…" }));
      const res = await fetch("/api/admin/upload-finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          version,
          releaseDate,
          changelog,
          isLatest,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Error al finalizar la subida");
      }
      setProgress({ phase: "done", current: totalBytes, total: totalBytes, label: "¡Listo!" });
      toast.success(`Versión ${version} publicada correctamente`);
      // reset
      setVersion("");
      setChangelog("");
      setServidorFile(null);
      setClienteFile(null);
      setIsLatest(true);
      setProgress({ phase: "idle", current: 0, total: 0, label: "" });
      await onDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error de red al subir";
      toast.error(msg);
      setProgress({ phase: "idle", current: 0, total: 0, label: "" });
    } finally {
      setSubmitting(false);
    }
  };

  const pct =
    progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : 0;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="version">Versión *</Label>
          <Input
            id="version"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="1.0.0"
            className="font-mono"
            disabled={submitting}
          />
          <p className="text-xs text-zinc-500">Formato: X.Y.Z (ej. 1.2.0)</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Fecha de publicación *</Label>
          <Input
            id="date"
            type="date"
            value={releaseDate}
            onChange={(e) => setReleaseDate(e.target.value)}
            disabled={submitting}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="changelog">Notas de versión (changelog)</Label>
        <Textarea
          id="changelog"
          value={changelog}
          onChange={(e) => setChangelog(e.target.value)}
          placeholder={"Qué cambió en esta versión...\n- Mejora X\n- Corrección Y"}
          rows={6}
          className="font-mono text-sm"
          disabled={submitting}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <FileInput
          label="PuenteZebra-SERVIDOR.exe *"
          file={servidorFile}
          onChange={setServidorFile}
          disabled={submitting}
        />
        <FileInput
          label="PuenteZebra-CLIENTE.exe *"
          file={clienteFile}
          onChange={setClienteFile}
          disabled={submitting}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-3">
        <div>
          <Label htmlFor="latest" className="cursor-pointer">
            Marcar como versión más reciente
          </Label>
          <p className="text-xs text-zinc-500">
            Aparecerá destacada en la página pública.
          </p>
        </div>
        <Switch
          id="latest"
          checked={isLatest}
          onCheckedChange={setIsLatest}
          disabled={submitting}
        />
      </div>

      {submitting && (
        <div className="space-y-2 rounded-lg bg-zinc-50 border border-zinc-200 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{progress.label}</span>
            <span className="font-mono text-zinc-500">{pct}%</span>
          </div>
          <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-zinc-900 transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500">
            {progress.phase === "finalizing"
              ? "Reensamblando y subiendo a GitHub…"
              : `${(progress.current / 1024 / 1024).toFixed(1)} / ${(progress.total / 1024 / 1024).toFixed(1)} MB subidos`}
          </p>
        </div>
      )}

      <DialogFooter>
        <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {progress.phase === "finalizing"
                ? "Finalizando…"
                : "Subiendo…"}
            </>
          ) : (
            <>
              <Package className="w-4 h-4 mr-2" /> Publicar versión
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

function FileInput({
  label,
  file,
  onChange,
  disabled,
}: {
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          disabled
            ? "border-zinc-200 bg-zinc-50 cursor-not-allowed opacity-60"
            : "border-zinc-300 cursor-pointer hover:border-zinc-400"
        }`}
        onClick={() => !disabled && inputRef.current?.click()}
        onDrop={(e) => {
          if (disabled) return;
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) onChange(f);
        }}
        onDragOver={(e) => e.preventDefault()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".exe,application/vnd.microsoft.portable-executable,application/x-msdownload"
          className="hidden"
          disabled={disabled}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div className="text-sm">
            <div className="font-medium text-zinc-900 truncate">{file.name}</div>
            <div className="text-xs text-zinc-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
        ) : (
          <div className="text-sm text-zinc-500">
            Arrastra aquí el archivo o haz clic para seleccionarlo
          </div>
        )}
      </div>
    </div>
  );
}

function VersionsAdminTable({
  versions,
  onChanged,
}: {
  versions: VersionRow[];
  onChanged: () => Promise<void> | void;
}) {
  const [deleting, setDeleting] = useState<number | null>(null);

  const removeVersion = async (v: VersionRow, deleteGithub: boolean) => {
    setDeleting(v.id);
    try {
      const res = await fetch("/api/admin/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: v.id,
          version: v.version,
          deleteGithub,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Error al eliminar");
        return;
      }
      toast.success(
        `Versión ${v.version} eliminada${
          data.ghDeleted ? " (también de GitHub)" : ""
        }`
      );
      await onChanged();
    } finally {
      setDeleting(null);
    }
  };

  const promote = async (v: VersionRow) => {
    const res = await fetch("/api/admin/set-latest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: v.id }),
    });
    if (!res.ok) {
      toast.error("Error al marcar como última");
      return;
    }
    toast.success(`v${v.version} marcada como última`);
    await onChanged();
  };

  if (versions.length === 0) {
    return (
      <Card className="border-dashed border-zinc-300 bg-zinc-50">
        <CardContent className="py-12 text-center text-zinc-500">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
          Aún no hay versiones. Pulsa "Nueva versión" para publicar la primera.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-zinc-200">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="w-4 h-4" /> Versiones publicadas{" "}
          <Badge variant="secondary" className="font-mono">
            {versions.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-zinc-100">
          {versions.map((v) => (
            <div
              key={v.id}
              className="p-4 flex items-start gap-4 flex-wrap hover:bg-zinc-50/50"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-semibold">v{v.version}</span>
                  {v.is_latest === 1 && (
                    <Badge className="bg-emerald-500 hover:bg-emerald-500">
                      <Star className="w-3 h-3 mr-1 fill-white" /> Última
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-zinc-500 mb-2">
                  {formatDate(v.release_date)} · subida {formatDateTime(v.created_at)}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <a href={v.servidor_url} target="_blank" rel="noreferrer">
                      <Server className="w-3.5 h-3.5 mr-1" /> SERVIDOR
                      <ExternalLink className="w-3 h-3 ml-1 opacity-60" />
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href={v.cliente_url} target="_blank" rel="noreferrer">
                      <Monitor className="w-3.5 h-3.5 mr-1" /> CLIENTE
                      <ExternalLink className="w-3 h-3 ml-1 opacity-60" />
                    </a>
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {v.is_latest !== 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => promote(v)}
                    title="Marcar como última"
                  >
                    <Star className="w-4 h-4" />
                  </Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      disabled={deleting === v.id}
                    >
                      {deleting === v.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        ¿Eliminar v{v.version}?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción quita la versión de la base de datos.
                        ¿Quieres eliminar también el release en GitHub
                        (tag <code className="px-1 rounded bg-zinc-100">v{v.version}</code>)?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <div className="flex gap-2">
                        <AlertDialogAction
                          onClick={() => removeVersion(v, false)}
                          className="bg-zinc-700 hover:bg-zinc-800"
                        >
                          Solo BD
                        </AlertDialogAction>
                        <AlertDialogAction
                          onClick={() => removeVersion(v, true)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          BD + GitHub
                        </AlertDialogAction>
                      </div>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Footer ---------------- */

function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-200 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between flex-wrap gap-3 text-xs text-zinc-500">
        <div>
          © {new Date().getFullYear()} PuenteZebra · Sistema de impresión ZD220
          en red
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/SEMAIN2026/puentezebra"
            target="_blank"
            rel="noreferrer"
            className="hover:text-zinc-900 transition-colors inline-flex items-center gap-1"
          >
            <Github className="w-3.5 h-3.5" /> Código fuente
          </a>
          <span className="opacity-50">·</span>
          <span>Powered by Vercel + Turso + GitHub</span>
        </div>
      </div>
    </footer>
  );
}

/* ---------------- Utils ---------------- */

function formatDate(s: string): string {
  try {
    const d = new Date(s + "T00:00:00Z");
    return d.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return s;
  }
}

function formatDateTime(s: string): string {
  try {
    const d = new Date(s.replace(" ", "T") + "Z");
    return d.toLocaleString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
  } catch {
    return s;
  }
}
