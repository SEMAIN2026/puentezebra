package com.semain2026.puentezebramovil;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.pdf.PdfRenderer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.Arrays;

/**
 * Conversión de páginas PDF a ZPL/PCL y envío por socket directo al SERVIDOR.
 */
public final class PrintEngine {

    public static final int DPI_ETIQUETAS = 203;
    public static final int DPI_DOC = 300;

    private PrintEngine() {
    }

    public static int mmADots(double mm, int dpi) {
        return Math.max(1, (int) Math.round((mm / 25.4d) * dpi));
    }

    /**
     * Renderiza la página PDF centrada y en fondo blanco sobre un lienzo de
     * anchoDots × altoDots (tamaño final de la impresión).
     */
    public static Bitmap renderPagina(PdfRenderer.Page page, int anchoDots, int altoDots)
            throws IOException {
        double pw = page.getWidth();
        double ph = page.getHeight();
        double escala = Math.min(anchoDots / pw, altoDots / ph);
        int bw = Math.max(1, (int) Math.round(pw * escala));
        int bh = Math.max(1, (int) Math.round(ph * escala));
        Bitmap pagina = Bitmap.createBitmap(bw, bh, Bitmap.Config.ARGB_8888);
        pagina.eraseColor(-1);
        page.render(pagina, null, null, PdfRenderer.Page.RENDER_MODE_FOR_PRINT);
        Bitmap lienzo = Bitmap.createBitmap(anchoDots, altoDots, Bitmap.Config.ARGB_8888);
        lienzo.eraseColor(-1);
        new Canvas(lienzo).drawBitmap(pagina, (anchoDots - bw) / 2.0f, (altoDots - bh) / 2.0f,
                (Paint) null);
        pagina.recycle();
        return lienzo;
    }

    /**
     * Tramado Floyd-Steinberg a 1 bit. bit 1 = NEGRO (así lo exigen ZPL ^GF y
     * la trama PCL). En la 1.2.0 estaba invertido (lo claro quedaba en negro).
     */
    public static byte[] difuminar(Bitmap bmp) {
        int w = bmp.getWidth();
        int h = bmp.getHeight();
        int bpf = RasterCodigos.bytesPorFila(w);
        byte[] raster = new byte[bpf * h];
        int[] fila = new int[w];
        float[] err = new float[w];        // error que se arrastra a la derecha
        float[] errSiguiente = new float[w]; // error que cae a la fila de abajo
        for (int y = 0; y < h; y++) {
            bmp.getPixels(fila, 0, w, 0, y, w, 1);
            for (int x = 0; x < w; x++) {
                int c = fila[x];
                float lum = ((c >> 16) & 255) * 0.299f + ((c >> 8) & 255) * 0.587f
                        + (c & 255) * 0.114f + err[x];
                boolean negro = lum < 128.0f;
                if (negro) {
                    raster[y * bpf + (x >> 3)] |= (byte) (0x80 >> (x & 7));
                }
                float e = lum - (negro ? 0.0f : 255.0f);
                if (x + 1 < w) {
                    err[x + 1] += 0.4375f * e;
                }
                if (y + 1 < h) {
                    if (x > 0) {
                        errSiguiente[x - 1] += 0.1875f * e;
                    }
                    errSiguiente[x] += 0.3125f * e;
                    if (x + 1 < w) {
                        errSiguiente[x + 1] += 0.0625f * e;
                    }
                }
            }
            Arrays.fill(err, 0.0f);
            float[] t = err;
            err = errSiguiente;
            errSiguiente = t;
        }
        return raster;
    }

    /** ZPL de una página del PDF, al tamaño de etiqueta dado en puntos. */
    public static byte[] zplDePagina(PdfRenderer renderer, int numPagina, int anchoDots, int altoDots)
            throws IOException {
        PdfRenderer.Page page = renderer.openPage(numPagina);
        try {
            Bitmap bmp = renderPagina(page, anchoDots, altoDots);
            byte[] raster = difuminar(bmp);
            bmp.recycle();
            return RasterCodigos.zplDeRaster(raster, anchoDots, altoDots);
        } finally {
            page.close();
        }
    }

    /** PCL de trama de una página del PDF a la resolución indicada (hoja carta). */
    public static byte[] pclDePagina(PdfRenderer renderer, int numPagina, int dpi)
            throws IOException {
        PdfRenderer.Page page = renderer.openPage(numPagina);
        try {
            int w = Math.max(1, (int) Math.round(8.5 * dpi));
            int h = Math.max(1, (int) Math.round(11.0 * dpi));
            Bitmap bmp = renderPagina(page, w, h);
            byte[] raster = difuminar(bmp);
            bmp.recycle();
            return RasterCodigos.pclDeRaster(raster, w, h, dpi);
        } finally {
            page.close();
        }
    }

