package com.semain2026.puentezebramovil;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintJobId;
import android.print.PrintJobInfo;
import android.print.PrinterCapabilitiesInfo;
import android.print.PrintAttributes;
import android.print.PrinterId;
import android.print.PrinterInfo;
import android.printservice.PrintJob;
import android.printservice.PrintService;
import android.printservice.PrinterDiscoverySession;
import android.graphics.pdf.PdfRenderer;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Servicio de impresión del sistema: expone las dos impresoras del SERVIDOR
 * ("PuenteZebra ETIQUETAS" y "PuenteZebra DOCUMENTOS") a todas las apps del
 * teléfono.
 *
 * v1.3.2 — ARREGLO del error "ERROR AL IMPRIMIR: FILE DESCRIPTOR NOT SEEKABLE"
 * de la 1.3.1 (imprimir desde otras apps fallaba siempre): el spooler de
 * Android entrega el documento al servicio como un descriptor que puede ser
 * una TUBERÍA (no se puede hacer seek sobre él), mientras que PdfRenderer
 * exige un archivo real. Desde la propia app las pruebas sí funcionaban
 * porque no pasan por el spooler. Ahora el documento se copia SIEMPRE a un
 * archivo temporal antes de renderizarlo y el archivo se borra al terminar.
 *
 * v1.3.1 — ARREGLO del error "ERROR AL IMPRIMIR: MUST BE CALLED FROM THE MAIN
 * THREAD" de la 1.3.0 (trabajos atascados en "Imprimiendo…" para siempre):
 *
 * Android exige que TODOS los métodos de PrintJob (start, getInfo, getId,
 * getDocument, complete, fail, cancel) se llamen desde el HILO PRINCIPAL del
 * servicio. En la 1.3.0 se llamaban dentro del hilo del fondo (getDocument
 * explotaba al instante; luego fail() tampoco podía registrarse y el trabajo
 * quedaba colgado en "Imprimiendo…" sin enviar nada a la impresora). Las
 * pruebas desde la propia app sí funcionaban porque no usan PrintJob.
 *
 * Ahora:
 *  1. job.start(), job.getInfo() y job.getDocument().getData() se toman en el
 *     hilo principal, dentro de onPrintJobQueued.
 *  2. El hilo del fondo solo renderiza y envía por el socket (página por
 *     página, igual que la 1.3.0): no toca NINGÚN método de PrintJob.
 *  3. job.complete()/job.fail()/job.cancel() se ejecutan SIEMPRE volviendo al
 *     hilo principal (Handler del Looper principal): los trabajos terminan
 *     bien o quedan fallidos con su motivo, pero jamás colgados.
 *  4. Cancelar desde la notificación aborta el envío de verdad (bandera
 *     atómica consultada entre página y página).
 */
public class PuentePrintService extends PrintService {

    private static final String CANAL = "impresiones";
    static final String LOCAL_DOCUMENTOS = "documentos";
    static final String LOCAL_ETIQUETAS = "etiquetas";
    static final String PREFS = "cfg";

    private PrinterId idE;
    private PrinterId idD;
    private NotificationManager nm;
    private int notifId = 100;
    /** Hilo principal: aquí se cierran los trabajos (complete/fail). */
    private Handler principal;
    /** Banderas de cancelación por trabajo, consultadas por el hilo del fondo. */
    private final Map<PrintJobId, AtomicBoolean> cancelados = new ConcurrentHashMap<>();
    /** Un trabajo a la vez: evita quedarse sin memoria con varios a la vez. */
    private final Object candado = new Object();

    @Override
    public void onCreate() {
        super.onCreate();
        idE = generatePrinterId(LOCAL_ETIQUETAS);
        idD = generatePrinterId(LOCAL_DOCUMENTOS);
        principal = new Handler(Looper.getMainLooper());
        nm = (NotificationManager) getSystemService("notification");
        if (Build.VERSION.SDK_INT >= 26 && nm != null) {
            NotificationChannel canal = new NotificationChannel(CANAL,
                    "Impresiones PuenteZebra", NotificationManager.IMPORTANCE_LOW);
            canal.setDescription("Estado de los trabajos enviados a las impresoras");
            nm.createNotificationChannel(canal);
        }
    }

