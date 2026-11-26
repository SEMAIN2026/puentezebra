package com.semain2026.puentezebramovil;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.ProgressDialog;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.SpinnerAdapter;
import android.widget.TextView;
import android.widget.Toast;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import org.json.JSONObject;

public class MainActivity extends Activity {

    private static final int REQ_FILE = 41;
    private static final int REQ_PREVISTA = 42;
    private static final String SITE_URL = "https://puentezebra-semain2026s-projects.vercel.app";
    private static final String UPDATE_URL =
            "https://puentezebra-semain2026s-projects.vercel.app/api/versions/apk/latest";

    private EditText etIP;
    private EditText etLblH;
    private EditText etLblW;
    private EditText etPortDocs;
    private EditText etPortTags;
    private EditText etText;
    private Spinner spDest;
    private TextView tvStatus;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildUI();
        manejarTextoCompartido(getIntent());
        if (Build.VERSION.SDK_INT >= 33) {
            requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 7);
        }
        revisarActualizaciones(false);
    }

    private void buildUI() {
        SharedPreferences prefs = prefs();
        ScrollView scroll = new ScrollView(this);
        LinearLayout vbox = vbox();
        int dp = dp(16);
        vbox.setPadding(dp, dp, dp, dp);
        scroll.addView(vbox);
        setContentView(scroll);

        TextView titulo = new TextView(this);
        titulo.setText("PuenteZebra Móvil " + VersionInfo.VERSION_NAME);
        titulo.setTextSize(20.0f);
        titulo.setTypeface(Typeface.DEFAULT_BOLD);
        vbox.addView(titulo);

        TextView intro = new TextView(this);
        intro.setText("Imprime en las dos impresoras del SERVIDOR (etiquetas Zebra y hoja carta) "
                + "desde tu teléfono, con el mismo Wi-Fi de la oficina.");
        intro.setTextSize(13.0f);
        intro.setPadding(0, dp(2), 0, dp(12));
        vbox.addView(intro);

        vbox.addView(label("IP del SERVIDOR (la que muestra su ventana, ej. 192.168.1.50):"));
        etIP = editText(prefs.getString("ip", ""), false);
        vbox.addView(etIP);

        LinearLayout row = row();
        LinearLayout colA = vbox();
        colA.addView(label("Puerto etiquetas"));
        etPortTags = editText(String.valueOf(prefs.getInt("portTags", 9100)), true);
        colA.addView(etPortTags);
        LinearLayout colB = vbox();
        colB.addView(label("Puerto documentos"));
        etPortDocs = editText(String.valueOf(prefs.getInt("portDocs", 9101)), true);
        colB.addView(etPortDocs);
        row.addView(colA, lpWeights());
        row.addView(colB, lpWeights());
        vbox.addView(row);

        LinearLayout filaGuardar = row();
        filaGuardar.addView(btn("Guardar", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                guardar();
            }
        }), lpWeights());
        filaGuardar.addView(btn("Probar conexión", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                probarConexion();
            }
        }), lpWeights());
        vbox.addView(filaGuardar);

        vbox.addView(label("IMPRIMIR DESDE OTRAS APPS (impresora virtual)"));
        TextView ayuda = new TextView(this);
        ayuda.setText("PuenteZebra aparece como impresora del teléfono:\n"
                + "1) Pulsa \"Activar\" y enciende \"PuenteZebra Móvil\" en Ajustes → Impresión.\n"
                + "2) En Fotos, el escáner, un PDF, WhatsApp… → menú → Imprimir.\n"
                + "3) Elige \"PuenteZebra ETIQUETAS\" o \"PuenteZebra DOCUMENTOS\": verás la vista "
                + "previa, el número de páginas y las copias antes de imprimir.\n"
                + "Si un trabajo falla, el MOTIVO exacto aparece en la notificación y en "
                + "Ajustes → Impresión.");
        ayuda.setTextSize(12.0f);
        ayuda.setPadding(0, dp(2), 0, dp(4));
        vbox.addView(ayuda);

        LinearLayout filaVirt = row();
        filaVirt.addView(btn("Activar servicio de impresión", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                abrirAjustesDeImpresion();
            }
        }), lpWeights());
        filaVirt.addView(btn("Imprimir foto o PDF (vista previa)", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                elegirParaVistaPrevia();
            }
        }), lpWeights());
        vbox.addView(filaVirt);

        vbox.addView(label("¿A dónde va a imprimir?"));
        spDest = new Spinner(this);
        ArrayAdapter<String> adaptador = new ArrayAdapter<String>(this,
                android.R.layout.simple_spinner_item,
                new String[]{"ETIQUETAS — Zebra ZD220 (texto → etiqueta)",
                        "DOCUMENTOS — hoja carta (texto → hoja)"});
        adaptador.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spDest.setAdapter((SpinnerAdapter) adaptador);
        spDest.setSelection(prefs.getInt("dest", 0));
        vbox.addView(spDest);

        vbox.addView(label("Tamaño de etiqueta (mm) — para la impresora virtual:"));
        LinearLayout filaTam = row();
        LinearLayout colW = vbox();
        colW.addView(label("Ancho"));
        etLblW = editText(String.valueOf(prefs.getInt("labelWmm", 102)), true);
        colW.addView(etLblW);
        LinearLayout colH = vbox();
        colH.addView(label("Alto"));
        etLblH = editText(String.valueOf(prefs.getInt("labelHmm", 152)), true);
        colH.addView(etLblH);
        filaTam.addView(colW, lpWeights());
        filaTam.addView(colH, lpWeights());
        vbox.addView(filaTam);

        TextView notaTam = new TextView(this);
        notaTam.setText("Normal: 102×152 (etiqueta 4×6\" o 100×150). Otras comunes: 100×100, "
                + "51×89 (2×3,5\").");
        notaTam.setTextSize(12.0f);
        notaTam.setPadding(0, dp(4), 0, dp(2));
        vbox.addView(notaTam);

        vbox.addView(label("Texto a imprimir:"));
        etText = new EditText(this);
        etText.setHint("Escribe aquí lo que quieres imprimir…");
        etText.setSingleLine(false);
        etText.setRawInputType(131073);
        etText.setMinLines(6);
        etText.setGravity(48);
        etText.setTextSize(14.0f);
        vbox.addView(etText, new LinearLayout.LayoutParams(-1, -2));

        LinearLayout filaTexto = row();
        filaTexto.addView(btn("Imprimir texto", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                imprimirTexto();
            }
        }), lpWeights());
        filaTexto.addView(btn("Enviar archivo…", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                enviarArchivo();
            }
        }), lpWeights());
        vbox.addView(filaTexto);

        LinearLayout filaPrueba = row();
        filaPrueba.addView(btn("Etiqueta de prueba", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                etiquetaPrueba();
            }
        }), lpWeights());
        filaPrueba.addView(btn("Página de prueba", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                paginaPrueba();
            }
        }), lpWeights());
        vbox.addView(filaPrueba);

        TextView nota = new TextView(this);
        nota.setText("El SERVIDOR debe estar abierto en la PC de las impresoras. Con la IMPRESORA "
                + "VIRTUAL las fotos y PDF salen como imagen real en ambas impresoras. El cuadro de "
                + "texto de abajo imprime en texto simple, como en la versión de PC.");
        nota.setTextSize(12.0f);
        nota.setPadding(0, dp(10), 0, dp(4));
        vbox.addView(nota);

        tvStatus = new TextView(this);
        tvStatus.setText("Listo.");
        tvStatus.setTextSize(13.0f);
        tvStatus.setTypeface(Typeface.MONOSPACE);
        tvStatus.setPadding(0, dp(6), 0, 0);
        vbox.addView(tvStatus);

        vbox.addView(label("App — versión " + VersionInfo.VERSION_NAME
                + " (código de versión " + VersionInfo.VERSION_CODE + ")"));
        LinearLayout filaApp = row();
        filaApp.addView(btn("Buscar actualizaciones", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                status("Revisando en " + SITE_URL.replace("https://", "") + " …");
                revisarActualizaciones(true);
            }
        }), lpWeights());
        filaApp.addView(btn("Página de descargas", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                abrirPaginaDescargas();
            }
        }), lpWeights());
        vbox.addView(filaApp);

        TextView notaApp = new TextView(this);
        notaApp.setText("La app revisa sola si hay versión nueva al abrirla. Si descargas e "
                + "instalas un APK más nuevo (desde la propia app o desde la página), Android lo "
                + "ACTUALIZA ENCIMA del que ya tienes: no se borra nada y la configuración (IP y "
                + "puertos) se conserva.");
        notaApp.setTextSize(12.0f);
        notaApp.setPadding(0, dp(6), 0, dp(4));
        vbox.addView(notaApp);
    }

    private void abrirPaginaDescargas() {
        try {
            Intent i = new Intent("android.intent.action.VIEW", Uri.parse(SITE_URL));
            i.addFlags(268435456);
            startActivity(i);
        } catch (Exception e) {
            toast("No se pudo abrir el navegador: " + shortMsg(e));
        }
    }

    private void manejarTextoCompartido(Intent intent) {
        if (intent == null || !"android.intent.action.SEND".equals(intent.getAction())) {
            return;
        }
        String texto = intent.getStringExtra("android.intent.extra.TEXT");
        if (texto == null || texto.trim().isEmpty()) {
            return;
        }
        etText.setText(texto);
        toast("Texto recibido. Elige a dónde imprimirlo y pulsa \"Imprimir texto\".");
    }

    private void revisarActualizaciones(final boolean manual) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection con = null;
                try {
                    con = (HttpURLConnection) new URL(UPDATE_URL).openConnection();
                    con.setConnectTimeout(8000);
                    con.setReadTimeout(8000);
                    con.addRequestProperty("User-Agent",
                            "PuenteZebraMovil/" + VersionInfo.VERSION_NAME);
                    int codigo = con.getResponseCode();
                    if (codigo != 200) {
                        if (manual) {
                            postStatus("La página contestó HTTP " + codigo + ". Prueba más tarde.");
                        }
                        con.disconnect();
                        return;
                    }
                    InputStream in = con.getInputStream();
                    ByteArrayOutputStream baos = new ByteArrayOutputStream();
                    byte[] buf = new byte[2048];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        baos.write(buf, 0, n);
                    }
                    in.close();
                    con.disconnect();
                    JSONObject latest = new JSONObject(new String(baos.toByteArray(), "UTF-8"))
                            .optJSONObject("latest");
                    if (latest == null) {
                        if (manual) {
                            postStatus("Aún no hay APK publicado en la página.");
                        }
                        return;
                    }
                    final int codigoNueva = latest.optInt("versionCode",
                            latest.optInt("version_code", 0));
                    final String version = latest.optString("version", "?");
                    final String url = latest.optString("url", latest.optString("apk_url", ""));
                    final String cambios = latest.optString("changelog", "");
                    if (codigoNueva > VersionInfo.VERSION_CODE) {
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                ofrecerActualizacion(version, url, cambios);
                            }
                        });
                    } else if (manual) {
                        postStatus("Ya tienes la última versión (" + VersionInfo.VERSION_NAME
                                + ").");
                    }
                } catch (final Exception e) {
                    if (manual) {
                        postStatus("No se pudo revisar: " + shortMsg(e)
                                + ". ¿Hay internet en el teléfono?");
                    }
                    if (con != null) {
                        con.disconnect();
                    }
                }
            }
        }, "pz-actualizar").start();
    }

    private void ofrecerActualizacion(String version, final String url, String cambios) {
        StringBuilder sb = new StringBuilder();
        sb.append("Hay una nueva versión: ").append(version)
                .append("  (tienes la ").append(VersionInfo.VERSION_NAME).append(").");
        if (cambios != null && !cambios.trim().isEmpty()) {
            sb.append("\n\n").append(cambios.trim());
        }
        sb.append("\n\nSe descarga y Android la instala ENCIMA de la que tienes: no se pierde "
                + "nada.");
        new AlertDialog.Builder(this)
                .setTitle("Actualización disponible")
                .setMessage(sb.toString())
                .setPositiveButton("Descargar e instalar", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface dialog, int which) {
                        descargarEInstalar(url);
                    }
                })
                .setNegativeButton("Ahora no", (DialogInterface.OnClickListener) null)
                .show();
    }

    private void descargarEInstalar(final String url) {
        final ProgressDialog progreso = new ProgressDialog(this);
        progreso.setTitle("Descargando actualización");
        progreso.setMessage("Conectando con la página…");
        progreso.setProgressStyle(1);
        progreso.setCancelable(true);
        progreso.show();
        new Thread(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection con = null;
                try {
                    con = (HttpURLConnection) new URL(url).openConnection();
                    con.setConnectTimeout(10000);
                    con.setReadTimeout(30000);
                    final int codigo = con.getResponseCode();
                    if (codigo != 200) {
                        throw new Exception("HTTP " + codigo);
                    }
                    int total = con.getContentLength();
                    File carpeta = new File(getExternalFilesDir(null), "updates");
                    if (!carpeta.exists() && !carpeta.mkdirs()) {
                        throw new Exception("no se pudo crear la carpeta de descargas");
                    }
                    File destino = new File(carpeta, ApkProvider.NAME);
                    InputStream in = con.getInputStream();
                    FileOutputStream out = new FileOutputStream(destino);
                    byte[] buf = new byte[16384];
                    int leidos = 0;
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n);
                        leidos += n;
                        if (total > 0) {
                            progreso.setMax(total);
                            progreso.setProgress(leidos);
                        }
                    }
                    out.flush();
                    out.close();
                    in.close();
                    con.disconnect();
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            progreso.dismiss();
                            abrirInstalador(url);
                        }
                    });
                } catch (final Exception e) {
                    if (con != null) {
                        con.disconnect();
                    }
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            progreso.dismiss();
                            descargarEnNavegador(url, "No se pudo descargar directa ("
                                    + shortMsg(e) + "). Se abre el navegador para descargarla.");
                        }
                    });
                }
            }
        }, "pz-descarga").start();
    }

    private void abrirInstalador(String url) {
        Uri uri = Uri.parse("content://" + ApkProvider.AUTHORITY + "/" + ApkProvider.NAME);
        Intent i = new Intent("android.intent.action.VIEW");
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(268435457);
        try {
            startActivity(i);
            toast("Pulsa \"Instalar\" en el instalador de Android para actualizar.");
        } catch (Exception e) {
            descargarEnNavegador(url, "El instalador no se pudo abrir (" + shortMsg(e)
                    + "). Descarga el APK desde la página.");
        }
    }

    private void descargarEnNavegador(String url, String aviso) {
        try {
            Intent i = new Intent("android.intent.action.VIEW", Uri.parse(url));
            i.addFlags(268435456);
            startActivity(i);
            toast(aviso);
        } catch (Exception unused) {
            new AlertDialog.Builder(this)
                    .setTitle("Actualización manual")
                    .setMessage(aviso + "\n\nAbre esta dirección en el navegador del teléfono:\n"
                            + url)
                    .setPositiveButton("OK", (DialogInterface.OnClickListener) null)
                    .show();
        }
    }

    private void guardar() {
        guardarSilencioso();
        status("Datos guardados. Ya puedes imprimir.");
        toast("Datos guardados");
    }

    private void guardarSilencioso() {
        prefs().edit()
                .putString("ip", ip())
                .putInt("portTags", portOr(etPortTags, 9100))
                .putInt("portDocs", portOr(etPortDocs, 9101))
                .putInt("dest", spDest.getSelectedItemPosition())
                .putInt("labelWmm", portOr(etLblW, 102))
                .putInt("labelHmm", portOr(etLblH, 152))
                .apply();
    }

    private void probarConexion() {
        final String ip = ip();
        if (ip.isEmpty()) {
            status("Escribe primero la IP del SERVIDOR.");
            toast("Escribe primero la IP");
            return;
        }
        guardarSilencioso();
        final int pEtiq = portOr(etPortTags, 9100);
        final int pDoc = portOr(etPortDocs, 9101);
        status("Probando " + ip + " …");
        new Thread(new Runnable() {
            @Override
            public void run() {
                String r1 = probe(ip, pEtiq);
                String r2 = probe(ip, pDoc);
                postStatus("Etiquetas (puerto " + pEtiq + "): " + r1
                        + "\nDocumentos (puerto " + pDoc + "): " + r2);
            }
        }, "pz-probar").start();
    }

    private void etiquetaPrueba() {
        guardarSilencioso();
        int anchoDots = PrintEngine.mmADots(prefs().getInt("labelWmm", 102),
                PrintEngine.DPI_ETIQUETAS);
        sendBytes(ip(), portOr(etPortTags, 9100),
                testLabelZPL(anchoDots).getBytes(StandardCharsets.UTF_8), "etiqueta de prueba");
    }

    private void paginaPrueba() {
        guardarSilencioso();
        sendBytes(ip(), portOr(etPortDocs, 9101),
                testPage().getBytes(StandardCharsets.ISO_8859_1), "página de prueba");
    }

    private void imprimirTexto() {
        guardarSilencioso();
        String texto = etText.getText().toString();
        if (texto.trim().isEmpty()) {
            status("Escribe algo en el cuadro de texto para imprimirlo.");
            toast("Escribe algo primero");
            return;
        }
        int anchoDots = PrintEngine.mmADots(prefs().getInt("labelWmm", 102),
                PrintEngine.DPI_ETIQUETAS);
        if (spDest.getSelectedItemPosition() == 0) {
            sendBytes(ip(), portOr(etPortTags, 9100),
                    wrapTextAsZPL(texto, anchoDots).getBytes(StandardCharsets.UTF_8),
                    "etiqueta (texto → ZPL)");
        } else {
            sendBytes(ip(), portOr(etPortDocs, 9101),
                    pageFromText(texto).getBytes(StandardCharsets.ISO_8859_1),
                    "documento (texto → hoja)");
        }
    }

    private void enviarArchivo() {
        if (ip().isEmpty()) {
            status("Escribe la IP del SERVIDOR primero.");
            toast("Escribe primero la IP");
            return;
        }
        guardarSilencioso();
        Intent i = new Intent("android.intent.action.OPEN_DOCUMENT");
        i.addCategory("android.intent.category.OPENABLE");
        i.setType("*/*");
        startActivityForResult(i, REQ_FILE);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode != -1 || data == null || data.getData() == null) {
            return;
        }
        if (requestCode == REQ_PREVISTA) {
            prepararEImprimirConVistaPrevia(data.getData());
        } else if (requestCode == REQ_FILE) {
            final Uri uri = data.getData();
            new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        InputStream in = getContentResolver().openInputStream(uri);
                        if (in == null) {
                            postStatus("No se pudo abrir el archivo.");
                            return;
                        }
                        ByteArrayOutputStream baos = new ByteArrayOutputStream();
                        byte[] buf = new byte[8192];
                        int n;
                        while ((n = in.read(buf)) > 0) {
                            baos.write(buf, 0, n);
                        }
                        in.close();
                        final byte[] contenido = baos.toByteArray();
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                byte[] bytes;
                                String tipo;
                                if (spDest.getSelectedItemPosition() != 0) {
                                    sendBytes(ip(), portOr(etPortDocs, 9101), contenido,
                                            "archivo → documento (bytes tal cual)");
                                    return;
                                }
                                if (looksLikeZPL(contenido)) {
                                    bytes = contenido;
                                    tipo = "archivo ZPL → etiqueta";
                                } else {
                                    bytes = wrapTextAsZPL(
                                            new String(contenido, StandardCharsets.UTF_8),
                                            PrintEngine.mmADots(prefs().getInt("labelWmm", 102),
                                                    PrintEngine.DPI_ETIQUETAS))
                                            .getBytes(StandardCharsets.UTF_8);
                                    tipo = "archivo de texto → etiqueta";
                                }
                                sendBytes(ip(), portOr(etPortTags, 9100), bytes, tipo);
                            }
                        });
                    } catch (Exception e) {
                        postStatus("No se pudo leer el archivo: " + shortMsg(e));
                    }
                }
            }, "pz-archivo").start();
        }
    }

    private void abrirAjustesDeImpresion() {
        try {
            startActivity(new Intent("android.settings.ACTION_PRINT_SETTINGS"));
            toast("Enciende \"PuenteZebra Móvil\" en la lista y vuelve a la app.");
        } catch (Exception e) {
            toast("No se pudieron abrir los ajustes: " + shortMsg(e));
        }
    }

    private void elegirParaVistaPrevia() {
        if (ip().isEmpty()) {
            status("Escribe la IP del SERVIDOR primero.");
            toast("Escribe primero la IP");
            return;
        }
        guardarSilencioso();
        Intent i = new Intent("android.intent.action.OPEN_DOCUMENT");
        i.addCategory("android.intent.category.OPENABLE");
        i.setType("*/*");
        i.putExtra("android.intent.extra.MIME_TYPES", new String[]{"image/*", "application/pdf"});
        startActivityForResult(i, REQ_PREVISTA);
    }

    private void prepararEImprimirConVistaPrevia(final Uri uri) {
        status("Preparando el documento…");
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    final byte[] pdf;
                    final int paginas;
                    String tipo = getContentResolver().getType(uri);
                    if ((tipo != null && tipo.contains("pdf"))
                            || uri.toString().toLowerCase(Locale.ROOT).endsWith(".pdf")) {
                        pdf = leerTodo(uri);
                        paginas = contarPaginasPdf(uri);
                    } else {
                        pdf = imagenAPdf(uri);
                        paginas = 1;
                    }
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            imprimirConVistaPrevia(pdf, paginas);
                        }
                    });
                } catch (Exception e) {
                    postStatus("No se pudo preparar: " + shortMsg(e));
                }
            }
        }, "pz-preparar").start();
    }

    private void imprimirConVistaPrevia(byte[] pdf, int paginas) {
        try {
            PrintManager pm = (PrintManager) getSystemService("print");
            if (pm == null) {
                status("Este teléfono no soporta impresión.");
                return;
            }
            pm.print("PuenteZebra Móvil", new AdaptadorPdf(pdf, paginas),
                    new PrintAttributes.Builder().build());
            status("Ventana de impresión abierta: elige PuenteZebra ETIQUETAS o PuenteZebra "
                    + "DOCUMENTOS y pulsa Imprimir.");
        } catch (Exception e) {
            status("No se pudo abrir la impresión: " + shortMsg(e));
        }
    }

    private byte[] leerTodo(Uri uri) throws Exception {
        InputStream in = getContentResolver().openInputStream(uri);
        if (in == null) {
            throw new Exception("no se pudo abrir el archivo");
        }
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) {
            baos.write(buf, 0, n);
        }
        in.close();
        return baos.toByteArray();
    }

    private int contarPaginasPdf(Uri uri) throws Exception {
        ParcelFileDescriptor pfd = getContentResolver().openFileDescriptor(uri, "r");
        if (pfd == null) {
            throw new Exception("no se pudo abrir el PDF");
        }
        try {
            PdfRenderer renderer = new PdfRenderer(pfd);
            try {
                return renderer.getPageCount();
            } finally {
                renderer.close();
            }
        } finally {
            pfd.close();
        }
    }

    private byte[] imagenAPdf(Uri uri) throws Exception {
        Bitmap imagen = decodificar(uri, 1600);
        if (imagen == null) {
            throw new Exception("no se pudo abrir la imagen");
        }
        try {
            PdfDocument doc = new PdfDocument();
            PdfDocument.Page pagina = doc.startPage(
                    new PdfDocument.PageInfo.Builder(612, 792, 1).create());
            Canvas lienzo = pagina.getCanvas();
            lienzo.drawColor(-1);
            double escala = Math.min(612.0 / imagen.getWidth(), 792.0 / imagen.getHeight());
            float w = (float) (imagen.getWidth() * escala);
            float h = (float) (imagen.getHeight() * escala);
            lienzo.drawBitmap(imagen, (Rect) null,
                    new RectF((612.0f - w) / 2.0f, (792.0f - h) / 2.0f,
                            (w + 612.0f) / 2.0f, (h + 792.0f) / 2.0f), (Paint) null);
            doc.finishPage(pagina);
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.writeTo(baos);
            doc.close();
            return baos.toByteArray();
        } finally {
            imagen.recycle();
        }
    }

    private Bitmap decodificar(Uri uri, int ladoMaximo) throws Exception {
        BitmapFactory.Options medidas = new BitmapFactory.Options();
        medidas.inJustDecodeBounds = true;
        InputStream in = getContentResolver().openInputStream(uri);
        BitmapFactory.decodeStream(in, null, medidas);
        if (in != null) {
            in.close();
        }
        BitmapFactory.Options opciones = new BitmapFactory.Options();
        opciones.inSampleSize = 1;
        int mayor = Math.max(medidas.outWidth, medidas.outHeight);
        while (mayor / (opciones.inSampleSize * 2) >= ladoMaximo) {
            opciones.inSampleSize *= 2;
        }
        opciones.inPreferredConfig = Bitmap.Config.RGB_565;
        InputStream in2 = getContentResolver().openInputStream(uri);
        Bitmap bmp = BitmapFactory.decodeStream(in2, null, opciones);
        if (in2 != null) {
            in2.close();
        }
        return bmp;
    }

    private class AdaptadorPdf extends PrintDocumentAdapter {
        private final byte[] pdf;
        private final int paginas;

        AdaptadorPdf(byte[] pdf, int paginas) {
            this.pdf = pdf;
            this.paginas = paginas;
        }

        @Override
        public void onLayout(PrintAttributes antiguos, PrintAttributes nuevos,
                             CancellationSignal senal, LayoutResultCallback callback,
                             Bundle extras) {
            if (senal != null && senal.isCanceled()) {
                callback.onLayoutCancelled();
                return;
            }
            callback.onLayoutFinished(new PrintDocumentInfo.Builder("documento.pdf")
                    .setContentType(0)
                    .setPageCount(paginas)
                    .build(), true);
        }

        @Override
        public void onWrite(PageRange[] rangos, ParcelFileDescriptor destino,
                            CancellationSignal senal, WriteResultCallback callback) {
            FileOutputStream out = null;
            try {
                out = new FileOutputStream(destino.getFileDescriptor());
                out.write(pdf);
                out.flush();
                out.close();
                callback.onWriteFinished(new PageRange[]{PageRange.ALL_PAGES});
            } catch (Exception e) {
                if (out != null) {
                    try {
                        out.close();
                    } catch (Exception ignored) {
                    }
                }
                callback.onWriteFailed("No se pudo preparar el documento: " + shortMsg(e));
            }
        }
    }

    private String probe(final String host, final int puerto) {
        try {
            Socket s = new Socket();
            try {
                s.connect(new InetSocketAddress(host, puerto), 3500);
                s.close();
            } finally {
                try {
                    s.close();
                } catch (Exception ignored) {
                }
            }
            return "CONTESTA ✓";
        } catch (Exception e) {
            return "sin respuesta (" + shortMsg(e) + ")";
        }
    }

    private void sendBytes(final String host, final int puerto, final byte[] datos,
                           final String etiqueta) {
        if (host == null || host.isEmpty()) {
            status("Escribe la IP del SERVIDOR (la que muestra su ventana).");
            toast("Falta la IP del SERVIDOR");
            return;
        }
        status("Enviando " + datos.length + " bytes a " + host + ":" + puerto + " …");
        new Thread(new Runnable() {
            @Override
            public void run() {
                String resultado;
                try {
                    Socket s = new Socket();
                    try {
                        s.connect(new InetSocketAddress(host, puerto), 4000);
                        s.setSoTimeout(12000);
                        OutputStream os = s.getOutputStream();
                        os.write(datos);
                        os.flush();
                        try {
                            s.shutdownOutput();
                        } catch (Exception ignored) {
                        }
                        s.close();
                    } finally {
                        try {
                            s.close();
                        } catch (Exception ignored) {
                        }
                    }
                    resultado = "OK — " + etiqueta + ": " + datos.length + " bytes a " + host
                            + ":" + puerto + ". Revisa la impresora.";
                } catch (Exception e) {
                    resultado = "ERROR: no se pudo enviar a " + host + ":" + puerto + " — "
                            + shortMsg(e) + ". ¿El SERVIDOR está abierto y el teléfono en la misma "
                            + "red Wi-Fi?";
                }
                final String msg = resultado;
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        status(msg);
                        toast(msg);
                    }
                });
            }
        }, "pz-enviar").start();
    }

    static String escapeZPLField(String s) {
        return s.replace("\\", "_5C").replace("^", "_5E").replace("~", "_7E").replace("_", "_5F");
    }

    static String trimRight(String s) {
        int n = s.length();
        while (n > 0) {
            char c = s.charAt(n - 1);
            if (c != ' ' && c != '\t') {
                break;
            }
            n--;
        }
        return s.substring(0, n);
    }

    static String wrapTextAsZPL(String texto, int anchoDots) {
        int margen = Math.max(8, anchoDots / 40);
        String lineas = texto.replace("\r\n", "\n").replace("\r", "\n");
        StringBuilder sb = new StringBuilder();
        sb.append("^XA\r\n^CI28\r\n^PW").append(anchoDots)
                .append("\r\n^LH").append(margen).append(',').append(margen).append("\r\n");
        int y = 26;
        int contadas = 0;
        for (String linea : lineas.split("\n", -1)) {
            sb.append("^A0N,26,26^FT0,").append(y).append("^FH_^FD")
                    .append(escapeZPLField(trimRight(linea))).append("^FS\r\n");
            y += 34;
            contadas++;
            if (contadas >= 140) {
                break;
            }
        }
        sb.append("^PQ1\r\n^XZ\r\n");
        return sb.toString();
    }

    static String testLabelZPL(int anchoDots) {
        int margen = Math.max(10, anchoDots / 30);
        String fecha = new SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
                .format(new Date());
        return "^XA\r\n^CI28\r\n^PW" + anchoDots + "\r\n^LH" + margen + ',' + margen + "\r\n"
                + "^FO0,0^GB" + (anchoDots - 2 * margen - 10) + ",200,4^FS\r\n"
                + "^A0N,46,46^FO" + (margen + 10) + ",26^FDPuenteZebra Móvil " + VersionInfo.VERSION_NAME + "^FS\r\n"
                + "^A0N,30,30^FO" + (margen + 10) + ",92^FH_^FD" + escapeZPLField("Prueba desde el teléfono") + "^FS\r\n"
                + "^A0N,26,26^FO" + (margen + 10) + ",140^FH_^FDFecha: " + escapeZPLField(fecha) + "^FS\r\n"
                + "^A0N,24,24^FO" + (margen + 10) + ",172^FH_^FDSi ves esta etiqueta, el móvil funciona^FS\r\n"
                + "^PQ1\r\n^XZ\r\n";
    }

    static boolean looksLikeZPL(byte[] datos) {
        String s = new String(datos, StandardCharsets.US_ASCII).trim();
        if (s.startsWith("^XA") || s.startsWith("\n^XA")) {
            return true;
        }
        return s.substring(0, Math.min(200, s.length())).contains("^XA");
    }

    static String testPage() {
        String fecha = new SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
                .format(new Date());
        return "\u001bE\r\n\r\n       P U E N T E Z E B R A   M O V I L  -  P R U E B A\r\n"
                + "       -------------------------------------------------\r\n\r\n"
                + "       Impresora de DOCUMENTOS (hoja carta)\r\n"
                + "       Fecha: " + fecha + "\r\n\r\n"
                + "       Si ves esta pagina, PuenteZebra Movil\r\n"
                + "       funciona correctamente.\r\n\r\n\f";
    }

    static String pageFromText(String texto) {
        String[] lineas = ascii(texto).replace("\r\n", "\n").replace("\r", "\n")
                .split("\n", -1);
        StringBuilder sb = new StringBuilder("\u001bE");
        List<String> envueltas = wrapLines(lineas, 78);
        int contadas = 0;
        for (String linea : envueltas) {
            sb.append(linea).append("\r\n");
            contadas++;
            if (contadas >= 55) {
                break;
            }
        }
        sb.append("\f");
        return sb.toString();
    }

    static List<String> wrapLines(String[] lineas, int ancho) {
        ArrayList<String> salida = new ArrayList<String>();
        for (String linea : lineas) {
            String s = linea;
            if (s.length() <= ancho) {
                salida.add(s);
                continue;
            }
            while (s.length() > ancho) {
                int corte = s.lastIndexOf(32, ancho);
                if (corte <= 0) {
                    corte = ancho;
                }
                salida.add(s.substring(0, corte));
                s = s.substring(corte).trim();
            }
            if (!s.isEmpty()) {
                salida.add(s);
            }
        }
        return salida;
    }

    static String ascii(String texto) {
        StringBuilder sb = new StringBuilder();
        for (char c : texto.toCharArray()) {
            if (c == '\n' || c == '\r' || c == '\t') {
                sb.append(c);
            } else {
                int i = "áàéèíìóòúùüñÁÀÉÈÍÌÓÒÚÙÜÑçÇ".indexOf(c);
                if (i >= 0) {
                    sb.append("aaeeiioouuunAAEEIIOOUUUNcC".charAt(i));
                } else if (c >= ' ' && c < 127) {
                    sb.append(c);
                }
            }
        }
        return sb.toString();
    }

    private SharedPreferences prefs() {
        return getSharedPreferences("cfg", 0);
    }

    private TextView label(String texto) {
        TextView tv = new TextView(this);
        tv.setText(texto);
        tv.setPadding(0, dp(10), 0, dp(2));
        return tv;
    }

    private EditText editText(String texto, boolean numerico) {
        EditText et = new EditText(this);
        et.setText(texto);
        if (numerico) {
            et.setRawInputType(2);
        }
        et.setTextSize(14.0f);
        return et;
    }

    private Button btn(String texto, View.OnClickListener listener) {
        Button b = new Button(this);
        b.setText(texto);
        b.setTextSize(13.0f);
        b.setOnClickListener(listener);
        return b;
    }

    private LinearLayout vbox() {
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL);
        return l;
    }

    private LinearLayout row() {
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.HORIZONTAL);
        return l;
    }

    private LinearLayout.LayoutParams lpWeights() {
        return new LinearLayout.LayoutParams(0, -2, 1.0f);
    }

    private int dp(int d) {
        return Math.round(d * getResources().getDisplayMetrics().density);
    }

    private void toast(String texto) {
        Toast.makeText(this, texto, 1).show();
    }

    private void status(String texto) {
        tvStatus.setText(texto);
    }

    private void postStatus(final String texto) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                tvStatus.setText(texto);
            }
        });
    }

    private String ip() {
        return etIP.getText().toString().trim();
    }

    private int portOr(EditText et, int porDefecto) {
        int valor;
        try {
            valor = Integer.parseInt(et.getText().toString().trim());
        } catch (Exception unused) {
            return porDefecto;
        }
        return (valor < 1 || valor > 65535) ? porDefecto : valor;
    }

    private String shortMsg(Exception e) {
        String m = e.getMessage();
        return m == null ? e.getClass().getSimpleName() : m;
    }
}
