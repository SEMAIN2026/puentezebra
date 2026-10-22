// PuenteZebra — imprime desde la PC de un compañero hacia tu Zebra ZD220 por la red local.
// SERVIDOR = corre en la PC donde está conectada la impresora.
// CLIENTE  = corre en la PC del compañero (crea una impresora virtual de Windows).
package main

import (
        "flag"
        "runtime"
        "strings"
        "syscall"
        "time"
        "unsafe"

        "golang.org/x/sys/windows"
)

var (
        version     = "1.0.0"  // se fija al compilar con -ldflags
        defaultMode = "server" // se fija al compilar: "server" o "client"
        mode        = "server"
)

func main() {
        runtime.LockOSThread()

        var (
                fMode  = flag.String("modo", "", "servidor | cliente (normalmente no hace falta tocarlo)")
                fMin   = flag.Bool("minimizado", false, "arrancar oculto junto al reloj")
                fTarea = flag.String("tarea", "", "tarea interna con permisos: firewall | instalar-impresora | quitar-impresora")
                fRes   = flag.String("resultado", "", "archivo donde escribir el resultado de una tarea")
        )
        flag.Parse()

        // Las tareas internas corren en un proceso elevado (UAC) sin interfaz.
        if *fTarea != "" {
                cfg := loadConfig()
                runMaintenanceTask(*fTarea, *fRes, cfg)
                return
        }

        cleanupOldUpdate()

        mode = strings.ToLower(strings.TrimSpace(*fMode))
        if mode != "server" && mode != "client" {
                mode = defaultMode
        }

        cfg := loadConfig()
        initLogFile(mode)

        if !acquireSingleInstance(mode) {
                msgBoxNative("PuenteZebra ya está abierto",
                        "Ya hay un PuenteZebra ("+modeName(mode)+") funcionando en esta computadora.\n\nBúscalo junto al reloj: icono de impresora cerca de la hora.")
                return
        }

        logf("PuenteZebra v%s (%s) iniciado", version, modeName(mode))

        // Si dejaron un archivo de versión más nueva junto al programa, se actualiza solo.
        if upd := findLocalUpdate(); upd != "" {
                logf("Encontrada versión nueva junto al programa: %s", filepathBase(upd))
                if err := applyUpdateAndRestart(upd); err != nil {
                        logf("No se pudo actualizar automáticamente: %v", err)
                } else {
                        return
                }
        }

        if mode == "server" {
                runServerUI(cfg, *fMin)
        } else {
                runClientUI(cfg, *fMin)
        }
}

// ---------- instancia única ----------

var mtxHandle windows.Handle

// acquireSingleInstance reintenta unos segundos por si acabamos de actualizar
// (el proceso viejo libera el mutex justo antes de arrancarnos).
func acquireSingleInstance(m string) bool {
        name, _ := syscall.UTF16PtrFromString("Local\\PuenteZebra-" + m)
        for intento := 0; intento < 4; intento++ {
                h, err := windows.CreateMutex(nil, false, name)
                if err == nil {
                        mtxHandle = h
                        return true
                }
                if h != 0 {
                        windows.CloseHandle(h)
                }
                time.Sleep(400 * time.Millisecond)
        }
        return false
}

func releaseSingleInstance() {
        if mtxHandle != 0 {
                windows.ReleaseMutex(mtxHandle)
        }
}

// ---------- cuadro de mensaje sin ventana walk ----------

var (
        moduser32       = windows.NewLazySystemDLL("user32.dll")
        procMessageBoxW = moduser32.NewProc("MessageBoxW")
)

func msgBoxNative(title, text string) {
        tp, _ := syscall.UTF16PtrFromString(text)
        cp, _ := syscall.UTF16PtrFromString(title)
        procMessageBoxW.Call(0, uintptr(unsafe.Pointer(tp)), uintptr(unsafe.Pointer(cp)), 0x40)
}

func modeName(m string) string {
        if m == "server" {
                return "SERVIDOR"
        }
        return "CLIENTE"
}