    @Override
    protected PrinterDiscoverySession onCreatePrinterDiscoverySession() {
        return new Sesion();
    }

    private class Sesion extends PrinterDiscoverySession {
        @Override
        public void onDestroy() {
        }

        @Override
        public void onStartPrinterStateTracking(PrinterId printerId) {
            // Refrescar estado al instante cuando el sistema lo pide.
            addPrinters(Arrays.asList(impresora(idE, "PuenteZebra ETIQUETAS",
                            "Zebra ZD220 · etiquetas por red (SERVIDOR)", capsEtiquetas()),
                    impresora(idD, "PuenteZebra DOCUMENTOS",
                            "Hoja carta por red (SERVIDOR)", capsDocumentos())));
        }

        @Override
        public void onStopPrinterDiscovery() {
        }

        @Override
        public void onStopPrinterStateTracking(PrinterId printerId) {
        }

        @Override
        public void onValidatePrinters(List<PrinterId> list) {
            addPrinters(Arrays.asList(impresora(idE, "PuenteZebra ETIQUETAS",
                            "Zebra ZD220 · etiquetas por red (SERVIDOR)", capsEtiquetas()),
                    impresora(idD, "PuenteZebra DOCUMENTOS",
                            "Hoja carta por red (SERVIDOR)", capsDocumentos())));
        }

        @Override
        public void onStartPrinterDiscovery(List<PrinterId> list) {
            addPrinters(Arrays.asList(impresora(idE, "PuenteZebra ETIQUETAS",
                            "Zebra ZD220 · etiquetas por red (SERVIDOR)", capsEtiquetas()),
                    impresora(idD, "PuenteZebra DOCUMENTOS",
                            "Hoja carta por red (SERVIDOR)", capsDocumentos())));
        }
    }

    private PrinterInfo impresora(PrinterId id, String nombre, String descripcion,
                                  PrinterCapabilitiesInfo caps) {
        PrinterInfo.Builder b = new PrinterInfo.Builder(id, nombre, PrinterInfo.STATUS_IDLE);
        b.setDescription(descripcion);
        b.setCapabilities(caps);
        return b.build();
    }

    private PrinterCapabilitiesInfo capsEtiquetas() {
        SharedPreferences prefs = prefs();
        int wmm = prefs.getInt("labelWmm", 102);
        int hmm = prefs.getInt("labelHmm", 152);
        int wMils = Math.max(100, (int) Math.round((wmm / 25.4) * 1000.0));
        int hMils = Math.max(100, (int) Math.round((hmm / 25.4) * 1000.0));
        PrinterCapabilitiesInfo.Builder b = new PrinterCapabilitiesInfo.Builder(idE);
        b.addMediaSize(new PrintAttributes.MediaSize("pz-etiqueta", "Etiqueta", wMils, hMils), true);
        b.addResolution(new PrintAttributes.Resolution("pz-203", "203 dpi",
                PrintEngine.DPI_ETIQUETAS, PrintEngine.DPI_ETIQUETAS), true);
        b.setColorModes(PrintAttributes.COLOR_MODE_MONOCHROME, PrintAttributes.COLOR_MODE_MONOCHROME);
        b.setMinMargins(PrintAttributes.Margins.NO_MARGINS);
        return b.build();
    }

    private PrinterCapabilitiesInfo capsDocumentos() {
        PrinterCapabilitiesInfo.Builder b = new PrinterCapabilitiesInfo.Builder(idD);
        b.addMediaSize(PrintAttributes.MediaSize.NA_LETTER, true);
        b.addResolution(new PrintAttributes.Resolution("pz-360", "360 dpi",
                360, 360), true);
        b.setColorModes(PrintAttributes.COLOR_MODE_MONOCHROME,
                PrintAttributes.COLOR_MODE_COLOR);
        b.setMinMargins(PrintAttributes.Margins.NO_MARGINS);
        return b.build();
    }

