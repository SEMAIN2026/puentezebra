package main

import (
        "fmt"
        "strings"
        "syscall"
        "time"
        "unsafe"

        "golang.org/x/sys/windows"
)

// Impresión RAW vía el spooler de Windows (winspool.drv).
// Esto manda los bytes tal cual a la impresora Zebra: si son ZPL, la etiqueta sale perfecta.

var (
        modwinspool          = windows.NewLazySystemDLL("winspool.drv")
        procOpenPrinterW     = modwinspool.NewProc("OpenPrinterW")
        procClosePrinter     = modwinspool.NewProc("ClosePrinter")
        procStartDocPrinterW = modwinspool.NewProc("StartDocPrinterW")
        procEndDocPrinter    = modwinspool.NewProc("EndDocPrinter")
        procStartPagePrinter = modwinspool.NewProc("StartPagePrinter")
        procEndPagePrinter   = modwinspool.NewProc("EndPagePrinter")
        procWritePrinter     = modwinspool.NewProc("WritePrinter")
        procEnumPrintersW    = modwinspool.NewProc("EnumPrintersW")
        procGetDefaultPrinterW = modwinspool.NewProc("GetDefaultPrinterW")
)

type docInfo1W struct {
        DocName    *uint16
        OutputFile *uint16
        Datatype   *uint16
}

type printerInfo4W struct {
        PrinterName *uint16
        ServerName  *uint16
        Attributes  uint32
}

func utf16PtrOf(s string) *uint16 {
        p, _ := syscall.UTF16PtrFromString(s)
        return p
}

// printRaw envía datos en crudo a la impresora indicada (usando su driver instalado).
func printRaw(printerName string, data []byte) error {
        if len(data) == 0 {
                return fmt.Errorf("no llegó nada para imprimir")
        }
        if printerName == "" {
                return fmt.Errorf("no hay impresora seleccionada")
        }

        var h syscall.Handle
        r1, _, callErr := procOpenPrinterW.Call(
                uintptr(unsafe.Pointer(utf16PtrOf(printerName))),
                uintptr(unsafe.Pointer(&h)),
                0,
        )
        if r1 == 0 {
                return fmt.Errorf("no se pudo abrir la impresora '%s' (%v). ¿Está encendida y conectada?", printerName, callErr)
        }
        defer procClosePrinter.Call(uintptr(h))

        di := docInfo1W{
                DocName:  utf16PtrOf("PuenteZebra " + time.Now().Format("15:04:05")),
                Datatype: utf16PtrOf("RAW"),
        }
        r1, _, callErr = procStartDocPrinterW.Call(uintptr(h), 1, uintptr(unsafe.Pointer(&di)))
        if r1 == 0 {
                return fmt.Errorf("el spooler rechazó el trabajo (%v)", callErr)
        }
        defer procEndDocPrinter.Call(uintptr(h))

        r1, _, callErr = procStartPagePrinter.Call(uintptr(h))
        if r1 == 0 {
                return fmt.Errorf("no se pudo iniciar la página (%v)", callErr)
        }

        var written uint32
        r1, _, callErr = procWritePrinter.Call(
                uintptr(h),
                uintptr(unsafe.Pointer(&data[0])),
                uintptr(len(data)),
                uintptr(unsafe.Pointer(&written)),
        )
        if r1 == 0 {
                return fmt.Errorf("fallo al escribir en la impresora (%v)", callErr)
        }
        procEndPagePrinter.Call(uintptr(h))

        return nil
}

// listPrinters devuelve los nombres de las impresoras instaladas en Windows.
func listPrinters() []string {
        const flags = 6 // PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS
        var needed, returned uint32
        procEnumPrintersW.Call(flags, 0, 4, 0, 0,
                uintptr(unsafe.Pointer(&needed)), uintptr(unsafe.Pointer(&returned)))
        if needed == 0 {
                return nil
        }
        buf := make([]byte, needed)
        r1, _, _ := procEnumPrintersW.Call(flags, 0, 4,
                uintptr(unsafe.Pointer(&buf[0])), uintptr(needed),
                uintptr(unsafe.Pointer(&needed)), uintptr(unsafe.Pointer(&returned)))
        if r1 == 0 {
                return nil
        }
        infos := (*[1024]printerInfo4W)(unsafe.Pointer(&buf[0]))[:returned:returned]
        names := make([]string, 0, returned)
        for _, pi := range infos {
                if s := utf16PtrToString(pi.PrinterName); s != "" {
                        names = append(names, s)
                }
        }
        return names
}

func defaultPrinterName() string {
        var n uint32
        procGetDefaultPrinterW.Call(0, uintptr(unsafe.Pointer(&n)))
        if n == 0 {
                return ""
        }
        buf := make([]uint16, n)
        r1, _, _ := procGetDefaultPrinterW.Call(uintptr(unsafe.Pointer(&buf[0])), uintptr(unsafe.Pointer(&n)))
        if r1 == 0 {
                return ""
        }
        return syscall.UTF16ToString(buf)
}

func utf16PtrToString(p *uint16) string {
        if p == nil {
                return ""
        }
        n := 0
        for ptr := p; *ptr != 0; ptr = (*uint16)(unsafe.Pointer(uintptr(unsafe.Pointer(ptr)) + 2)) {
                n++
        }
        return syscall.UTF16ToString((*[(1 << 30) - 1]uint16)(unsafe.Pointer(p))[:n:n])
}

// pickZebra elige la impresora más parecida a una Zebra de la lista.
func pickZebra(names []string) string {
        for _, n := range names {
                ln := lower(n)
                if strings.Contains(ln, "zd220") || strings.Contains(ln, "zd230") {
                        return n
                }
        }
        for _, n := range names {
                if strings.Contains(lower(n), "zdesigner") || strings.Contains(lower(n), "zebra") {
                        return n
                }
        }
        return ""
}

func lower(s string) string {
        b := []byte(s)
        for i := range b {
                if b[i] >= 'A' && b[i] <= 'Z' {
                        b[i] += 32
                }
        }
        return string(b)
}
