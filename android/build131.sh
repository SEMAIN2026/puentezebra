#!/bin/bash
# Construye PuenteZebra Móvil v1.3.1 (paquete com.semain2026.puentezebramovil)
# v1.3.1: todos los métodos de PrintJob se llaman desde el hilo principal
# (fix del error "Must be called from the main thread" de la 1.3.0).
set -e

A=/home/z/my-project/android
BT=$A/sdk/android-14
JDK=$A/amazon-corretto-21.0.13.1.2-linux-x64
PLAT=$A/sdk/android-34/android.jar
APP=$A/app13
OUT=$A/build131
KEYS=$A/keys
KS=$KEYS/puentezebra.keystore
ALIAS=puentezebra
STOREPASS='PuenteZebra2026!firma'
VERSION_CODE=5
VERSION_NAME=1.3.1
APK_FINAL=$A/PuenteZebra-Movil-v1.3.1.apk

export JAVA_HOME=$JDK
export PATH=$JDK/bin:$BT:$PATH

rm -rf "$OUT"
mkdir -p "$OUT/classes" "$OUT/gen"

echo "[1/6] aapt2 compile"
aapt2 compile --dir "$APP/res" -o "$OUT/res.zip"

echo "[2/6] aapt2 link"
aapt2 link -o "$OUT/base.apk" \
  -I "$PLAT" \
  --manifest "$APP/AndroidManifest.xml" \
  --min-sdk-version 21 \
  --target-sdk-version 34 \
  --version-code $VERSION_CODE \
  --version-name $VERSION_NAME \
  --java "$OUT/gen" \
  "$OUT/res.zip"

echo "[3/6] javac"
javac -source 8 -target 8 -encoding UTF-8 \
  -bootclasspath "$PLAT" \
  -d "$OUT/classes" \
  "$OUT/gen/com/semain2026/puentezebramovil/R.java" \
  "$APP"/src/com/semain2026/puentezebramovil/*.java 2> "$OUT/javac.log" || {
    echo "--- errores de javac ---"; cat "$OUT/javac.log"; exit 1; }
grep -v -- '-source 8\|obsolete\|deprecat\|bootstrap' "$OUT/javac.log" | head -20 || true

echo "[4/6] d8 (r8.jar)"
find "$OUT/classes" -name '*.class' > "$OUT/classes.txt"
# shellcheck disable=SC2046
"$JDK/bin/java" -cp "$A/r8.jar" com.android.tools.r8.D8 --release --min-api 21 \
  --lib "$PLAT" --output "$OUT" $(cat "$OUT/classes.txt")

echo "[5/6] empaquetar + zipalign"
cd "$OUT"
rm -f base-aligned.apk
zip -q base.apk classes.dex
zipalign -f -p 4 base.apk base-aligned.apk

echo "[6/6] firmar"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -storepass "$STOREPASS" -keypass "$STOREPASS" \
    -alias $ALIAS -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=PuenteZebra Movil,O=SEMAIN2026,C=MX"
fi
apksigner sign --ks "$KS" --ks-pass "pass:$STOREPASS" --key-pass "pass:$STOREPASS" \
  --ks-key-alias $ALIAS --out "$APK_FINAL" base-aligned.apk
apksigner verify --print-certs "$APK_FINAL" | head -5

echo
echo "APK listo: $APK_FINAL"
ls -la "$APK_FINAL"
aapt2 dump badging "$APK_FINAL" | head -12