    @Override
    protected void onPrintJobQueued(final PrintJob job) {
        // Todo lo que toca el objeto PrintJob ocurre AQUÍ, en el hilo principal.
        final PrintJobInfo info;
        final ParcelFileDescriptor fd;
        try {
            try {
                job.start();
            } catch (Throwable ignored) {
            }
            info = job.getInfo();
            fd = job.getDocument().getData();
        } catch (final Throwable t) {
            // No se pudo ni empezar: marcamos el trabajo como fallido (en el
            // hilo principal, para que el error sí se registre).
            principal.post(new Runnable() {
                @Override
                public void run() {
                    fallar(job, mensaje(t));
                }
            });
            return;
        }

        // Datos planos para el hilo del fondo: NINGUNA llamada a PrintJob.
        final boolean etiquetas = idE.equals(info.getPrinterId());
        final String nombre = nombre(info);
        final int copias = Math.max(1, info.getCopies());
        final PageRange[] paginas = info.getPages();
        final boolean color = prefs().getBoolean("docsColor", true);
        final AtomicBoolean cancelar = new AtomicBoolean(false);
        try {
            cancelados.put(job.getId(), cancelar);
        } catch (Throwable ignored) {
        }

        notificar("Trabajo recibido: " + nombre + " → "
                + (etiquetas ? "ETIQUETAS" : "DOCUMENTOS") + ". Enviando…");

        Thread hilo = new Thread(new Runnable() {
            @Override
            public void run() {
                Resultado r = null;
                Throwable fallo = null;
                try {
                    r = ejecutar(fd, etiquetas, copias, paginas, color, cancelar);
                } catch (Throwable t) {
                    fallo = t;
                } finally {
                    try {
                        fd.close();
                    } catch (Throwable ignored) {
                    }
                }
                final Resultado res = r;
                final Throwable error = fallo;
                // El cierre del trabajo SIEMPRE en el hilo principal.
                principal.post(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            cancelados.remove(job.getId());
                        } catch (Throwable ignored) {
                        }
                        if (error != null) {
                            fallar(job, mensaje(error));
                        } else if (res.cancelado) {
                            notificar("Trabajo cancelado.");
                        } else {
                            try {
                                job.complete();
                            } catch (Throwable ignored) {
                            }
                            notificar("Impreso en "
                                    + (etiquetas ? "ETIQUETAS (Zebra)" : "DOCUMENTOS (carta)")
                                    + ": " + res.paginas + " pág., " + res.bytes + " bytes, "
                                    + copias + " copia(s)"
                                    + (!etiquetas && res.dpi < 360
                                        ? " (a " + res.dpi + " dpi por memoria)" : "")
                                    + ". Revisa la impresora.");
                        }
                    }
                });
            }
        }, "pz-impresion");
        // Red de seguridad absoluta: si algo explota de verdad, el trabajo
        // queda en error con motivo y el proceso NO muere (en la 1.2.0 esto
        // mataba el servicio y Android decía "servicio no habilitado").
        hilo.setUncaughtExceptionHandler(new Thread.UncaughtExceptionHandler() {
            @Override
            public void uncaughtException(Thread t, final Throwable e) {
                principal.post(new Runnable() {
                    @Override
                    public void run() {
                        fallar(job, "Error interno: " + mensaje(e));
                    }
                });
            }
        });
        hilo.start();
    }

    @Override
    protected void onRequestCancelPrintJob(PrintJob job) {
        // Hilo principal: se puede llamar a cancel() y consultar el id.
        try {
            AtomicBoolean bandera = cancelados.get(job.getId());
            if (bandera != null) {
                bandera.set(true);
            }
        } catch (Throwable ignored) {
        }
        try {
            job.cancel();
        } catch (Throwable ignored) {
        }
        notificar("Trabajo cancelado.");
    }

    /** Resultado del envío (datos planos, sin tocar PrintJob). */
    private static final class Resultado {
        int paginas;
        long bytes;
        int dpi = 360;
        boolean cancelado;
    }

    /** Cuenta los bytes que pasan por él (para el aviso final). */
    private static final class Contador extends java.io.OutputStream {
        private final java.io.OutputStream base;
        long total;

        Contador(java.io.OutputStream base) {
            this.base = base;
        }

        @Override
        public void write(int b) throws java.io.IOException {
            base.write(b);
            total++;
        }

        @Override
        public void write(byte[] b, int off, int len) throws java.io.IOException {
            base.write(b, off, len);
            total += len;
        }

        @Override
        public void flush() throws java.io.IOException {
            base.flush();
        }
    }

    /**
     * Renderiza y envía el trabajo por red. Corre en el hilo del fondo y NO
     * toca ningún método de PrintJob (por eso no puede fallar con "Must be
     * called from the main thread").
     *
     * v1.3.2: el descriptor que entrega el spooler puede ser una TUBERÍA (no
     * seekable) y PdfRenderer exige un archivo real; por eso imprimir desde
     * otras apps fallaba con "file descriptor not seekable". El documento se
     * copia SIEMPRE a un archivo temporal y el renderer trabaja sobre él.
     */
    private Resultado ejecutar(ParcelFileDescriptor fd, boolean etiquetas, int copias,
                               PageRange[] paginas, boolean color,
                               AtomicBoolean cancelar) throws Exception {
        SharedPreferences prefs = prefs();
        String ip = prefs.getString("ip", "").trim();
        if (ip.isEmpty()) {
            throw new Exception("Falta la IP del SERVIDOR. Abre PuenteZebra Móvil, "
                    + "escríbela y pulsa Guardar (no se perdió al actualizar, se guardó "
                    + "en blanco).");
        }
        int puerto = prefs.getInt(etiquetas ? "portTags" : "portDocs",
                etiquetas ? 9100 : 9101);
        Resultado res = new Resultado();

        // 1) Copiar el documento a un archivo temporal. Es una lectura
        //    SECUENCIAL: funciona igual si el descriptor es una tubería.
        File carpeta = new File(getCacheDir(), "spool");
        if (!carpeta.exists()) {
            carpeta.mkdirs();
        }
        File temporal = File.createTempFile("doc_", ".pdf", carpeta);
        ParcelFileDescriptor fdArchivo = null;
        PdfRenderer renderer = null;
        try {
            InputStream in = new ParcelFileDescriptor.AutoCloseInputStream(fd);
            OutputStream out = new FileOutputStream(temporal);
            byte[] bufer = new byte[65536];
            int leidos;
            while ((leidos = in.read(bufer)) > 0) {
                out.write(bufer, 0, leidos);
            }
            out.flush();
            out.close();
            in.close(); // cierra también el fd original: la copia ya está hecha
            if (temporal.length() == 0) {
                throw new Exception("el documento llegó vacío (PDF de 0 bytes) desde "
                        + "la app que mandó imprimir");
            }

            // 2) Renderizar sobre el archivo temporal (SIEMPRE seekable).
            fdArchivo = ParcelFileDescriptor.open(temporal,
                    ParcelFileDescriptor.MODE_READ_ONLY);
            renderer = new PdfRenderer(fdArchivo);
            int totalPaginas = renderer.getPageCount();
            PrintEngine.Canal canal = PrintEngine.Canal.abrir(ip, puerto);
            try {
                synchronized (candado) {
                    if (etiquetas) {
                        // Zebra (ZPL): igual que siempre, página a página.
                        for (int copia = 0; copia < copias; copia++) {
                            for (int p = 0; p < totalPaginas; p++) {
                                if (cancelar.get()) {
                                    res.cancelado = true;
                                    return res;
                                }
                                if (!paginaSeleccionada(p, paginas, totalPaginas)) {
                                    continue;
                                }
                                int w = PrintEngine.mmADots(prefs.getInt("labelWmm", 102),
                                        PrintEngine.DPI_ETIQUETAS);
                                int h = PrintEngine.mmADots(prefs.getInt("labelHmm", 152),
                                        PrintEngine.DPI_ETIQUETAS);
                                byte[] datos = PrintEngine.zplDePagina(renderer, p, w, h);
                                canal.escribir(datos);
                                res.bytes += datos.length;
                                res.paginas++;
                            }
                        }
                    } else {
                        // v1.3.3 — DOCUMENTOS: sesión ESC/P-R, el idioma nativo
                        // del Epson L3250 (el PCL de la 1.3.2 era la causa de la
                        // basura «319w319w…» y de la lentitud). Se envía en
                        // FLUJO, línea a línea, sin montar todo en memoria.
                        Contador flujo = new Contador(canal.flujo());
                        flujo.write(EpsonEscpr.sesionInicio(color));
                        int ultima = -1;
                        for (int p = 0; p < totalPaginas; p++) {
                            if (paginaSeleccionada(p, paginas, totalPaginas)) {
                                ultima = p;
                            }
                        }
                        int impresas = 0;
                        for (int copia = 0; copia < copias; copia++) {
                            for (int p = 0; p < totalPaginas; p++) {
                                if (cancelar.get()) {
                                    res.cancelado = true;
                                    return res;
                                }
                                if (!paginaSeleccionada(p, paginas, totalPaginas)) {
                                    continue;
                                }
                                impresas++;
                                flujo.write(EpsonEscpr.inicioPagina(impresas));
                                int dpi = PrintEngine.imprimirPaginaEscpr(renderer, p, flujo);
                                if (dpi < res.dpi) {
                                    res.dpi = dpi;
                                }
                                boolean masPaginas = copia < copias - 1 || p < ultima;
                                flujo.write(EpsonEscpr.finPagina(masPaginas));
                                flujo.flush();
                                res.paginas++;
                            }
                        }
                        flujo.write(EpsonEscpr.finTrabajo());
                        flujo.flush();
                        res.bytes = flujo.total;
                    }
                }
            } finally {
                canal.cerrar();
            }
            if (res.paginas == 0) {
                throw new Exception("El trabajo no tiene páginas para imprimir.");
            }
            return res;
        } finally {
            try {
                if (renderer != null) {
                    renderer.close();
                }
            } catch (Throwable ignored) {
            }
            try {
                if (fdArchivo != null) {
                    fdArchivo.close();
                }
            } catch (Throwable ignored) {
            }
            temporal.delete();
        }
    }

    /** Marca el trabajo como fallido con motivo y avisa por notificación.
     * Debe llamarse SIEMPRE desde el hilo principal. */
    private void fallar(PrintJob job, String motivo) {
        try {
            job.fail("PuenteZebra: " + motivo);
        } catch (Throwable ignored) {
        }
        notificar("ERROR al imprimir: " + motivo
                + ". ¿SERVIDOR abierto, teléfono en la misma red Wi-Fi e IP correcta?");
    }

    static boolean paginaSeleccionada(int i, PageRange[] rangos, int totalPaginas) {
        if (rangos == null || rangos.length == 0) {
            return true;
        }
        for (PageRange r : rangos) {
            if (PageRange.ALL_PAGES.equals(r)) {
                return true;
            }
            int ini = Math.max(0, r.getStart());
            int fin = Math.min(r.getEnd(), totalPaginas - 1);
            if (fin >= ini && i >= ini && i <= fin) {
                return true;
            }
        }
        return false;
    }

    private void notificar(String texto) {
        if (nm == null) {
            return;
        }
        try {
            Notification.Builder b;
            if (Build.VERSION.SDK_INT >= 26) {
                b = new Notification.Builder(this, CANAL);
            } else {
                b = new Notification.Builder(this);
            }
            b.setSmallIcon(R.drawable.icon)
                    .setContentTitle("PuenteZebra Móvil")
                    .setContentText(texto)
                    .setStyle(new Notification.BigTextStyle().bigText(texto))
                    .setWhen(System.currentTimeMillis());
            int id = notifId++;
            nm.notify(id, b.build());
        } catch (Throwable ignored) {
        }
    }

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, 0);
    }

    private static String nombre(PrintJobInfo info) {
        String s = info.getLabel();
        return (s == null || s.trim().isEmpty()) ? "Documento" : s;
    }

    private static String mensaje(Throwable t) {
        if (t instanceof OutOfMemoryError) {
            return "el teléfono se quedó sin memoria para esa página "
                    + "(prueba con una imagen más pequeña)";
        }
        String m = t.getMessage();
        return (m == null || m.trim().isEmpty()) ? t.getClass().getSimpleName() : m;
    }
}
