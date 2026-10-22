---
Task ID: 1
Agent: Z.ai (agente principal)
Task: Crear dos .exe de Windows (SERVIDOR + CLIENTE) para imprimir etiquetas desde la PC de un compañero hacia una Zebra ZD220 en red local, con impresora virtual y auto-actualización.

Work Log:
- Preguntas de clarificación al usuario (red, origen de impresión, driver ZD220, Windows, modalidad, autoarranque): misma red / de todo / ZD220 ya imprime / Win10-11 64b / impresora virtual / autoarranque.
- Entorno: descargado Go 1.27.3 a /home/z/my-project/tools/go (red OK, Go no venía preinstalado).
- Proyecto en /home/z/my-project/puentezebra: módulo Go con lxn/walk (GUI nativa Windows), lxn/win, x/sys.
- Núcleo: config.json portátil (core.go), impresión RAW vía winspool.drv (print.go), listener/sender TCP estilo JetDirect 9100/9101 (netx.go), helpers ZPL con ^FH_ y ^CI28 (zpl.go), auto-actualización por archivo/URL/escaneo de carpeta (update.go), tareas elevadas vía relanzamiento --tarea con UAC (admin.go): firewall netsh, instalación de impresora virtual con PowerShell (Add-PrinterPort 127.0.0.1:9101 + desactivar SNMP en registro + Generic/Text Only o ZDesigner), autoarranque HKCU Run (reg.exe).
- UIs walk con bandeja (NotifyIcon): ui_server.go (impresora, puerto, firewall, prueba, log) y ui_client.go (IP, prueba, envío archivos/texto, instalar/quitar impresora virtual, log).
- Icono generado con PIL (scripts/gen_icon.py) y recursos incrustados con akavel/rsrc (goversioninfo incompatible con linker de Go 1.27: 'unknown relocation type 7').
- Correcciones: -H=windowsgui (evitar consola negra), carrera de mutex en auto-actualización (releaseSingleInstance + reintento en acquireSingleInstance), Action.SetSeparator -> NewSeparatorAction, CueBanner no soportado en TextEdit/ComboBox declarative.
- go vet limpio; verificación estática PE (scripts/verify_exe.py): MZ, x64, subsistema GUI, .rsrc con manifiesto common-controls, cadenas embebidas → TODO OK.
- Empaquetado: /home/z/my-project/download/PuenteZebra-v1.0.0.zip (SERVIDOR.exe + CLIENTE.exe + LEEME.txt).

Stage Summary:
- Entregables: download/PuenteZebra-v1.0.0.zip con PuenteZebra-SERVIDOR.exe y PuenteZebra-CLIENTE.exe (10.6 MB c/u, Win 64 bits GUI) y LEEME.txt en español.
- Arquitectura: CLIENTE (PC compañero) impresora virtual 'Zebra ZD220 (Red)' → 127.0.0.1:9101 → reenvío TCP → SERVIDOR (PC usuario) :9100 → spooler RAW → driver ZD220.
- Auto-actualización: botón "Actualizar desde un archivo nuevo…", escaneo de carpeta (Nombre_vX.Y.Z.exe) y URL opcional en config.json; reemplazo self-rename + reinicio, sin desinstalar.
- Pendiente conocido: no hay pruebas en Windows real (entorno Linux); el flujo elevated-UAC y el spooler SNMP-off son los puntos con mayor riesgo a validar en sitio.
