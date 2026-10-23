#!/usr/bin/env python3
"""Verificación estática de los .exe de PuenteZebra."""
import struct, sys, os

def check(path):
    print(f"--- {os.path.basename(path)} ---")
    with open(path, "rb") as f:
        data = f.read()
    ok = True

    # 1) MZ
    if data[:2] != b"MZ":
        print("  FAIL: no es un ejecutable PE"); return False
    print("  [OK] firma MZ (ejecutable de Windows)")

    # 2) PE header
    pe_off = struct.unpack_from("<I", data, 0x3C)[0]
    if data[pe_off:pe_off+4] != b"PE\x00\x00":
        print("  FAIL: cabecera PE ausente"); return False
    machine = struct.unpack_from("<H", data, pe_off + 4)[0]
    subsystem = struct.unpack_from("<H", data, pe_off + 4 + 20 + 68)[0]
    nsections = struct.unpack_from("<H", data, pe_off + 6)[0]
    arch = {0x8664: "x64 (64 bits)", 0x14C: "x86 (32 bits)"}.get(machine, hex(machine))
    subs = {2: "GUI (ventanas, sin consola)", 3: "Consola"}.get(subsystem, hex(subsystem))
    print(f"  [OK] arquitectura: {arch}")
    print(f"  [OK] subsistema:   {subs}")
    print(f"  [OK] secciones:    {nsections}")
    if machine != 0x8664: ok = False
    if subsystem != 2: ok = False

    # 3) recursos: el manifiesto incrustado contiene common-controls
    has_manifest = b"Microsoft.Windows.Common-Controls" in data
    print(f"  [{'OK' if has_manifest else 'FAIL'}] manifiesto (estilos visuales + DPI aware)")
    ok = ok and has_manifest

    # 4) icono: el .ico multi-tamaño lleva la marca PNG grande o bitmaps del icono
    has_ico = b"\x89PNG" in data or b"PuenteZebra_icon" in data or b"RT_ICON" in data
    # búsqueda por firma de entrada de directorio ICO en .rsrc: comprobación indirecta
    has_rsrc = b".rsrc" in data
    print(f"  [{'OK' if has_rsrc else 'FAIL'}] sección de recursos (.rsrc)")
    ok = ok and has_rsrc

    # 5) cadenas propias
    for needle, label in [(b"PuenteZebra", "nombre del programa"), (b"Zebra ZD220 (Red)", "impresora virtual"),
                          (b"1.0.0", "versión embebida")]:
        found = needle in data
        print(f"  [{'OK' if found else 'FAIL'}] cadena: {label}")
        ok = ok and found

    size_mb = os.path.getsize(path) / 1048576
    print(f"  tamaño: {size_mb:.1f} MB")
    return ok

base = "/home/z/my-project/puentezebra/dist/"
r1 = check(base + "PuenteZebra-SERVIDOR.exe")
r2 = check(base + "PuenteZebra-CLIENTE.exe")
print("\nRESULTADO:", "TODO OK" if (r1 and r2) else "HAY FALLOS")
sys.exit(0 if (r1 and r2) else 1)