    /** Envío directo de bytes a host:puerto (SERVIDOR → impresora). */
    public static void enviar(String host, int puerto, byte[] datos) throws IOException {
        Socket socket = new Socket();
        try {
            socket.connect(new InetSocketAddress(host, puerto), 8000);
            socket.setSoTimeout(30000);
            OutputStream os = socket.getOutputStream();
            os.write(datos);
            os.flush();
            try {
                socket.shutdownOutput();
            } catch (IOException ignored) {
            }
        } finally {
            try {
                socket.close();
            } catch (IOException ignored) {
            }
        }
    }

    /**
     * v1.3.3 — Imprime una página del PDF en la impresora Epson de documentos
     * con ESC/P-R en FLUJO (línea a línea, sin montar el megabyte entero):
     * renderiza a 360 dpi sobre el área imprimible carta, convierte cada fila
     * a niveles de gris (0 = negro, 255 = blanco: el L3250 hace el tramado)
     * y omite las filas totalmente blancas (la y de «dsnd» es absoluta).
     *
     * @return los dpi usados de verdad (360; 180 si hubo que rebajar por memoria)
     */
    public static int imprimirPaginaEscpr(PdfRenderer renderer, int numPagina,
                                          OutputStream salida) throws IOException {
        final int ancho = EpsonEscpr.ANCHO_IMPRIMIBLE;
        final int alto = EpsonEscpr.ALTO_IMPRIMIBLE;
        PdfRenderer.Page page = renderer.openPage(numPagina);
        Bitmap bmp;
        boolean mitad = false;
        try {
            try {
                bmp = renderPagina(page, ancho, alto);
            } catch (OutOfMemoryError oom) {
                System.gc();
                mitad = true;
                bmp = renderPagina(page, ancho / 2, alto / 2);
            }
        } finally {
            page.close();
        }
        try {
            if (mitad) {
                // 180 dpi ampliada ×2: cada fila sale dos veces y cada píxel dos veces
                int wm = bmp.getWidth();
                int hm = bmp.getHeight();
                int[] fila = new int[wm];
                byte[] grises = new byte[ancho];
                for (int y = 0; y < hm; y++) {
                    bmp.getPixels(fila, 0, wm, 0, y, wm, 1);
                    for (int x = 0; x < wm; x++) {
                        int c = fila[x];
                        int gris = (((c >> 16) & 255) * 77 + ((c >> 8) & 255) * 150
                                + (c & 255) * 29) >> 8;
                        grises[x * 2] = (byte) gris;
                        grises[x * 2 + 1] = (byte) gris;
                    }
                    EpsonEscpr.escribirLinea(salida, y * 2, grises);
                    EpsonEscpr.escribirLinea(salida, y * 2 + 1, grises);
                }
                return 180;
            }
            int w = bmp.getWidth();
            int h = bmp.getHeight();
            int[] fila = new int[w];
            byte[] grises = new byte[w];
            for (int y = 0; y < h; y++) {
                bmp.getPixels(fila, 0, w, 0, y, w, 1);
                boolean blanca = true;
                for (int x = 0; x < w; x++) {
                    int c = fila[x];
                    int gris = (((c >> 16) & 255) * 77 + ((c >> 8) & 255) * 150
                            + (c & 255) * 29) >> 8;
                    grises[x] = (byte) gris;
                    if (gris != 255) {
                        blanca = false;
                    }
                }
                if (!blanca) {
                    EpsonEscpr.escribirLinea(salida, y, grises);
                }
            }
            return 360;
        } finally {
            bmp.recycle();
        }
    }

    /**
     * Canal abierto al SERVIDOR para escribir página por página sin acumular
     * todo el trabajo en memoria.
     */
    public static final class Canal {
        private final Socket socket;

        private Canal(Socket socket) {
            this.socket = socket;
        }

        public static Canal abrir(String host, int puerto) throws IOException {
            Socket s = new Socket();
            s.connect(new InetSocketAddress(host, puerto), 8000);
            s.setSoTimeout(60000);
            s.setTcpNoDelay(true);
            return new Canal(s);
        }

        public void escribir(byte[] datos) throws IOException {
            OutputStream os = socket.getOutputStream();
            os.write(datos);
            os.flush();
        }

        /** Flujo bruto del socket (con búfer), para el modo ESC/P-R en flujo. */
        public OutputStream flujo() throws IOException {
            return new java.io.BufferedOutputStream(socket.getOutputStream(), 1 << 16);
        }

        public void cerrar() {
            try {
                socket.shutdownOutput();
            } catch (IOException ignored) {
            }
            try {
                socket.close();
            } catch (IOException ignored) {
            }
        }
    }
}
