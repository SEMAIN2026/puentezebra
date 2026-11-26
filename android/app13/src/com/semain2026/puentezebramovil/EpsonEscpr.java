package com.semain2026.puentezebramovil;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;

/**
 * Generador del lenguaje ESC/P-R de Epson (impresoras de tinta L series, XP,
 * WF…), extraído byte a byte del driver oficial de Epson para Linux
 * (epson-inkjet-printer-escpr, lib/epson-escpr-api.c).
 *
 * Sustituye al PCL de la 1.3.2: el Epson L3250 NO entiende PCL y por eso
 * imprimía basura («319w319w…» es la cabecera «*b319W» del PCL repetida por
 * cada una de las ~3300 líneas de la página).
 *
 * Estructura de una sesión (todo lo que el L3250 espera recibir):
 *   1) salida del modo paquete (@EJL) + reset (ESC @)
 *   2) modo REMOTO1: JS/JH/HD/PP (arranque de trabajo, origen de papel)
 *   3) modo ESC/P-R: setq (calidad/color) + chku + setj (hoja carta 360 dpi)
 *   4) por página: sttp + setn(núm. página)
 *   5) por línea de trama: dsnd (x, y, compresión RLE, tamaño) + datos RGB
 *      (las líneas totalmente blancas NO se envían: la y es absoluta)
 *   6) fin de página: endp (0 = última página, 1 = hay otra)
 *   7) fin de trabajo: endj + reset + JE (remoto) + salida de remoto
 *
 * Java puro: se puede probar en un PC normal (main de depuración).
 */
final class EpsonEscpr {

    private EpsonEscpr() {
    }

    // ------------------------- geometría hoja carta a 360 dpi ----------------
    /** 8,5" × 360 dpi. */
    static final int ANCHO_PAPEL = 3060;
    /** 11" × 360 dpi. */
    static final int ALTO_PAPEL = 3960;
    /** Margen 3 mm = 42 puntos a 360 dpi (tabla oficial, carta). */
    static final int MARGEN = 42;
    /** 3060 − 84. */
    static final int ANCHO_IMPRIMIBLE = 2976;
    /** 3960 − 84. */
    static final int ALTO_IMPRIMIBLE = 3876;

    /** Calidad: 0 = borrador, 1 = normal, 2 = alta. */
    private static final int CALIDAD_NORMAL = 1;
    /** Modo de color para setq: 0 = color, 1 = monocromo. */
    static final int MODO_COLOR = 0;
    static final int MODO_MONO = 1;

    // ------------------------------- comandos crudos (Epson) ----------------
    private static final byte[] SALIR_MODO_PAQUETE = hex(
            "0000001b0140454a4c20313238342e340a40454a4c20202020200a");
    private static final byte[] RESET = hex("1b40");
    private static final byte[] ENTRAR_REMOTO = hex("1b285208000052454d4f544531");
    private static final byte[] REMOTO_JS = hex("4a53040000000000");
    private static final byte[] REMOTO_JH = hex("4a480e0000000000000045534350524c6962");
    private static final byte[] REMOTO_HD = hex("48440300000304");
    private static final byte[] REMOTO_PP = hex("505003000001ff");
    private static final byte[] SALIR_REMOTO = hex("1b000000");
    private static final byte[] MODO_ESCPR = hex("1b28520600004553435052");
    private static final byte[] CHEQUEO = hex("1b750200000063686b750101");
    private static final byte[] INICIO_PAGINA = hex("1b700000000073747470");
    private static final byte[] FIN_PAGINA = hex("1b7001000000656e647000");
    private static final byte[] FIN_TRABAJO = hex("1b6a00000000656e646a");
    private static final byte[] REMOTO_JE = hex("4a45010000");
    private static final byte[] NOMBRE_DATOS = hex("64736e64");

