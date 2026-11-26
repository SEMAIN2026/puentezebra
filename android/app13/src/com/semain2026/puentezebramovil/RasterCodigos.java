package com.semain2026.puentezebramovil;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Empaquetado de rasters de 1 bit (1 = negro) a ZPL (^GFA) y PCL de trama.
 * Java puro, sin clases de Android: se puede probar en un PC normal.
 */
final class RasterCodigos {

    private RasterCodigos() {
    }

    static int bytesPorFila(int anchoPx) {
        return (anchoPx + 7) / 8;
    }

    /** ZPL con ^GFA hex sin comprimir: ancho/alto en puntos, raster tal cual. */
    static byte[] zplDeRaster(byte[] raster, int anchoPx, int altoPx) {
        int bpf = bytesPorFila(anchoPx);
        int total = raster.length;
        StringBuilder sb = new StringBuilder(total * 2 + 128);
        sb.append("^XA\r\n^PW").append(anchoPx);
        sb.append("\r\n^LL").append(altoPx);
        sb.append("\r\n^LH0,0\r\n^FO0,0^GFA,");
        sb.append(total).append(',').append(total).append(',').append(bpf).append(',');
        char[] hex = "0123456789ABCDEF".toCharArray();
        for (byte b : raster) {
            int v = b & 255;
            sb.append(hex[v >>> 4]).append(hex[v & 15]);
        }
        sb.append("\r\n^PQ1\r\n^XZ\r\n");
        return sb.toString().getBytes(StandardCharsets.US_ASCII);
    }

    /** PCL de trama 1 bpp a la resolución indicada, hoja carta, vertical. */
    static byte[] pclDeRaster(byte[] raster, int anchoPx, int altoPx, int dpi) {
        int bpf = bytesPorFila(anchoPx);
        ByteArrayOutputStream out = new ByteArrayOutputStream(raster.length + 512);
        esc(out, "E");              // reset
        esc(out, "&l2A");           // papel carta
        esc(out, "&l0O");            // vertical
        esc(out, "&l0E");            // margen superior 0
        esc(out, "*t" + dpi + "R");  // resolución de trama
        esc(out, "*r1A");            // iniciar trama en la posición actual
        byte[] cabecera = ("*b" + bpf + "W").getBytes(StandardCharsets.US_ASCII);
        byte[] esc_b = new byte[cabecera.length + 1];
        esc_b[0] = 0x1b;
        System.arraycopy(cabecera, 0, esc_b, 1, cabecera.length);
        for (int y = 0; y < altoPx; y++) {
            out.write(esc_b, 0, esc_b.length);
            out.write(raster, y * bpf, bpf);
        }
        esc(out, "*rB");             // fin de trama
        out.write('\f');             // salto de página
        return out.toByteArray();
    }

    private static void esc(ByteArrayOutputStream out, String s) {
        out.write(0x1b);
        byte[] b = s.getBytes(StandardCharsets.US_ASCII);
        out.write(b, 0, b.length);
    }
}
