package com.semain2026.puentezebramovil;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import java.io.File;
import java.io.FileNotFoundException;

/**
 * Sirve el APK de actualización descargado para que el instalador de Android
 * pueda abrirlo (content://) y actualizar la app encima de la instalada.
 */
public class ApkProvider extends ContentProvider {

    public static final String AUTHORITY = "com.semain2026.puentezebramovil.apkprovider";
    public static final String NAME = "puentezebra-actualizacion.apk";

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public String getType(Uri uri) {
        return "application/vnd.android.package-archive";
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }

    private File apkFile() {
        return new File(new File(getContext().getExternalFilesDir(null), "updates"), NAME);
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File f = apkFile();
        if (!f.exists()) {
            throw new FileNotFoundException("Aún no hay ninguna actualización descargada");
        }
        return ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs,
                        String sortOrder) {
        if (projection == null) {
            projection = new String[]{"_display_name", "_size"};
        }
        File f = apkFile();
        MatrixCursor cursor = new MatrixCursor(projection);
        Object[] fila = new Object[projection.length];
        for (int i = 0; i < projection.length; i++) {
            if ("_display_name".equals(projection[i])) {
                fila[i] = "PuenteZebra-Movil-actualizacion.apk";
            } else if ("_size".equals(projection[i])) {
                fila[i] = f.exists() ? Long.valueOf(f.length()) : Long.valueOf(0L);
            } else {
                fila[i] = null;
            }
        }
        cursor.addRow(fila);
        return cursor;
    }
}
