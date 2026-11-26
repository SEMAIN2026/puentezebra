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
  Smartphone,
  QrCode,
  ShieldCheck,
  Settings2,
  LogOut,
  Loader2,
  Package,
  ChevronRight,
  Trash2,
  Star,
  Github,
  ExternalLink,
  Info,
  Wifi,
  Zap,
  CheckCircle2,
  FileText,
  RefreshCw,
  MousePointerClick,
  Network,
  HardDriveDownload,
  CircleCheck,
} from "lucide-react";
import QRCode from "qrcode";

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

interface ApkVersionRow {
  id: number;
  version: string;
  version_code: number;
  release_date: string;
  changelog: string | null;
  apk_url: string;
  is_latest: number;
  created_at: string;
}

type View = "public" | "login" | "admin";

export default function Home() {
  const [view, setView] = useState<View>("public");
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [apkVersions, setApkVersions] = useState<ApkVersionRow[]>([]);
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
    try {
      const res = await fetch("/api/versions/apk", { cache: "no-store" });
      const data = await res.json();
      setApkVersions(data.versions ?? []);
    } catch {
      setApkVersions([]);
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
  const apkLatest =
    apkVersions.find((v) => v.is_latest === 1) ?? apkVersions[0] ?? null;

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F7FC] text-zinc-900">
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

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {view === "public" && (
          <PublicView
            latest={latest}
            older={older}
            loading={loading}
            apk={apkLatest}
          />
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
            apkVersions={apkVersions}
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

/* ---------------- Reveal on scroll ---------------- */

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`${className ?? ""} transition-all duration-700 ease-out will-change-transform ${
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-7"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ---------------- Header ---------------- */

function Logo({ size = 36 }: { size?: number }) {
  return (
    <div
      className="relative rounded-xl overflow-hidden grid place-items-center font-black text-white select-none shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      <div className="absolute inset-0 bg-gradient-to-br from-sky-400 via-sky-600 to-indigo-700" />
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, rgba(0,0,0,0.85) 0 7px, transparent 7px 18px)",
        }}
      />
      <span className="relative drop-shadow-sm">PZ</span>
    </div>
  );
}

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
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 border-b border-zinc-200/70 shadow-sm shadow-zinc-900/[0.03]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <a href="#" className="flex items-center gap-3 group">
          <Logo size={40} />
          <span className="leading-tight">
            <span className="block font-bold tracking-tight text-[15px] group-hover:text-sky-700 transition-colors">
              PuenteZebra
            </span>
            <span className="hidden sm:block text-[11px] text-zinc-500">
              Impresión Zebra ZD220 en red
            </span>
          </span>
        </a>
        <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
          <a
            href="#como-funciona"
            className="px-3 py-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
          >
            Cómo funciona
          </a>
          <a
            href="#descargas"
            className="px-3 py-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
          >
            Descargas
          </a>
          <a
            href="#apk"
            className="px-3 py-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
          >
            Android
          </a>
          <a
            href="#faq"
            className="px-3 py-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
          >
            Preguntas
          </a>
        </nav>
        <div className="flex items-center gap-1.5">
          <a
            href="https://github.com/SEMAIN2026/puentezebra"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-zinc-100"
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
  apk,
}: {
  latest: VersionRow | null;
  older: VersionRow[];
  loading: boolean;
  apk: ApkVersionRow | null;
}) {
  return (
    <div className="space-y-16 sm:space-y-20">
      <Hero latest={latest} loading={loading} />
      <StatsStrip />
      <HowItWorks />
      <section id="descargas" className="space-y-6">
        <SectionHeading
          icon={<HardDriveDownload className="w-5 h-5" />}
          title="Descargas para Windows"
          subtitle="Los dos ejecutables de la última versión, listos para copiar en cada PC."
        />
        {loading ? (
          <Card className="border-zinc-200/80">
            <CardContent className="py-16 flex items-center justify-center text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Cargando…
            </CardContent>
          </Card>
        ) : latest ? (
          <LatestDownloadCard version={latest} />
        ) : (
          <Card className="border-dashed border-zinc-300 bg-white/60">
            <CardContent className="py-16 text-center text-zinc-500">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
              Aún no hay versiones publicadas.
            </CardContent>
          </Card>
        )}
      </section>
      <AndroidSection apk={apk} loading={loading} />
      {older.length > 0 && <OlderVersions older={older} />}
      <InstructionsSection />
      <FaqSection />
    </div>
  );
}

/* ---------------- Hero ---------------- */

function Hero({
  latest,
  loading,
}: {
  latest: VersionRow | null;
  loading: boolean;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] bg-[#0A1220] text-white px-6 sm:px-10 lg:px-14 py-14 sm:py-16 lg:py-20 shadow-2xl shadow-[#0A1220]/40">
      {/* Aurora animada */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-32 h-[30rem] w-[30rem] rounded-full bg-sky-500/25 blur-3xl animate-drift-a"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-48 -right-24 h-[32rem] w-[32rem] rounded-full bg-indigo-500/25 blur-3xl animate-drift-b"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 left-1/2 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl animate-drift-c"
      />
      {/* Malla de puntos */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)",
          backgroundSize: "26px 26px",
        }}
      />
      {/* Franjas de cebra decorativas */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-full w-24 sm:w-40 opacity-[0.10]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, #fff 0 14px, transparent 14px 34px)",
        }}
      />

      <div className="relative grid lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-6 items-center">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-medium text-sky-100 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {loading
              ? "Cargando…"
              : latest
                ? `Windows v${latest.version} · actualizada ${formatDate(latest.release_date)}`
                : "Sin versiones todavía"}
          </div>

          <h1 className="mt-6 text-4xl sm:text-5xl md:text-[3.4rem] font-bold tracking-tight leading-[1.07]">
            Imprime en tu{" "}
            <span className="text-shimmer">Zebra ZD220</span>{" "}
            desde cualquier equipo de la oficina
          </h1>

          <p className="mt-5 text-base sm:text-lg text-sky-100/75 max-w-xl leading-relaxed">
            Dos ejecutables, cero complicaciones: el{" "}
            <strong className="text-white font-semibold">SERVIDOR</strong> se
            queda con la impresora y los demás PCs imprimen con una{" "}
            <strong className="text-white font-semibold">
              impresora virtual
            </strong>
            . También desde el teléfono con la app Android.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="bg-white text-zinc-900 hover:bg-sky-50 h-12 px-6 text-base rounded-xl shadow-lg shadow-sky-900/40"
            >
              <a href="#descargas">
                <Download className="w-5 h-5 mr-2" />
                Descargar para Windows
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:border-white/40 h-12 px-6 text-base rounded-xl backdrop-blur"
            >
              <a href="#apk">
                <Smartphone className="w-5 h-5 mr-2" />
                App Android
              </a>
            </Button>
          </div>

          <div className="mt-9 flex flex-wrap gap-x-5 gap-y-2.5 text-sm text-sky-100/80">
            {[
              { icon: <Monitor className="w-4 h-4" />, label: "Windows 10/11 64-bit" },
              { icon: <Wifi className="w-4 h-4" />, label: "Red local, sin internet" },
              { icon: <Printer className="w-4 h-4" />, label: "Zebra ZD220 + hoja carta" },
              { icon: <Zap className="w-4 h-4" />, label: "Instalación en minutos" },
            ].map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                <span className="text-sky-300">{f.icon}</span>
                {f.label}
              </span>
            ))}
          </div>
        </div>

        <PrinterMockup />
      </div>
    </section>
  );
}

/* Maqueta CSS de la impresora sacando una etiqueta */

function PrinterMockup() {
  return (
    <div className="relative hidden lg:flex items-center justify-center py-6">
      <div
        aria-hidden
        className="absolute w-[24rem] h-[24rem] rounded-full bg-sky-500/20 blur-3xl"
      />
      {/* Chip flotante: red local */}
      <div className="absolute -left-2 top-2 z-10 animate-floaty">
        <div className="flex items-center gap-2.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md px-4 py-2.5 shadow-lg">
          <span className="w-8 h-8 rounded-xl bg-sky-400/20 grid place-items-center text-sky-300">
            <Wifi className="w-4 h-4" />
          </span>
          <div className="text-[11px] leading-tight">
            <div className="font-semibold text-white">Red local</div>
            <div className="text-white/60">Wi-Fi de la oficina</div>
          </div>
        </div>
      </div>
      {/* Chip flotante: trabajo recibido */}
      <div className="absolute -right-1 top-24 z-10 animate-floaty-slow">
        <div className="flex items-center gap-2.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md px-4 py-2.5 shadow-lg">
          <span className="w-8 h-8 rounded-xl bg-emerald-400/20 grid place-items-center text-emerald-300">
            <CheckCircle2 className="w-4 h-4" />
          </span>
          <div className="text-[11px] leading-tight">
            <div className="font-semibold text-white">Trabajo recibido</div>
            <div className="text-white/60">Enviado a la ZD220</div>
          </div>
        </div>
      </div>
      {/* Chip flotante: teléfono */}
      <div className="absolute -bottom-2 -left-6 z-10 animate-floaty-x">
        <div className="flex items-center gap-2.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md px-4 py-2.5 shadow-lg">
          <span className="w-8 h-8 rounded-xl bg-indigo-400/20 grid place-items-center text-indigo-300">
            <Smartphone className="w-4 h-4" />
          </span>
          <div className="text-[11px] leading-tight">
            <div className="font-semibold text-white">Desde el teléfono</div>
            <div className="text-white/60">Fotos, PDF, WhatsApp</div>
          </div>
        </div>
      </div>

      {/* Impresora */}
      <div className="relative w-[290px]">
        <div className="rounded-3xl bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-900 p-4 shadow-2xl ring-1 ring-white/10">
          {/* Ranura superior */}
          <div className="mx-3 mb-4 h-2.5 rounded-full bg-black/70 shadow-inner" />
          {/* Etiqueta saliendo */}
          <div className="rounded-2xl bg-[#0B1526] ring-1 ring-white/5 p-4">
            <div className="animate-feed">
              <div className="rounded-xl bg-white p-3 shadow-lg relative overflow-hidden">
                <div
                  aria-hidden
                  className="absolute right-0 top-0 h-full w-8 opacity-[0.12]"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(45deg, #111 0 5px, transparent 5px 10px)",
                  }}
                />
                <div className="text-[8px] font-mono text-zinc-400">
                  2026-11-27 · SEMAIN2026
                </div>
                <div className="text-[11px] font-bold tracking-widest text-zinc-800 mt-0.5">
                  PUENTEZEBRA
                </div>
                {/* Código de barras */}
                <div
                  className="mt-2 h-10 w-full"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(90deg, #111 0 2px, transparent 2px 4px, #111 4px 5px, transparent 5px 9px, #111 9px 12px, transparent 12px 14px)",
                  }}
                />
                <div className="mt-1 font-mono text-[9px] text-zinc-500 tracking-[0.25em]">
                  PZ-2026-MX
                </div>
              </div>
            </div>
          </div>
 {/* Panel inferior de la impresora */}
          <div className="mt-4 mx-1 flex items-center justify-between">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-glow-pulse" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[9px] font-mono text-white/40 tracking-widest">
              ZD220 · 203 dpi
            </span>
            <div className="flex gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white/25" />
              <span className="w-1.5 h-1.5 rounded-full bg-white/25" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Tira de datos ---------------- */

function StatsStrip() {
  const stats = [
    {
      icon: <Printer className="w-5 h-5" />,
      num: "2",
      label: "impresoras en red",
      detail: "etiquetas ZD220 + hoja carta",
      color: "from-sky-500 to-cyan-500",
    },
    {
      icon: <Zap className="w-5 h-5" />,
      num: "3",
      label: "pasos de instalación",
      detail: "y toda la oficina imprime",
      color: "from-indigo-500 to-violet-500",
    },
    {
      icon: <Wifi className="w-5 h-5" />,
      num: "0",
      label: "internet y suscripciones",
      detail: "todo viaja por la red local",
      color: "from-emerald-500 to-teal-500",
    },
    {
      icon: <Monitor className="w-5 h-5" />,
      num: "+2",
      label: "plataformas",
      detail: "PCs Windows y el teléfono",
      color: "from-amber-500 to-orange-500",
    },
  ];
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {stats.map((s, i) => (
        <Reveal key={i} delay={i * 70}>
          <div className="group h-full rounded-2xl bg-white border border-zinc-200/80 p-5 shadow-sm hover:shadow-lg hover:shadow-zinc-200/60 hover:-translate-y-0.5 transition-all">
            <div
              className={`w-10 h-10 rounded-xl grid place-items-center text-white bg-gradient-to-br ${s.color} shadow-md`}
            >
              {s.icon}
            </div>
            <div className="mt-3 text-3xl font-bold tracking-tight">
              {s.num}
              <span className="text-lg font-semibold text-zinc-400">
                {" "}
                {s.label}
              </span>
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">{s.detail}</div>
          </div>
        </Reveal>
      ))}
    </section>
  );
}

/* ---------------- Cómo funciona ---------------- */

function HowItWorks() {
  const pasos = [
    {
      icon: <Server className="w-5 h-5" />,
      n: "1",
      titulo: "En la PC de la impresora",
      texto:
        "Descarga y ejecuta el SERVIDOR. Elige tu Zebra ZD220 y abre el puerto del firewall: ya escucha trabajos de toda la red.",
      color: "from-sky-500 to-sky-600",
      sombra: "shadow-sky-500/30",
    },
    {
      icon: <Monitor className="w-5 h-5" />,
      n: "2",
      titulo: "En los demás PCs",
      texto:
        "Cada compañero ejecuta el CLIENTE y pulsa “Instalar impresora virtual”. Aparece “Zebra ZD220 (Red)” como una impresora más.",
      color: "from-indigo-500 to-indigo-600",
      sombra: "shadow-indigo-500/30",
    },
    {
      icon: <Printer className="w-5 h-5" />,
      n: "3",
      titulo: "Imprime desde donde sea",
      texto:
        "Word, Excel, el navegador, el escáner… cualquier programa imprime y el trabajo sale en la Zebra del SERVIDOR.",
      color: "from-emerald-500 to-emerald-600",
      sombra: "shadow-emerald-500/30",
    },
  ];
  return (
    <section id="como-funciona" className="space-y-6">
      <SectionHeading
        icon={<Network className="w-5 h-5" />}
        title="¿Cómo funciona?"
        subtitle="Tres pasos y la oficina imprime en la misma Zebra desde cualquier equipo."
      />
      <div className="relative grid sm:grid-cols-3 gap-4 sm:gap-5">
        {pasos.map((p, i) => (
          <Reveal key={i} delay={i * 90} className="h-full">
            <div className="group relative h-full rounded-2xl bg-white border border-zinc-200/80 p-6 shadow-sm hover:shadow-xl hover:shadow-zinc-200/70 hover:-translate-y-1 transition-all overflow-hidden">
              <div
                aria-hidden
                className={`absolute -top-10 -right-10 w-28 h-28 rounded-full bg-gradient-to-br ${p.color} opacity-[0.07] group-hover:opacity-[0.14] transition-opacity blur-xl`}
              />
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`w-12 h-12 rounded-2xl grid place-items-center text-white bg-gradient-to-br ${p.color} shadow-lg ${p.sombra}`}
                >
                  {p.icon}
                </div>
                <span className="text-5xl font-black text-zinc-100 select-none group-hover:text-zinc-200 transition-colors">
                  {p.n}
                </span>
              </div>
              <div className="font-bold text-[15px] mb-1.5">{p.titulo}</div>
              <p className="text-sm text-zinc-600 leading-relaxed">
                {p.texto}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Encabezado de sección ---------------- */

function SectionHeading({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3.5">
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-700 grid place-items-center text-white shrink-0 mt-0.5 shadow-md">
        {icon}
      </div>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        {subtitle && (
          <p className="text-sm text-zinc-500 mt-1 max-w-xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------------- Última versión ---------------- */

function WindowsLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M3 5.5 10.5 4.4v7.1H3V5.5Zm8.5-1.3L21 2.8v8.7h-9.5V4.2ZM3 12.5h7.5v7.1L3 18.5v-6Zm8.5 0H21v8.7l-9.5-1.4v-7.3Z" />
    </svg>
  );
}

function LatestDownloadCard({ version }: { version: VersionRow }) {
  return (
    <Card className="overflow-hidden border-zinc-200/80 rounded-3xl shadow-xl shadow-zinc-900/5 bg-white">
      <div className="relative bg-gradient-to-br from-[#0A1220] via-[#10203C] to-[#0A1220] text-white px-6 sm:px-8 py-7 flex items-center justify-between flex-wrap gap-4">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, #fff 0 12px, transparent 12px 28px)",
          }}
        />
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 grid place-items-center">
            <WindowsLogo className="w-7 h-7 text-sky-200" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-sky-300/80 mb-1 font-semibold">
              Última versión para Windows
            </div>
            <div className="text-3xl sm:text-4xl font-bold font-mono tracking-tight">
              v{version.version}
            </div>
          </div>
        </div>
        <div className="relative text-right text-sm text-sky-100/70">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-400/15 border border-emerald-400/25 text-emerald-300 font-medium">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            Recomendada
          </div>
          <div className="mt-1.5">Publicada {formatDate(version.release_date)}</div>
        </div>
      </div>
      <CardContent className="p-6 sm:p-8 space-y-6">
        {version.changelog && (
          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-sky-600" /> Novedades de esta versión
            </h3>
            <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700 bg-sky-50/70 border-l-4 border-sky-200 rounded-xl p-4 border border-zinc-100 max-h-72 overflow-y-auto leading-relaxed">
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
            filename="PuenteZebra-SERVIDOR.exe"
            primary
          />
          <DownloadTile
            href={version.cliente_url}
            title="CLIENTE"
            subtitle="Para los PCs de los compañeros"
            icon={<Monitor className="w-5 h-5" />}
            filename="PuenteZebra-CLIENTE.exe"
          />
        </div>
        <p className="text-xs text-zinc-500 flex items-center gap-1.5">
          <CircleCheck className="w-3.5 h-3.5 text-emerald-500" />
          Ambos son ejecutables independientes: no requieren instalación ni
          permisos de administrador para ejecutarse.
        </p>
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
      className={`group relative block overflow-hidden rounded-2xl border p-6 transition-all hover:-translate-y-1 hover:shadow-xl ${
        primary
          ? "border-transparent bg-gradient-to-br from-sky-500 via-sky-600 to-indigo-700 text-white hover:shadow-sky-500/30"
          : "border-zinc-200 bg-white hover:border-sky-300 hover:shadow-sky-100"
      }`}
    >
      {primary && (
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, #fff 0 12px, transparent 12px 28px)",
          }}
        />
      )}
      <div className="relative flex items-center justify-between mb-4">
        <div
          className={`w-12 h-12 rounded-xl grid place-items-center ${
            primary ? "bg-white/15" : "bg-sky-50 text-sky-700"
          }`}
        >
          {icon}
        </div>
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full transition-all ${
            primary
              ? "bg-white text-sky-700 group-hover:gap-2.5"
              : "bg-zinc-900 text-white group-hover:gap-2.5"
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          Descargar
        </span>
      </div>
      <div className="relative font-bold text-lg">{title}</div>
      <div
        className={`text-xs mt-1 mb-3 ${
          primary ? "text-sky-100/80" : "text-zinc-500"
        }`}
      >
        {subtitle}
      </div>
      <div
        className={`relative font-mono text-[11px] truncate ${
          primary ? "text-sky-200/70" : "text-zinc-400"
        }`}
      >
        {filename}
      </div>
      <div className="relative mt-4 flex items-center gap-1.5">
        <WindowsLogo
          className={`w-3.5 h-3.5 ${primary ? "text-sky-200" : "text-zinc-400"}`}
        />
        <span
          className={`text-[11px] ${primary ? "text-sky-100/70" : "text-zinc-500"}`}
        >
          Windows 10/11 · 64 bits
        </span>
      </div>
    </a>
  );
}

/* ---------------- Versiones anteriores ---------------- */

function OlderVersions({ older }: { older: VersionRow[] }) {
  return (
    <section className="space-y-5">
      <SectionHeading
        icon={<FileText className="w-5 h-5" />}
        title="Versiones anteriores"
        subtitle={
          older.length === 1
            ? "1 versión anterior por si necesitas volver atrás."
            : `${older.length} versiones anteriores por si necesitas volver atrás.`
        }
      />
      <Accordion type="single" collapsible className="space-y-2.5">
        {older.map((v) => (
          <AccordionItem
            key={v.id}
            value={`v-${v.id}`}
            className="border border-zinc-200/80 rounded-2xl px-5 bg-white data-[state=open]:shadow-md transition-shadow"
          >
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center gap-3 w-full">
                <span className="font-mono font-semibold">{v.version}</span>
                <span className="text-sm text-zinc-500">
                  {formatDate(v.release_date)}
                </span>
                <ChevronRight className="w-4 h-4 ml-auto text-zinc-300" />
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <VersionDetail v={v} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

function VersionDetail({ v }: { v: VersionRow }) {
  return (
    <div className="space-y-3">
      {v.changelog && (
        <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700 bg-zinc-50 rounded-xl p-4 border border-zinc-100 max-h-60 overflow-y-auto">
          {v.changelog}
        </pre>
      )}
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" className="rounded-lg">
          <a href={v.servidor_url} download>
            <Server className="w-4 h-4 mr-1.5" /> SERVIDOR
          </a>
        </Button>
        <Button asChild size="sm" variant="outline" className="rounded-lg">
          <a href={v.cliente_url} download>
            <Monitor className="w-4 h-4 mr-1.5" /> CLIENTE
          </a>
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Instrucciones ---------------- */

function InstructionsSection() {
  return (
    <section className="space-y-6">
      <SectionHeading
        icon={<MousePointerClick className="w-5 h-5" />}
        title="Instalación paso a paso"
        subtitle="Cinco minutos por PC y queda funcionando para siempre."
      />
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="border-zinc-200/80 rounded-2xl bg-white overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-sky-500 to-sky-600" />
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-base">
              <span className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 grid place-items-center shrink-0">
                <Server className="w-4 h-4" />
              </span>
              En tu PC (SERVIDOR)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-600">
            <Paso n={1}>
              Descarga y ejecuta{" "}
              <code className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-800 text-[13px]">
                PuenteZebra-SERVIDOR.exe
              </code>
              .
            </Paso>
            <Paso n={2}>
              En el menú de la bandeja, selecciona tu impresora Zebra ZD220
              como destino.
            </Paso>
            <Paso n={3}>
              Pulsa <em>Abrir puerto en firewall</em> para que los compañeros
              puedan enviar trabajos.
            </Paso>
            <Paso n={4} ultimo>
              Marca <em>Inicio con Windows</em> si quieres que arranque solo.
            </Paso>
          </CardContent>
        </Card>
        <Card className="border-zinc-200/80 rounded-2xl bg-white overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-indigo-600" />
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-base">
              <span className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 grid place-items-center shrink-0">
                <Monitor className="w-4 h-4" />
              </span>
              En el PC del compañero (CLIENTE)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-600">
            <Paso n={1}>
              Descarga y ejecuta{" "}
              <code className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-800 text-[13px]">
                PuenteZebra-CLIENTE.exe
              </code>
              .
            </Paso>
            <Paso n={2}>
              Pulsa <em>Instalar impresora virtual</em> (pedirá permisos de
              administrador, solo una vez).
            </Paso>
            <Paso n={3}>Indica la IP de tu PC servidor y guarda.</Paso>
            <Paso n={4} ultimo>
              Imprime desde cualquier programa a <em>“Zebra ZD220 (Red)”</em> y
              llegará a tu Zebra.
            </Paso>
          </CardContent>
        </Card>
      </div>
      <div className="flex gap-3 rounded-2xl bg-amber-50 border border-amber-200/80 p-4 text-sm text-amber-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          <strong>Importante:</strong> ambos PCs deben estar en la misma red
          local (mismo Wi-Fi o cable). Si usas VPN o redes separadas, configura
          las reglas de firewall de forma manual.
        </span>
      </div>
    </section>
  );
}

function Paso({
  n,
  children,
  ultimo,
}: {
  n: number;
  children: React.ReactNode;
  ultimo?: boolean;
}) {
  return (
    <div className={`flex gap-3 ${ultimo ? "" : "pb-3 mb-3 border-b border-zinc-100"}`}>
      <span className="w-6 h-6 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-950 text-white text-xs font-bold grid place-items-center shrink-0 mt-0.5">
        {n}
      </span>
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}

/* ---------------- App Android (pública) ---------------- */

function AndroidSection({
  apk,
  loading,
}: {
  apk: ApkVersionRow | null;
  loading: boolean;
}) {
  const [qr, setQr] = useState<string>("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!apk || !apk.apk_url) return;
    const u = apk.apk_url.startsWith("http")
      ? apk.apk_url
      : window.location.origin + apk.apk_url;
    setDownloadUrl(u);
    QRCode.toDataURL(u, { width: 240, margin: 1 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [apk]);

  if (!apk) return null;

  return (
    <section className="space-y-6" id="apk">
      <SectionHeading
        icon={<Smartphone className="w-5 h-5" />}
        title="App para Android"
        subtitle="Imprime desde el teléfono con la misma red Wi-Fi de la oficina, incluida la impresora virtual del sistema."
      />
      <Card className="border-zinc-200/80 rounded-3xl overflow-hidden bg-white shadow-lg shadow-zinc-900/5">
        <div className="relative bg-gradient-to-br from-[#0A1220] via-[#13294A] to-[#0A1220] text-white px-6 sm:px-8 py-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full bg-sky-500/20 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(115deg, #fff 0 12px, transparent 12px 28px)",
            }}
          />
          <div className="relative flex items-center gap-4 flex-wrap">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 grid place-items-center">
              <Smartphone className="w-6 h-6 text-sky-300" />
            </div>
            <div>
              <div className="font-bold text-lg">
                PuenteZebra Móvil{" "}
                <span className="font-mono text-sky-300 text-base">
                  v{apk.version}
                </span>
              </div>
              <div className="text-xs text-sky-100/60 mt-0.5">
                código de versión {apk.version_code} · publicada{" "}
                {formatDate(apk.release_date)}
              </div>
            </div>
            {loading && (
              <Loader2 className="w-4 h-4 animate-spin text-white/60 ml-auto" />
            )}
          </div>
        </div>
        <CardContent className="p-6 sm:p-8 grid lg:grid-cols-[1.25fr_1fr] gap-8 lg:gap-10 items-start">
          <div className="space-y-5">
            <p className="text-sm text-zinc-600 leading-relaxed">
              Imprime en las dos impresoras del SERVIDOR (etiquetas Zebra y hoja
              carta) con el Wi-Fi de la oficina. Al activar el servicio,{" "}
              <strong>“PuenteZebra ETIQUETAS”</strong> y{" "}
              <strong>“PuenteZebra DOCUMENTOS”</strong> aparecen como impresoras
              del teléfono: imprime desde Fotos, el escáner, PDF o WhatsApp con{" "}
              <strong>vista previa y número de páginas</strong>. La app revisa
              sola si hay versión nueva al abrirla.
            </p>
            {apk.changelog && (
              <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700 bg-sky-50/70 border-l-4 border-sky-200 rounded-xl p-4 border border-zinc-100 max-h-56 overflow-y-auto leading-relaxed">
                {apk.changelog}
              </pre>
            )}
            {downloadUrl && (
              <Button
                asChild
                size="lg"
                className="rounded-xl h-12 px-6 text-base bg-gradient-to-r from-sky-500 via-sky-600 to-indigo-600 hover:opacity-95 shadow-lg shadow-sky-500/30"
              >
                <a href={downloadUrl} download="PuenteZebra-Movil.apk">
                  <Download className="w-5 h-5 mr-2" />
                  Descargar APK (v{apk.version})
                </a>
              </Button>
            )}
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 divide-y divide-zinc-100">
              {[
                {
                  icon: <Download className="w-4 h-4" />,
                  texto: (
                    <>
                      Descarga el APK en el teléfono (o escanea el código QR de
                      la derecha con la cámara).
                    </>
                  ),
                },
                {
                  icon: <ShieldCheck className="w-4 h-4" />,
                  texto: (
                    <>
                      Al abrirlo, Android pedirá{" "}
                      <em>permitir instalar apps de origen desconocido</em>:
                      dale a Permitir (solo la primera vez).
                    </>
                  ),
                },
                {
                  icon: <RefreshCw className="w-4 h-4" />,
                  texto: (
                    <>
                      Si ya tenías la app instalada, se actualiza ENCIMA:
                      conserva la IP y toda la configuración.
                    </>
                  ),
                },
                {
                  icon: <Printer className="w-4 h-4" />,
                  texto: (
                    <>
                      Dentro de la app guarda la IP del SERVIDOR y pulsa{" "}
                      <em>Activar servicio</em>. Desde ese momento puedes
                      imprimir desde cualquier app eligiendo{" "}
                      <em>PuenteZebra ETIQUETAS</em> o{" "}
                      <em>PuenteZebra DOCUMENTOS</em>.
                    </>
                  ),
                },
              ].map((s, i) => (
                <div
                  key={i}
                  className="flex gap-3 px-4 py-3 text-sm text-zinc-600"
                >
                  <span className="w-7 h-7 rounded-full bg-sky-100 text-sky-700 grid place-items-center shrink-0">
                    {s.icon}
                  </span>
                  <p className="leading-relaxed">{s.texto}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Maqueta del teléfono + QR */}
          <div className="grid sm:grid-cols-[auto_1fr] lg:grid-cols-1 gap-8 items-center justify-center text-center sm:text-left lg:text-center">
            <PhoneMockup />
            <div className="mx-auto space-y-3">
              <div className="relative inline-block p-4 rounded-3xl bg-gradient-to-br from-sky-100 to-indigo-100 border border-sky-200/60 shadow-inner">
                {qr ? (
                  <img
                    src={qr}
                    width={208}
                    height={208}
                    alt="Código QR para descargar el APK"
                    className="rounded-xl bg-white"
                  />
                ) : (
                  <div className="w-[208px] h-[208px] rounded-xl border border-dashed border-sky-300 grid place-items-center text-xs text-sky-500">
                    Generando QR…
                  </div>
                )}
                {/* Esquinas decorativas */}
                <span
                  aria-hidden
                  className="absolute -top-1.5 -left-1.5 w-6 h-6 border-t-[3px] border-l-[3px] border-sky-400 rounded-tl-lg"
                />
                <span
                  aria-hidden
                  className="absolute -bottom-1.5 -right-1.5 w-6 h-6 border-b-[3px] border-r-[3px] border-indigo-400 rounded-br-lg"
                />
              </div>
              <div className="text-xs text-zinc-500 flex items-center gap-1.5 justify-center">
                <QrCode className="w-3.5 h-3.5" /> Escanea con el teléfono
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

/* Maqueta CSS del teléfono con la app real dentro */

function PhoneMockup() {
  return (
    <div className="mx-auto animate-floaty-slow">
      <div className="relative w-[236px] rounded-[2.4rem] border border-zinc-800/80 bg-zinc-950 p-2.5 shadow-2xl shadow-zinc-900/30">
        {/* Notch */}
        <div className="absolute left-1/2 -translate-x-1/2 top-3.5 w-16 h-4 rounded-full bg-zinc-950 z-10 border border-zinc-800/60" />
        <div className="rounded-[1.9rem] overflow-hidden bg-[#F4F7FC] ring-1 ring-white/10">
          {/* Barra de estado */}
          <div className="bg-[#0A1220] px-4 pt-2.5 pb-1.5 flex items-center justify-between text-[8px] text-white/70 font-medium">
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <Wifi className="w-2.5 h-2.5" />
              <span className="inline-block w-3 h-1.5 rounded-[2px] bg-white/70" />
            </span>
          </div>
          {/* Encabezado de la app */}
          <div className="bg-[#0A1220] px-3.5 pb-3.5 pt-2 flex items-center gap-2.5">
            <Logo size={26} />
            <div>
              <div className="text-white text-[10px] font-bold leading-none">
                PuenteZebra Móvil
              </div>
              <div className="text-[6.5px] text-sky-200/60 mt-0.5 tracking-wide">
                v{APP_VERSION_PLACEHOLDER}
              </div>
            </div>
          </div>
          <div className="p-3 space-y-2">
            {/* Tarjeta impresora 1 */}
            <div className="rounded-xl border border-zinc-200 bg-white p-2.5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-sky-100 grid place-items-center">
                  <Printer className="w-3.5 h-3.5 text-sky-600" />
                </span>
                <div className="min-w-0">
                  <div className="text-[9px] font-bold text-zinc-800">
                    ETIQUETAS
                  </div>
                  <div className="text-[7px] text-zinc-500 truncate">
                    Zebra ZD220 · puerto 9100
                  </div>
                </div>
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              </div>
            </div>
            {/* Tarjeta impresora 2 */}
            <div className="rounded-xl border border-zinc-200 bg-white p-2.5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-indigo-100 grid place-items-center">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                </span>
                <div className="min-w-0">
                  <div className="text-[9px] font-bold text-zinc-800">
                    DOCUMENTOS
                  </div>
                  <div className="text-[7px] text-zinc-500 truncate">
                    Epson L3250 · puerto 9101
                  </div>
                </div>
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              </div>
            </div>
            {/* Consola de estado */}
            <div className="rounded-xl bg-zinc-900 p-2.5 font-mono text-[7px] leading-[1.7]">
              <div className="text-emerald-400">pz@movil:~$ listo_</div>
              <div className="text-white/50">
                OK conexión 192.168.88.7 · puertos abiertos
              </div>
            </div>
            {/* Botón principal */}
            <div className="h-8 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white text-[8px] font-bold grid place-items-center tracking-wide shadow-md shadow-sky-500/25">
              IMPRIMIR PÁGINA DE PRUEBA
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const APP_VERSION_PLACEHOLDER = "1.3.3";

/* ---------------- FAQ ---------------- */

function FaqSection() {
  const faqs = [
    {
      q: "¿Necesita internet o pago por suscripción?",
      a: "No. Todo funciona por la red local de la oficina (el mismo Wi-Fi o cable). La página solo sirve para repartir los ejecutables: ningún trabajo de impresión sale a internet.",
    },
    {
      q: "¿Los compañeros necesitan permisos de administrador?",
      a: "Solo una vez, al instalar la impresora virtual con el CLIENTE. Después, imprimir es como imprimir en cualquier otra impresora: sin permisos y desde cualquier programa.",
    },
    {
      q: "¿Cómo actualizo la app del teléfono?",
      a: "Descarga el APK más nuevo (desde la propia app o escaneando el QR de esta página) e instálalo: Android lo pone ENCIMA del anterior sin borrar nada, ni la IP ni los puertos configurados.",
    },
    {
      q: "¿Y si algo no imprime?",
      a: "Revisa el orden de siempre: SERVIDOR abierto en la PC de la impresora, teléfono o PC en la misma red, e IP correcta. Si un trabajo falla, el motivo exacto aparece en la notificación y en Ajustes → Impresión (en el teléfono) o en la ventana del SERVIDOR (en Windows).",
    },
    {
      q: "¿Se puede imprimir desde el escáner o desde WhatsApp?",
      a: "Sí. En el teléfono, cualquier app con menú Imprimir puede usar las impresoras PuenteZebra, con vista previa y número de páginas. En Windows, cualquier programa que imprima puede usar la impresora virtual “Zebra ZD220 (Red)”.",
    },
  ];
  return (
    <section id="faq" className="space-y-6">
      <SectionHeading
        icon={<Info className="w-5 h-5" />}
        title="Preguntas frecuentes"
        subtitle="Las dudas más comunes de la oficina, resueltas."
      />
      <Card className="border-zinc-200/80 rounded-2xl bg-white divide-y divide-zinc-100 p-2">
        <Accordion type="single" collapsible>
          {faqs.map((f, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="border-0 px-4 rounded-xl data-[state=open]:bg-sky-50/60 transition-colors"
            >
              <AccordionTrigger className="hover:no-underline text-[15px] font-semibold py-4 text-left">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-zinc-600 leading-relaxed pb-4">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
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
    <div className="max-w-sm mx-auto pt-10">
      <Card className="border-zinc-200/80 rounded-3xl shadow-xl shadow-zinc-900/5 bg-white">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 via-sky-600 to-indigo-700 grid place-items-center text-white mb-3 shadow-lg shadow-sky-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl">Panel de administración</CardTitle>
          <p className="text-sm text-zinc-500 mt-1">
            Publica nuevas versiones para la oficina
          </p>
        </CardHeader>
        <CardContent className="pb-8">
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
                className="h-11 rounded-xl"
              />
            </div>
            <Button type="submit" className="w-full h-11 rounded-xl" disabled={loading}>
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
  apkVersions,
  onChanged,
  onExit,
}: {
  versions: VersionRow[];
  apkVersions: ApkVersionRow[];
  onChanged: () => Promise<void> | void;
  onExit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [apkOpen, setApkOpen] = useState(false);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Panel de administración</h1>
          <p className="text-sm text-zinc-500">
            Publica nuevas versiones de PuenteZebra (Windows y Android). Los
            archivos se guardan en la base de datos y, si está disponible,
            también en GitHub Releases.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onExit}>
            <ChevronRight className="w-4 h-4 mr-1 rotate-180" /> Ver página
          </Button>
          <Dialog open={apkOpen} onOpenChange={setApkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Smartphone className="w-4 h-4 mr-2" /> APK Android
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Publicar APK Android</DialogTitle>
                <DialogDescription>
                  Sube el .apk compilado con el mismo keystore. Se guarda en la
                  base de datos y, si GitHub responde, también como release{" "}
                  <code className="px-1 rounded bg-zinc-100">
                    android-vX.Y.Z
                  </code>
                  . La app instalada lo detecta sola al abrirse.
                </DialogDescription>
              </DialogHeader>
              <ApkUploadForm
                onDone={async () => {
                  setApkOpen(false);
                  await onChanged();
                }}
              />
            </DialogContent>
          </Dialog>
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
                  Sube los dos archivos .exe. Se creará un release en GitHub con
                  tag{" "}
                  <code className="px-1 rounded bg-zinc-100">vX.Y.Z</code> y se
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
      <ApkVersionsAdminTable
        apkVersions={apkVersions}
        onChanged={onChanged}
      />
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
    current: number;
    total: number;
    label: string;
  }>({ phase: "idle", current: 0, total: 0, label: "" });

  const CHUNK_SIZE = 3 * 1024 * 1024;

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
      await uploadFileInChunks(sessionId, servidorFile, 0);
      await uploadFileInChunks(sessionId, clienteFile, 1);
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
  accept,
}: {
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
  disabled?: boolean;
  accept?: string;
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
          accept={
            accept ??
            ".exe,application/vnd.microsoft.portable-executable,application/x-msdownload"
          }
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
                        ¿Quieres eliminar también el release en GitHub (tag{" "}
                        <code className="px-1 rounded bg-zinc-100">v{v.version}</code>)?
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

/* ---------------- APK Android: formularios de admin ---------------- */

function ApkUploadForm({ onDone }: { onDone: () => Promise<void> | void }) {
  const [version, setVersion] = useState("");
  const [versionCode, setVersionCode] = useState("");
  const [releaseDate, setReleaseDate] = useState(
    new Date().toISOString().substring(0, 10)
  );
  const [changelog, setChangelog] = useState("");
  const [apkFile, setApkFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      toast.error("La versión debe tener formato X.Y.Z (ej. 1.0.1)");
      return;
    }
    const vc = Number(versionCode);
    if (!Number.isInteger(vc) || vc < 1) {
      toast.error(
        "El código de versión debe ser un entero ≥ 1 (mayor que el ya publicado)"
      );
      return;
    }
    if (!apkFile) {
      toast.error("Adjunta el archivo .apk");
      return;
    }
    if (apkFile.size > 4 * 1024 * 1024) {
      toast.error("El APK supera 4MB; esta vía de subida admite hasta 4MB");
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("version", version);
      form.append("versionCode", String(vc));
      form.append("releaseDate", releaseDate);
      form.append("changelog", changelog);
      form.append("isLatest", "true");
      form.append("apk", apkFile, apkFile.name);
      const res = await fetch("/api/admin/publish-apk", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Error al publicar el APK");
      }
      toast.success(
        `APK v${version} publicado${data.github?.ok ? " (GitHub + base de datos)" : " (en la base de datos)"}`
      );
      setVersion("");
      setVersionCode("");
      setChangelog("");
      setApkFile(null);
      await onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error de red");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="apk-version">Versión *</Label>
          <Input
            id="apk-version"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="1.0.1"
            className="font-mono"
            disabled={submitting}
          />
          <p className="text-xs text-zinc-500">Formato X.Y.Z, mayor que la actual.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="apk-code">Código de versión (versionCode) *</Label>
          <Input
            id="apk-code"
            value={versionCode}
            onChange={(e) => setVersionCode(e.target.value)}
            placeholder="2"
            inputMode="numeric"
            className="font-mono"
            disabled={submitting}
          />
          <p className="text-xs text-zinc-500">
            Entero SIEMPRE mayor que el anterior: es lo que hace que Android la
            instale como actualización.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="apk-date">Fecha de publicación *</Label>
        <Input
          id="apk-date"
          type="date"
          value={releaseDate}
          onChange={(e) => setReleaseDate(e.target.value)}
          disabled={submitting}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="apk-changelog">Novedades de esta versión</Label>
        <Textarea
          id="apk-changelog"
          value={changelog}
          onChange={(e) => setChangelog(e.target.value)}
          placeholder={"Qué cambió...\n- Mejora X\n- Corrección Y"}
          rows={5}
          className="font-mono text-sm"
          disabled={submitting}
        />
      </div>
      <FileInput
        label="PuenteZebra-Movil-vX.Y.Z.apk *"
        file={apkFile}
        onChange={setApkFile}
        disabled={submitting}
        accept=".apk,application/vnd.android.package-archive"
      />
      <p className="text-xs text-zinc-500 bg-amber-50 border border-amber-200 rounded-md p-3 text-amber-800">
        Compila siempre con el mismo keystore (pz.keystore del proyecto). Si la
        firma cambia, Android no dejará actualizar encima de la app instalada.
      </p>
      <DialogFooter>
        <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Publicando…
            </>
          ) : (
            <>
              <Smartphone className="w-4 h-4 mr-2" /> Publicar APK
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ApkVersionsAdminTable({
  apkVersions,
  onChanged,
}: {
  apkVersions: ApkVersionRow[];
  onChanged: () => Promise<void> | void;
}) {
  const [deleting, setDeleting] = useState<number | null>(null);

  const removeVersion = async (v: ApkVersionRow, deleteGithub: boolean) => {
    setDeleting(v.id);
    try {
      const res = await fetch("/api/admin/delete-apk", {
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
        `APK v${v.version} eliminado${
          data.ghDeleted ? " (también de GitHub)" : ""
        }`
      );
      await onChanged();
    } finally {
      setDeleting(null);
    }
  };

  if (apkVersions.length === 0) {
    return (
      <Card className="border-dashed border-zinc-300 bg-zinc-50">
        <CardContent className="py-10 text-center text-zinc-500">
          <Smartphone className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Aún no hay APK publicado. Pulsa "APK Android" para publicar el
          primero.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-zinc-200">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Smartphone className="w-4 h-4" /> APK Android{" "}
          <Badge variant="secondary" className="font-mono">
            {apkVersions.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-zinc-100">
          {apkVersions.map((v) => (
            <div
              key={v.id}
              className="p-4 flex items-start gap-4 flex-wrap hover:bg-zinc-50/50"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono font-semibold">v{v.version}</span>
                  <span className="text-xs text-zinc-500 font-mono">
                    code {v.version_code}
                  </span>
                  {v.is_latest === 1 && (
                    <Badge className="bg-emerald-500 hover:bg-emerald-500">
                      <Star className="w-3 h-3 mr-1 fill-white" /> Última
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-zinc-500 mb-2">
                  {formatDate(v.release_date)} · subida{" "}
                  {formatDateTime(v.created_at)}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <a href={v.apk_url} target="_blank" rel="noreferrer">
                      <Smartphone className="w-3.5 h-3.5 mr-1" /> APK
                      <ExternalLink className="w-3 h-3 ml-1 opacity-60" />
                    </a>
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-1">
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
                        ¿Eliminar el APK v{v.version}?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción quita la versión de la base de datos.
                        ¿Quieres eliminar también el release en GitHub (tag{" "}
                        <code className="px-1 rounded bg-zinc-100">
                          android-v{v.version}
                        </code>
                        )?
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
    <footer className="mt-auto bg-[#0A1220] text-white relative overflow-hidden">
      {/* Franjas de cebra decorativas */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-full w-20 sm:w-36 opacity-[0.06]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, #fff 0 14px, transparent 14px 34px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl"
      />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10 flex items-center justify-between flex-wrap gap-6">
        <div className="flex items-center gap-3">
          <Logo size={36} />
          <div>
            <div className="font-semibold text-sm">PuenteZebra</div>
            <div className="text-xs text-sky-100/50">
              Sistema de impresión ZD220 en red
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-sky-100/60 flex-wrap">
          <a
            href="https://github.com/SEMAIN2026/puentezebra"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white transition-colors inline-flex items-center gap-1.5"
          >
            <Github className="w-3.5 h-3.5" /> Código fuente
          </a>
          <span className="opacity-40">·</span>
          <span>Powered by Vercel + Turso + GitHub</span>
          <span className="opacity-40">·</span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            Creado por{" "}
            <span className="font-semibold text-white">Walter Piñera</span>
          </span>
        </div>
      </div>
      <div className="relative border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 text-[11px] text-sky-100/40">
          © {new Date().getFullYear()} PuenteZebra · Hecho para imprimir etiquetas sin complicaciones.
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
