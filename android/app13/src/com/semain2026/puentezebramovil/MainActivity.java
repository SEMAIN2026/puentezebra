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
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.content.res.ColorStateList;
import android.view.Gravity;
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
import android.widget.Switch;
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
    private Switch swColor;
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

    // ---------- Paleta de la interfaz ----------
    private static final int C_FONDO = 0xFFEDF1F7;
    private static final int C_TARJETA = 0xFFFFFFFF;
    private static final int C_BORDE = 0xFFDCE4EC;
    private static final int C_OSCURO = 0xFF0E1A2B;
    private static final int C_PRIMARIO = 0xFF0B66C9;
    private static final int C_ACENTO = 0xFF2E9BFF;
    private static final int C_TEXTO = 0xFF16233A;
    private static final int C_SUBTITULO = 0xFF5A6A80;
    private static final int C_CAMPO = 0xFFF7FAFD;
    private static final int C_BORDE_CAMPO = 0xFFD5DEE9;
    private static final int C_TINTADO = 0xFFE4F0FB;

    private void buildUI() {
        SharedPreferences prefs = prefs();

        // Barra de estado del teléfono a juego con el encabezado.
        try {
            getWindow().setStatusBarColor(C_OSCURO);
        } catch (Throwable ignored) {
        }

        LinearLayout raiz = vbox();
        raiz.setBackgroundColor(C_FONDO);

        // ===== Encabezado de marca =====
        LinearLayout cabecera = vbox();
        cabecera.setBackgroundColor(C_OSCURO);
        int ph = dp(20);
        cabecera.setPadding(ph, dp(16), ph, dp(14));

        LinearLayout filaMarca = row();
        LinearLayout logoCaja = vbox();
        GradientDrawable gdLogo = new GradientDrawable(GradientDrawable.Orientation.TL_BR,
                new int[]{0xFF2E9BFF, 0xFF0B66C9});
        gdLogo.setCornerRadius(dp(12));
        logoCaja.setBackground(gdLogo);
        logoCaja.setPadding(dp(10), dp(10), dp(10), dp(10));
        TextView logoTexto = new TextView(this);
        logoTexto.setText("PZ");
        logoTexto.setTextColor(0xFFFFFFFF);
        logoTexto.setTextSize(16.0f);
        logoTexto.setTypeface(Typeface.DEFAULT_BOLD);
        logoCaja.addView(logoTexto);
        filaMarca.addView(logoCaja);

        LinearLayout titulos = vbox();
        TextView nombre = new TextView(this);
        nombre.setText("PuenteZebra Móvil");
        nombre.setTextColor(0xFFFFFFFF);
        nombre.setTextSize(19.0f);
        nombre.setTypeface(Typeface.DEFAULT_BOLD);
        titulos.addView(nombre);
        TextView lema = new TextView(this);
        lema.setText("Imprime en las dos impresoras del SERVIDOR: etiquetas "
                + "Zebra y hoja carta, con el Wi-Fi de la oficina.");
        lema.setTextColor(0xFFAFC1D4);
        lema.setTextSize(12.0f);
        lema.setPadding(0, dp(3), 0, 0);
        titulos.addView(lema);
        filaMarca.addView(titulos, new LinearLayout.LayoutParams(0, -2, 1.0f));
        filaMarca.setGravity(Gravity.CENTER_VERTICAL);
        cabecera.addView(filaMarca);

        TextView version = new TextView(this);
        version.setText("v" + VersionInfo.VERSION_NAME);
        version.setTextColor(0xFF0E1A2B);
        version.setTextSize(11.0f);
        version.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout chip = vbox();
        chip.setBackground(redondeado(0xFF2E9BFF, dp(20), 0, 0, null));
        chip.setPadding(dp(10), dp(4), dp(10), dp(4));
        chip.addView(version);
        LinearLayout filaChip = row();
        filaChip.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        filaChip.addView(chip);
        cabecera.addView(filaChip, new LinearLayout.LayoutParams(-1, -2));

        // Línea de acento bajo el encabezado.
        View linea = new View(this);
        linea.setBackgroundColor(C_ACENTO);
        cabecera.addView(linea, new LinearLayout.LayoutParams(-1, dp(3)));
        raiz.addView(cabecera);

        // ===== Contenido con desplazamiento =====
        ScrollView scroll = new ScrollView(this);
        LinearLayout contenido = vbox();
        int pc = dp(14);
        contenido.setPadding(pc, pc, pc, dp(18));
        scroll.addView(contenido);
        LinearLayout.LayoutParams lpScroll = new LinearLayout.LayoutParams(-1, 0, 1.0f);
        raiz.addView(scroll, lpScroll);

        // --- Tarjeta 1: conexión ---
        LinearLayout tCon = tarjeta();
        tCon.addView(tituloTarjeta("Conexión con el SERVIDOR"));
        tCon.addView(nota("Escribe la IP que muestra la ventana del SERVIDOR en "
                + "la PC de las impresoras."));
        tCon.addView(campoLabel("IP del SERVIDOR (ej. 192.168.1.50)"));
        etIP = editText(prefs.getString("ip", ""), false);
        etIP.setHint("192.168.1.50");
        tCon.addView(etIP);

        LinearLayout rowPuertos = row();
        LinearLayout colE = vbox();
        colE.addView(campoLabel("Puerto etiquetas"));
        etPortTags = editText(String.valueOf(prefs.getInt("portTags", 9100)), true);
        colE.addView(etPortTags);
        LinearLayout colD = vbox();
        colD.addView(campoLabel("Puerto documentos"));
        etPortDocs = editText(String.valueOf(prefs.getInt("portDocs", 9101)), true);
        colD.addView(etPortDocs);
        rowPuertos.addView(colE, lpWeights());
        rowPuertos.addView(colD, lpWeights());
        espacio(tCon, 10);
        tCon.addView(rowPuertos);

        LinearLayout filaGuardar = row();
        filaGuardar.addView(btn("Guardar", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                guardar();
            }
        }), lpWeights());
        hueco(filaGuardar, 10);
        filaGuardar.addView(btnContorno("Probar conexión", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                probarConexion();
            }
        }), lpWeights());
        espacio(tCon, 14);
        tCon.addView(filaGuardar);
        contenido.addView(tCon, lpTarjeta());

        // --- Tarjeta 2: imprimir desde otras apps ---
        LinearLayout tVirt = tarjeta();
        tVirt.addView(tituloTarjeta("Imprimir desde otras apps"));
        tVirt.addView(nota("Activa una vez la impresora virtual y luego "
                + "imprime desde Fotos, el escáner, PDF o WhatsApp como con "
                + "cualquier impresora: verás la vista previa y las copias "
                + "antes de imprimir."));
        tVirt.addView(paso(1, "Pulsa \"Activar servicio\" y enciende "
                + "\"PuenteZebra Móvil\" en Ajustes → Impresión."));
        tVirt.addView(paso(2, "En la otra app: menú → Imprimir."));
        tVirt.addView(paso(3, "Elige \"PuenteZebra ETIQUETAS\" (Zebra) o "
                + "\"PuenteZebra DOCUMENTOS\" (hoja carta)."));
        espacio(tVirt, 12);
        LinearLayout filaVirt = row();
        filaVirt.addView(btnOscuro("Activar servicio", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                abrirAjustesDeImpresion();
            }
        }), lpWeights());
        hueco(filaVirt, 10);
        filaVirt.addView(btnContorno("Elegir foto o PDF", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                elegirParaVistaPrevia();
            }
        }), lpWeights());
        tVirt.addView(filaVirt);
        TextView pista = nota("Si un trabajo falla, el motivo exacto aparece en "
                + "la notificación y en Ajustes → Impresión.");
        pista.setPadding(0, dp(8), 0, 0);
        tVirt.addView(pista);
        contenido.addView(tVirt, lpTarjeta());

        // --- Tarjeta 3: imprimir desde esta app ---
        LinearLayout tApp = tarjeta();
        tApp.addView(tituloTarjeta("Imprimir desde esta app"));
        tApp.addView(campoLabel("¿A dónde va a imprimir?"));
        spDest = new Spinner(this);
        ArrayAdapter<String> adaptador = new ArrayAdapter<String>(this,
                android.R.layout.simple_spinner_item,
                new String[]{"ETIQUETAS — Zebra ZD220 (texto → etiqueta)",
                        "DOCUMENTOS — hoja carta (texto → hoja)"});
        adaptador.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spDest.setAdapter((SpinnerAdapter) adaptador);
        spDest.setSelection(prefs.getInt("dest", 0));
        LinearLayout cajaSpinner = vbox();
        cajaSpinner.setBackground(redondeado(C_CAMPO, dp(10), C_BORDE_CAMPO, 1, null));
        cajaSpinner.setPadding(dp(10), dp(6), dp(10), dp(6));
        cajaSpinner.addView(spDest);
        tApp.addView(cajaSpinner);

        tApp.addView(campoLabel("Tamaño de etiqueta (mm) — para la impresora virtual"));
        LinearLayout filaTam = row();
        LinearLayout colW = vbox();
        colW.addView(campoLabel("Ancho"));
        etLblW = editText(String.valueOf(prefs.getInt("labelWmm", 102)), true);
        colW.addView(etLblW);
        LinearLayout colH = vbox();
        colH.addView(campoLabel("Alto"));
        etLblH = editText(String.valueOf(prefs.getInt("labelHmm", 152)), true);
        colH.addView(etLblH);
        filaTam.addView(colW, lpWeights());
        filaTam.addView(colH, lpWeights());
        espacio(tApp, 10);
        tApp.addView(filaTam);
        tApp.addView(nota("Normal: 102×152 (etiqueta 4×6\" o 100×150). "
                + "Otras comunes: 100×100, 51×89 (2×3,5\")."));

        // v1.3.3: color para la impresora de DOCUMENTOS (setq de ESC/P-R)
        LinearLayout filaColor = row();
        TextView etiquetaColor = campoLabel("Imprimir DOCUMENTOS a color");
        swColor = new Switch(this);
        swColor.setChecked(prefs.getBoolean("docsColor", true));
        filaColor.addView(etiquetaColor, lpWeights());
        filaColor.addView(swColor);
        espacio(tApp, 6);
        tApp.addView(filaColor);
        tApp.addView(nota("A color: fotos y gráficos con tinta de color. "
                + "Apagado: solo tinta negra (más rápido y barato para texto)."));

        espacio(tApp, 6);
        tApp.addView(campoLabel("Texto a imprimir"));
        etText = new EditText(this);
        etText.setHint("Escribe aquí lo que quieres imprimir…");
        etText.setSingleLine(false);
        etText.setRawInputType(131073);
        etText.setMinLines(5);
        etText.setGravity(48);
        etText.setTextSize(14.0f);
        etText.setTextColor(C_TEXTO);
        etText.setBackground(redondeado(C_CAMPO, dp(10), C_BORDE_CAMPO, 1, null));
        etText.setPadding(dp(12), dp(10), dp(12), dp(10));
        tApp.addView(etText, new LinearLayout.LayoutParams(-1, -2));

        espacio(tApp, 14);
        LinearLayout filaTexto = row();
        filaTexto.addView(btn("Imprimir texto", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                imprimirTexto();
            }
        }), lpWeights());
        hueco(filaTexto, 10);
        filaTexto.addView(btnContorno("Enviar archivo…", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                enviarArchivo();
            }
        }), lpWeights());
        tApp.addView(filaTexto);

        espacio(tApp, 10);
        TextView subPruebas = nota("Comprobación rápida de la conexión:");
        subPruebas.setTextColor(C_SUBTITULO);
        subPruebas.setTypeface(Typeface.DEFAULT_BOLD);
        tApp.addView(subPruebas);
        LinearLayout filaPrueba = row();
        filaPrueba.addView(btnTintado("Etiqueta de prueba", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                etiquetaPrueba();
            }
        }), lpWeights());
        hueco(filaPrueba, 10);
        filaPrueba.addView(btnTintado("Página de prueba", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                paginaPrueba();
            }
        }), lpWeights());
        espacio(tApp, 8);
        tApp.addView(filaPrueba);
        contenido.addView(tApp, lpTarjeta());

        // --- Tarjeta 4: app y actualizaciones ---
        LinearLayout tMas = tarjeta();
        tMas.addView(tituloTarjeta("App y actualizaciones"));
        TextView versionLinea = new TextView(this);
        versionLinea.setText("Versión " + VersionInfo.VERSION_NAME
                + "  ·  código " + VersionInfo.VERSION_CODE);
        versionLinea.setTextColor(C_TEXTO);
        versionLinea.setTextSize(12.5f);
        versionLinea.setTypeface(Typeface.DEFAULT_BOLD);
        tMas.addView(versionLinea);
        tMas.addView(nota("La app revisa sola si hay versión nueva al abrirla. "
                + "Instalar un APK más nuevo ACTUALIZA encima del actual: no se "
                + "borra nada y la configuración (IP y puertos) se conserva."));

        LinearLayout filaApp = row();
        filaApp.addView(btnContorno("Buscar actualizaciones", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                status("Revisando en " + SITE_URL.replace("https://", "") + " …");
                revisarActualizaciones(true);
            }
        }), lpWeights());
        hueco(filaApp, 10);
        filaApp.addView(btnOscuro("Página de descargas", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                abrirPaginaDescargas();
            }
        }), lpWeights());
        espacio(tMas, 12);
        tMas.addView(filaApp);
        contenido.addView(tMas, lpTarjeta());

        // ===== Pie: estado en forma de consola =====
        LinearLayout pie = vbox();
        pie.setBackgroundColor(C_OSCURO);
        pie.setPadding(ph, dp(10), ph, dp(12));
        LinearLayout filaEstado = row();
        View punto = new View(this);
        LinearLayout.LayoutParams lpPunto = new LinearLayout.LayoutParams(dp(8), dp(8));
        punto.setBackground(redondeado(0xFF39D98A, dp(4), 0, 0, null));
        filaEstado.addView(punto, lpPunto);
        TextView etq = new TextView(this);
        etq.setText("Estado");
        etq.setTextColor(0xFF8DA2B8);
        etq.setTextSize(11.0f);
        etq.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams lpEtq = new LinearLayout.LayoutParams(-2, -2);
        lpEtq.leftMargin = dp(8);
        filaEstado.addView(etq, lpEtq);
        filaEstado.setGravity(Gravity.CENTER_VERTICAL);
        pie.addView(filaEstado);
        tvStatus = new TextView(this);
        tvStatus.setText("Listo. Configura la IP del SERVIDOR para empezar.");
        tvStatus.setTextSize(12.5f);
        tvStatus.setTypeface(Typeface.MONOSPACE);
        tvStatus.setTextColor(0xFFE8EEF5);
        tvStatus.setPadding(0, dp(4), 0, 0);
        pie.addView(tvStatus);
        raiz.addView(pie);

        setContentView(raiz);
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
                .putBoolean("docsColor", swColor != null && swColor.isChecked())
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
        pdfADocumentos(pdfPaginaPrueba(), false, "página de prueba");
    }

    /**
     * v1.3.3 — Imprime un PDF (bytes) en la impresora de DOCUMENTOS con el
     * mismo motor ESC/P-R del servicio: hoja carta a 360 dpi, en flujo, con
     * el color opcional. Así la página de prueba, el texto y los archivos
     * siguen EXACTAMENTE el mismo camino que imprimir desde otra app.
     */
    private void pdfADocumentos(final byte[] pdf, final boolean color, final String que) {
        final String host = ip();
        if (host.isEmpty()) {
            status("Escribe la IP del SERVIDOR (la que muestra su ventana).");
            toast("Falta la IP del SERVIDOR");
            return;
        }
        final int puerto = portOr(etPortDocs, 9101);
        status("Imprimiendo " + que + " en DOCUMENTOS (" + (color ? "color" : "monocromo")
                + ") vía " + host + ":" + puerto + " …");
        new Thread(new Runnable() {
            @Override
            public void run() {
                String resultado;
                try {
                    File temporal = File.createTempFile("pz_", ".pdf", getCacheDir());
                    ParcelFileDescriptor pfd = null;
                    PdfRenderer renderer = null;
                    PrintEngine.Canal canal = null;
                    try {
                        FileOutputStream out = new FileOutputStream(temporal);
                        out.write(pdf);
                        out.flush();
                        out.close();
                        pfd = ParcelFileDescriptor.open(temporal,
                                ParcelFileDescriptor.MODE_READ_ONLY);
                        renderer = new PdfRenderer(pfd);
                        canal = PrintEngine.Canal.abrir(host, puerto);
                        long bytes = imprimirPdfEscpr(renderer, canal, color);
                        resultado = "OK — " + que + ": " + renderer.getPageCount()
                                + " pág., " + bytes + " bytes a " + host + ":" + puerto
                                + ". Revisa la impresora.";
                    } finally {
                        try {
                            if (canal != null) {
                                canal.cerrar();
                            }
                        } catch (Throwable ignored) {
                        }
                        try {
                            if (renderer != null) {
                                renderer.close();
                            }
                        } catch (Throwable ignored) {
                        }
                        try {
                            if (pfd != null) {
                                pfd.close();
                            }
                        } catch (Throwable ignored) {
                        }
                        temporal.delete();
                    }
                } catch (Exception e) {
                    resultado = "ERROR: no se pudo imprimir " + que + " — " + shortMsg(e)
                            + ". ¿El SERVIDOR está abierto y el teléfono en la misma red Wi-Fi?";
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
        }, "pz-pdf-doc").start();
    }

    /** Sesión ESC/P-R completa de todas las páginas; devuelve los bytes enviados. */
    private long imprimirPdfEscpr(PdfRenderer renderer, PrintEngine.Canal canal,
                                  boolean color) throws Exception {
        final java.io.OutputStream flujo = canal.flujo();
        final long[] total = {0};
        java.io.OutputStream contar = new java.io.OutputStream() {
            @Override
            public void write(int b) throws java.io.IOException {
                flujo.write(b);
                total[0]++;
            }

            @Override
            public void write(byte[] b, int off, int len) throws java.io.IOException {
                flujo.write(b, off, len);
                total[0] += len;
            }

            @Override
            public void flush() throws java.io.IOException {
                flujo.flush();
            }
        };
        contar.write(EpsonEscpr.sesionInicio(color));
        int totalPaginas = renderer.getPageCount();
        for (int p = 0; p < totalPaginas; p++) {
            contar.write(EpsonEscpr.inicioPagina(p + 1));
            PrintEngine.imprimirPaginaEscpr(renderer, p, contar);
            contar.write(EpsonEscpr.finPagina(p < totalPaginas - 1));
            contar.flush();
        }
        contar.write(EpsonEscpr.finTrabajo());
        contar.flush();
        return total[0];
    }

    /** Página de prueba en PDF (hoja carta): texto, recuadro y degradado. */
    private byte[] pdfPaginaPrueba() {
        String fecha = new SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
                .format(new Date());
        PdfDocument doc = new PdfDocument();
        PdfDocument.Page pagina = doc.startPage(
                new PdfDocument.PageInfo.Builder(612, 792, 1).create());
        Canvas lienzo = pagina.getCanvas();
        lienzo.drawColor(-1);
        Paint p = new Paint();
        p.setAntiAlias(true);
        p.setColor(-16777216);
        p.setTextSize(26);
        p.setFakeBoldText(true);
        lienzo.drawText("P U E N T E Z E B R A   M Ó V I L", 60, 90, p);
        p.setFakeBoldText(false);
        p.setTextSize(14);
        lienzo.drawText("Prueba de la impresora de DOCUMENTOS (Epson, hoja carta)", 60, 120, p);
        lienzo.drawText("Fecha: " + fecha, 60, 145, p);
        p.setStrokeWidth(2);
        lienzo.drawRect(60, 170, 552, 174, p);
        p.setTextSize(16);
        lienzo.drawText("Si ves ESTA hoja con el recuadro y el degradado,", 60, 210, p);
        lienzo.drawText("la impresión de documentos e imágenes ya funciona:", 60, 234, p);
        lienzo.drawText("las fotos y PDF de cualquier app salen con imagen.", 60, 258, p);
        // degradado de gris: comprueba los niveles intermedios (no solo negro)
        for (int i = 0; i < 16; i++) {
            int v = (int) (17 * i);
            p.setColor(v << 16 | v << 8 | v | 0xFF000000);
            lienzo.drawRect(60 + i * 31, 300, 91 + i * 31, 360, p);
        }
        p.setColor(-16777216);
        p.setTextSize(13);
        lienzo.drawText("PuenteZebra Móvil v1.3.3 · ESC/P-R 360 dpi", 60, 730, p);
        doc.finishPage(pagina);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try {
            doc.writeTo(baos);
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
        doc.close();
        return baos.toByteArray();
    }

    /** Convierte texto plano en PDF carta (varias páginas de 52 líneas). */
    static byte[] pdfDeTexto(String texto) {
        List<String> lineas = wrapLines(ascii(texto)
                .replace("\r\n", "\n").replace("\r", "\n").split("\n", -1), 80);
        PdfDocument doc = new PdfDocument();
        int numero = 1;
        int indice = 0;
        while (indice < lineas.size() || numero == 1) {
            PdfDocument.Page pagina = doc.startPage(
                    new PdfDocument.PageInfo.Builder(612, 792, numero).create());
            Canvas lienzo = pagina.getCanvas();
            lienzo.drawColor(-1);
            Paint p = new Paint();
            p.setAntiAlias(true);
            p.setColor(-16777216);
            p.setTextSize(13);
            int y = 60;
            for (int i = 0; i < 52 && indice < lineas.size(); i++, indice++) {
                lienzo.drawText(lineas.get(indice), 50, y, p);
                y += 14;
            }
            doc.finishPage(pagina);
            numero++;
            if (indice >= lineas.size()) {
                break;
            }
        }
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try {
            doc.writeTo(baos);
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
        doc.close();
        return baos.toByteArray();
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
            pdfADocumentos(pdfDeTexto(texto), false, "documento (texto → hoja)");
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
                                if (spDest.getSelectedItemPosition() != 0) {
                                    // v1.3.3: los documentos SIEMPRE por el motor
                                    // ESC/P-R (antes se mandaban los bytes crudos
                                    // del PDF y el L3250 imprimía basura).
                                    byte[] pdf;
                                    try {
                                        if (esPdf(contenido)) {
                                            pdf = contenido;
                                        } else if (esImagen(contenido)) {
                                            pdf = imagenAPdf(contenido);
                                        } else {
                                            pdf = pdfDeTexto(
                                                    new String(contenido, StandardCharsets.UTF_8));
                                        }
                                    } catch (Exception e) {
                                        postStatus("No se pudo preparar el documento: "
                                                + shortMsg(e));
                                        return;
                                    }
                                    pdfADocumentos(pdf, true, "archivo → documento");
                                    return;
                                }
                                byte[] bytes;
                                String tipo;
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
        // v1.3.2: no se abre el PdfRenderer sobre el descriptor del
        // proveedor (puede ser una tubería no seekable, igual que el spooler).
        // Se copia a un archivo temporal y se cuenta sobre él.
        final byte[] pdf = leerTodo(uri);
        File temporal = File.createTempFile("pz_", ".pdf", getCacheDir());
        ParcelFileDescriptor pfd = null;
        PdfRenderer renderer = null;
        try {
            FileOutputStream out = new FileOutputStream(temporal);
            out.write(pdf);
            out.flush();
            out.close();
            pfd = ParcelFileDescriptor.open(temporal,
                    ParcelFileDescriptor.MODE_READ_ONLY);
            renderer = new PdfRenderer(pfd);
            return renderer.getPageCount();
        } finally {
            try {
                if (renderer != null) {
                    renderer.close();
                }
            } catch (Throwable ignored) {
            }
            try {
                if (pfd != null) {
                    pfd.close();
                }
            } catch (Throwable ignored) {
            }
            temporal.delete();
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

    /** ¿El contenido es un PDF? (cabecera %PDF) */
    static boolean esPdf(byte[] b) {
        return b != null && b.length > 4 && b[0] == '%' && b[1] == 'P'
                && b[2] == 'D' && b[3] == 'F';
    }

    /** ¿El contenido es una imagen conocida? (JPEG, PNG, GIF, BMP, WebP) */
    static boolean esImagen(byte[] b) {
        if (b == null || b.length < 12) {
            return false;
        }
        if ((b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8) {
            return true;                                  // JPEG
        }
        if ((b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') {
            return true;                                  // PNG
        }
        if (b[0] == 'G' && b[1] == 'I' && b[2] == 'F') {
            return true;                                  // GIF
        }
        if (b[0] == 'B' && b[1] == 'M') {
            return true;                                  // BMP
        }
        return b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E';           // WebP
    }

    /** Una imagen (bytes) centrada en una hoja carta PDF. */
    private byte[] imagenAPdf(byte[] datos) throws Exception {
        Bitmap imagen = BitmapFactory.decodeByteArray(datos, 0, datos.length);
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

    // ---------- Constructores de la interfaz ----------

    /** Tarjeta blanca redondeada con borde suave. */
    private LinearLayout tarjeta() {
        LinearLayout c = vbox();
        c.setBackground(redondeado(C_TARJETA, dp(16), C_BORDE, dp(1), null));
        c.setPadding(dp(16), dp(14), dp(16), dp(14));
        return c;
    }

    /** Margen vertical dentro de una tarjeta (en dp). */
    private void espacio(LinearLayout padre, int altoDp) {
        View v = new View(this);
        padre.addView(v, new LinearLayout.LayoutParams(-1, dp(altoDp)));
    }

    /** Espacio horizontal entre dos botones de la misma fila. */
    private void hueco(LinearLayout fila, int anchoDp) {
        View v = new View(this);
        fila.addView(v, new LinearLayout.LayoutParams(dp(anchoDp), 1));
    }

    private LinearLayout.LayoutParams lpTarjeta() {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.topMargin = dp(12);
        return lp;
    }

    /** Título de tarjeta con marcador de acento. */
    private LinearLayout tituloTarjeta(String texto) {
        LinearLayout fila = row();
        fila.setGravity(Gravity.CENTER_VERTICAL);
        View marcador = new View(this);
        LinearLayout.LayoutParams lpM = new LinearLayout.LayoutParams(dp(4), dp(16));
        marcador.setBackground(redondeado(C_ACENTO, dp(2), 0, 0, null));
        fila.addView(marcador, lpM);
        TextView tv = new TextView(this);
        tv.setText(texto);
        tv.setTextColor(C_TEXTO);
        tv.setTextSize(15.0f);
        tv.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams lpT = new LinearLayout.LayoutParams(-2, -2);
        lpT.leftMargin = dp(8);
        fila.addView(tv, lpT);
        return fila;
    }

    private TextView nota(String texto) {
        TextView tv = new TextView(this);
        tv.setText(texto);
        tv.setTextColor(C_SUBTITULO);
        tv.setTextSize(12.0f);
        tv.setLineSpacing(dp(2), 1.0f);
        tv.setPadding(0, dp(2), 0, dp(6));
        return tv;
    }

    private TextView campoLabel(String texto) {
        TextView tv = new TextView(this);
        tv.setText(texto);
        tv.setTextColor(0xFF41526B);
        tv.setTextSize(11.5f);
        tv.setTypeface(Typeface.DEFAULT_BOLD);
        tv.setPadding(0, dp(10), 0, dp(4));
        return tv;
    }

    /** Un paso numerado con círculo azul. */
    private LinearLayout paso(int n, String texto) {
        LinearLayout fila = row();
        fila.setGravity(Gravity.CENTER_VERTICAL);
        TextView num = new TextView(this);
        num.setText(String.valueOf(n));
        num.setTextColor(0xFFFFFFFF);
        num.setTextSize(12.0f);
        num.setTypeface(Typeface.DEFAULT_BOLD);
        num.setGravity(Gravity.CENTER);
        GradientDrawable circulo = new GradientDrawable();
        circulo.setShape(GradientDrawable.OVAL);
        circulo.setColor(C_PRIMARIO);
        num.setBackground(circulo);
        LinearLayout.LayoutParams lpN = new LinearLayout.LayoutParams(dp(22), dp(22));
        fila.addView(num, lpN);
        TextView tv = new TextView(this);
        tv.setText(texto);
        tv.setTextColor(C_SUBTITULO);
        tv.setTextSize(12.5f);
        LinearLayout.LayoutParams lpT = new LinearLayout.LayoutParams(0, -2, 1.0f);
        lpT.leftMargin = dp(10);
        fila.addView(tv, lpT);
        return fila;
    }

    /** Fondo redondeado; con colores de degradado si se dan dos colores. */
    private GradientDrawable redondeado(int color, int radioPx, int colorBorde,
                                        int grosorBordePx, int[] degradado) {
        GradientDrawable g;
        if (degradado != null && degradado.length >= 2) {
            g = new GradientDrawable(GradientDrawable.Orientation.TL_BR, degradado);
        } else {
            g = new GradientDrawable();
            if (color != 0) {
                g.setColor(color);
            }
        }
        if (radioPx > 0) {
            g.setCornerRadius(radioPx);
        }
        if (colorBorde != 0) {
            g.setStroke(Math.max(1, grosorBordePx), colorBorde);
        }
        return g;
    }

    private Drawable conRipple(Drawable base, int color) {
        return new RippleDrawable(ColorStateList.valueOf(color), base,
                new ColorDrawable(0xFFFFFFFF));
    }

    private Button btn(String texto, View.OnClickListener listener) {
        return botonBase(texto, listener, redondeado(C_PRIMARIO, dp(12), 0, 0, null),
                0xFFFFFFFF, 0x33FFFFFF);
    }

    private Button btnContorno(String texto, View.OnClickListener listener) {
        return botonBase(texto, listener, redondeado(C_TARJETA, dp(12), C_BORDE, dp(1), null),
                C_TEXTO, 0x1F0B66C9);
    }

    private Button btnOscuro(String texto, View.OnClickListener listener) {
        return botonBase(texto, listener, redondeado(C_OSCURO, dp(12), 0, 0, null),
                0xFFFFFFFF, 0x33FFFFFF);
    }

    private Button btnTintado(String texto, View.OnClickListener listener) {
        return botonBase(texto, listener, redondeado(C_TINTADO, dp(12), 0x330B66C9, dp(1), null),
                C_PRIMARIO, 0x220B66C9);
    }

    private Button botonBase(String texto, View.OnClickListener listener, GradientDrawable base,
                             int colorTexto, int colorRipple) {
        Button b = new Button(this);
        b.setText(texto);
        b.setAllCaps(false);
        b.setTextSize(13.5f);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setTextColor(colorTexto);
        b.setPadding(dp(6), 0, dp(6), 0);
        b.setMinHeight(dp(44));
        b.setOnClickListener(listener);
        b.setBackground(conRipple(base, colorRipple));
        return b;
    }

    private TextView label(String texto) {
        return campoLabel(texto);
    }

    private EditText editText(String texto, boolean numerico) {
        EditText et = new EditText(this);
        et.setText(texto);
        if (numerico) {
            et.setRawInputType(2);
        }
        et.setTextSize(15.0f);
        et.setTextColor(C_TEXTO);
        et.setHintTextColor(0xFF9AACC0);
        et.setBackground(redondeado(C_CAMPO, dp(10), C_BORDE_CAMPO, dp(1), null));
        et.setPadding(dp(12), dp(10), dp(12), dp(10));
        return et;
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