    /**
     * Cabecera de la sesión: todo el bloque inicial + setq + chku + setj.
     * Se envía UNA VEZ por trabajo, antes de la primera página.
     *
     * @param color true = impresión a color; false = solo tinta negra
     */
    static byte[] sesionInicio(boolean color) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(512);
        out.write(SALIR_MODO_PAQUETE);
        out.write(RESET);
        out.write(ENTRAR_REMOTO);
        out.write(REMOTO_JS);
        out.write(REMOTO_JH);
        out.write(REMOTO_HD); // plataforma 0x04 (linux) — el original manda 0xFF
        out.write(REMOTO_PP); // origen del papel: automático
        out.write(SALIR_REMOTO);
        out.write(MODO_ESCPR);
        out.write(setq(color));
        out.write(CHEQUEO);
        out.write(setj());
        return out.toByteArray();
    }

    /** setq: calidad normal, color o mono, plano RGB completo, sin paleta. */
    private static byte[] setq(boolean color) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(24);
        out.write(hex("1b71"));                 // ESC q
        out.write(le32(9));                       // longitud de parámetros
        out.write(hex("73657471"));              // "setq"
        out.write(0);                            // tipo de papel: 0 = normal
        out.write(CALIDAD_NORMAL);               // 1 = normal
        out.write(color ? MODO_COLOR : MODO_MONO);
        out.write(0);                            // brillo
        out.write(0);                            // contraste
        out.write(0);                            // saturación
        out.write(0);                            // plano de color: 0 = RGB
        out.write(be16(0));                      // tamaño de paleta: ninguna
        return out.toByteArray();
    }

    /** setj: hoja carta, 360 dpi, márgenes 3 mm, impresión bidireccional. */
    private static byte[] setj() throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(40);
        out.write(hex("1b6a"));                 // ESC j
        out.write(le32(22));                      // 22 bytes de parámetros
        out.write(hex("7365746a"));              // "setj"
        out.write(be32(ANCHO_PAPEL));
        out.write(be32(ALTO_PAPEL));
        out.write(be16(MARGEN));                  // margen superior
        out.write(be16(MARGEN));                  // margen izquierdo
        out.write(be32(ANCHO_IMPRIMIBLE));
        out.write(be32(ALTO_IMPRIMIBLE));
        out.write(0);                            // resolución de entrada: 360 dpi
        out.write(0);                            // dirección: bidireccional
        return out.toByteArray();
    }

    /** sttp + setn(núm.): abre la página número {@code numero} (desde 1). */
    static byte[] inicioPagina(int numero) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(32);
        out.write(INICIO_PAGINA);
        out.write(hex("1b70"));                  // ESC p
        out.write(le32(1));
        out.write(hex("7365746e"));              // "setn"
        out.write(numero & 0xFF);
        return out.toByteArray();
    }

    /** endp: 0 = no hay más páginas, 1 = viene otra. */
    static byte[] finPagina(boolean masPaginas) throws IOException {
        byte[] cmd = FIN_PAGINA.clone();
        cmd[cmd.length - 1] = (byte) (masPaginas ? 1 : 0);
        return cmd;
    }

    /** endj + reset + JE en remoto + salir de remoto: cierra el trabajo. */
    static byte[] finTrabajo() throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(64);
        out.write(FIN_TRABAJO);
        out.write(RESET);
        out.write(ENTRAR_REMOTO);
        out.write(REMOTO_JE);
        out.write(SALIR_REMOTO);
        return out.toByteArray();
    }

    /**
     * Una línea de trama RGB (r=g=b=nivel de gris, 0 = negro, 255 = blanco) a
     * 360 dpi, comprimida con el RLE de ESC/P-R, tal como la manda el driver:
     *
     *   ESC d &lt;longitud 4B LE = 7+n&gt; "dsnd" x(2B BE) y(2B BE)
     *   compresión(1B: 1 = RLE) tamaño(2B BE) datos(n)
     *
     * @param y       fila absoluta dentro del área imprimible (0 = primera)
     * @param grises  un byte de gris POR PÍXEL (0..255), ancho imprimible
     */
    static void escribirLinea(OutputStream salida, int y, byte[] grises)
            throws IOException {
        final int bpp = 3;
        final int pixeles = grises.length;
        byte[] rle = rle(grises);
        final boolean comprimido = rle != null;
        final byte[] datos = comprimido ? rle : plano(grises);
        final int n = datos.length;

        ByteArrayOutputStream out = new ByteArrayOutputStream(24 + n);
        out.write(0x1B);
        out.write('d');
        out.write(le32(7 + n));
        out.write(NOMBRE_DATOS);
        out.write(be16(0));                       // desplazamiento x
        out.write(be16(y));                       // fila absoluta
        out.write(comprimido ? 1 : 0);            // 1 = RLE
        out.write(be16(n));                       // tamaño de la trama
        out.write(datos);
        byte[] cmd = out.toByteArray();
        salida.write(cmd, 0, cmd.length);
    }

    /**
     * RLE de ESC/P-R sobre grupos de 3 bytes (r,g,b) idénticos:
     * racha → [0xFF − repeticiones + 2] + 3 bytes de dato;
     * literal → [repeticiones − 1] + bytes sueltos.
     * Devuelve null si la racha comprimida no ahorra (se manda sin comprimir).
     */
    private static byte[] rle(byte[] grises) {
        final int bpp = 3;
        final int pixeles = grises.length;
        ByteArrayOutputStream out = new ByteArrayOutputStream(pixeles * 3 / 2 + 16);
        int srcCnt = 0;
        int emitidos = 0;
        while (srcCnt < pixeles) {
            int a = grises[srcCnt] & 0xFF;
            if (srcCnt + 1 < pixeles && (grises[srcCnt + 1] & 0xFF) == a) {
                int repCnt = 2;
                while (srcCnt + repCnt < pixeles && repCnt < 0x81
                        && (grises[srcCnt + repCnt] & 0xFF) == a) {
                    repCnt++;
                }
                emitidos += 1 + bpp;
                if (emitidos > pixeles * 3) {
                    return null;
                }
                out.write(0xFF - repCnt + 2);
                out.write(a); out.write(a); out.write(a);
                srcCnt += repCnt;
            } else {
                int repCnt = 1;
                while (srcCnt + repCnt + 1 < pixeles && repCnt < 0x80
                        && (grises[srcCnt + repCnt] & 0xFF)
                                != (grises[srcCnt + repCnt + 1] & 0xFF)) {
                    repCnt++;
                }
                emitidos += 1 + repCnt * bpp;
                if (emitidos > pixeles * 3) {
                    return null;
                }
                out.write(repCnt - 1);
                for (int i = 0; i < repCnt; i++) {
                    int v = grises[srcCnt + i] & 0xFF;
                    out.write(v); out.write(v); out.write(v);
                }
                srcCnt += repCnt;
            }
        }
        return out.toByteArray();
    }

    /** La misma línea sin comprimir: 3 bytes por píxel. */
    private static byte[] plano(byte[] grises) {
        byte[] datos = new byte[grises.length * 3];
        for (int i = 0, j = 0; i < grises.length; i++) {
            int v = grises[i] & 0xFF;
            datos[j++] = (byte) v;
            datos[j++] = (byte) v;
            datos[j++] = (byte) v;
        }
        return datos;
    }

    // ------------------------------- utilidades ------------------------------
    private static byte[] hex(String s) {
        int n = s.length() / 2;
        byte[] b = new byte[n];
        for (int i = 0; i < n; i++) {
            b[i] = (byte) Integer.parseInt(s.substring(i * 2, i * 2 + 2), 16);
        }
        return b;
    }

    private static byte[] le32(int v) {
        return new byte[]{(byte) v, (byte) (v >> 8), (byte) (v >> 16), (byte) (v >> 24)};
    }

    private static byte[] be16(int v) {
        return new byte[]{(byte) (v >> 8), (byte) v};
    }

    private static byte[] be32(int v) {
        return new byte[]{(byte) (v >> 24), (byte) (v >> 16), (byte) (v >> 8), (byte) v};
    }

    /** Depuración en PC: vuelca la sesión de ejemplo. */
    public static void main(String[] args) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(sesionInicio(false));
        out.write(inicioPagina(1));
        byte[] linea = new byte[ANCHO_IMPRIMIBLE];
        java.util.Arrays.fill(linea, 0, 10, (byte) 0);        // 10 px negros
        java.util.Arrays.fill(linea, 10, ANCHO_IMPRIMIBLE, (byte) 0xFF); // resto blanco
        escribirLinea(out, 0, linea);
        out.write(finPagina(true));
        out.write(finPagina(false));
        out.write(finTrabajo());
        byte[] todo = out.toByteArray();
        System.out.println(hexDump(todo));
    }

    private static String hexDump(byte[] b) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < b.length; i++) {
            if (i % 32 == 0) {
                sb.append(String.format("%04x  ", i));
            }
            sb.append(String.format("%02x ", b[i]));
            if (i % 32 == 31 || i == b.length - 1) {
                sb.append('\n');
            }
        }
        return sb.toString();
    }
}
