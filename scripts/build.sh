#!/bin/bash
# Compila PuenteZebra-SERVIDOR.exe y PuenteZebra-CLIENTE.exe (Windows 64 bits)
set -e
export PATH=/home/z/my-project/tools/go/bin:$PATH
export GOMODCACHE=/home/z/my-project/tools/gomod
cd /home/z/my-project/puentezebra

echo "[1/4] Generando recursos (icono + manifest)..."
unset GOOS GOARCH
go run github.com/akavel/rsrc@v0.10.2 \
  -ico assets/icon.ico -manifest manifest.xml -arch amd64 \
  -o rsrc_windows_amd64.syso

echo "[2/4] Compilando SERVIDOR..."
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath \
  -ldflags "-s -w -H=windowsgui -X main.version=1.0.0 -X main.defaultMode=server" \
  -o dist/PuenteZebra-SERVIDOR.exe .

echo "[3/4] Compilando CLIENTE..."
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath \
  -ldflags "-s -w -H=windowsgui -X main.version=1.0.0 -X main.defaultMode=client" \
  -o dist/PuenteZebra-CLIENTE.exe .

echo "[4/4] Limpieza y resultado..."
rm -f rsrc_windows_amd64.syso
ls -la dist/
echo "OK"
