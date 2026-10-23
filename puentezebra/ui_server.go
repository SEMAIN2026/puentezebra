package main

import (
        "errors"
        "fmt"
        "strings"
        "sync"

        "github.com/lxn/walk"
        . "github.com/lxn/walk/declarative"
)

// ---------------- SERVIDOR (tu PC, donde está la ZD220) ----------------

type serverState struct {
        mu sync.Mutex
        ln interface{ Close() error }
}

func runServerUI(cfg *Config, startHidden bool) {
        var mw *walk.MainWindow
        var cbPrinter *walk.ComboBox
        var nePort *walk.NumberEdit
        var cbxAuto *walk.CheckBox
        var teLog *walk.TextEdit
        var lblStatus *walk.Label
        var lblIP *walk.Label

        printers := listPrinters()
        if cfg.PrinterName == "" {
                if z := pickZebra(printers); z != "" {
                        cfg.PrinterName = z
                } else {
                        cfg.PrinterName = defaultPrinterName()
                }
        }
        model := append([]string{}, printers...)
        if cfg.PrinterName != "" && !containsStr(model, cfg.PrinterName) {
                model = append(model, cfg.PrinterName)
        }
        if len(model) == 0 {
                model = []string{"(no hay impresoras instaladas)"}
        }
        selIdx := indexOfStr(model, cfg.PrinterName)
        if selIdx < 0 {
                selIdx = 0
        }

        ip := primaryIP()
        ipInfo := fmt.Sprintf("%s   (puerto %d)", ip, cfg.TCPPort)

        state := &serverState{}

        startListen := func() error {
                state.mu.Lock()
                defer state.mu.Unlock()
                if state.ln != nil {
                        state.ln.Close()
                        state.ln = nil
                }
                ln, err := startListener(fmt.Sprintf(":%d", cfg.TCPPort), onServerJob(cfg))
                if err != nil {
                        return err
                }
                state.ln = ln
                logf("Escuchando en el puerto %d — listo para recibir etiquetas de la red", cfg.TCPPort)
                return nil
        }

        refreshStatus := func(errText string) {
                mw.Synchronize(func() {
                        if errText != "" {
                                lblStatus.SetText("PROBLEMA: " + errText)
                                return
                        }
                        lblStatus.SetText(fmt.Sprintf("Escuchando en puerto %d — esperando etiquetas…", cfg.TCPPort))
                        lblIP.SetText(fmt.Sprintf("%s   (puerto %d)", ip, cfg.TCPPort))
                })
        }

        applyClicked := func() {
                cfg.PrinterName = cbPrinter.Text()
                if strings.HasPrefix(cfg.PrinterName, "(no hay") {
                        cfg.PrinterName = ""
                }
                cfg.TCPPort = int(nePort.Value())
                cfg.AutoStart = cbxAuto.Checked()
                if err := saveConfig(cfg); err != nil {
                        logf("Aviso: no se pudo guardar config.json: %v", err)
                }
                if err := setAutostart(cfg.AutoStart); err == nil {
                        if cfg.AutoStart {
                                logf("Autoarranque con Windows: activado")
                        } else {
                                logf("Autoarranque con Windows: desactivado")
                        }
                }
                if err := startListen(); err != nil {
                        refreshStatus(err.Error())
                        errorMsg(mw, err.Error())
                        return
                }
                refreshStatus("")
                infoMsg(mw, "Ajustes guardados.\n\nDale a tu compañero esta IP para el CLIENTE:\n\n        "+ip+"\n\n(puerto "+fmt.Sprint(cfg.TCPPort)+")")
        }

        testClicked := func() {
                go func() {
                        p := cfg.PrinterName
                        if p == "" || strings.HasPrefix(p, "(no hay") {
                                mw.Synchronize(func() {
                                        errorMsg(mw, "Primero elige tu impresora Zebra y dale a 'Aplicar cambios'.")
                                })
                                return
                        }
                        logf("Imprimiendo etiqueta de prueba local en '%s'…", p)
                        err := printRaw(p, []byte(testLabelZPL("Prueba local del SERVIDOR")))
                        mw.Synchronize(func() {
                                if err != nil {
                                        errorMsg(mw, "No se pudo imprimir:\n"+err.Error())
                                        return
                                }
                                infoMsg(mw, "¡Etiqueta enviada! Debe estar saliendo por tu ZD220.")
                        })
                }()
        }

        firewallClicked := func() {
                go func() {
                        port := cfg.TCPPort
                        logf("Abriendo el puerto %d en el Firewall (acepta la ventana de Windows)…", port)
                        err := runElevatedSelf("--tarea", "firewall")
                        mw.Synchronize(func() {
                                if err != nil {
                                        errorMsg(mw, err.Error())
                                        return
                                }
                                logf("Firewall configurado: el puerto %d quedó abierto para la red", port)
                                infoMsg(mw, "¡Listo! El puerto "+fmt.Sprint(port)+" quedó abierto.\n\nYa tu compañero puede conectarse con el CLIENTE.")
                        })
                }()
        }

        updateClicked := func() {
                dlg := walk.FileDialog{
                        Title:  "Elegir el archivo nuevo: PuenteZebra-SERVIDOR.exe",
                        Filter: "Programa actualizado (*.exe)|*.exe",
                }
                if ok, _ := dlg.ShowOpen(mw); !ok {
                        return
                }
                if err := updateFromFile(dlg.FilePath); err != nil {
                        errorMsg(mw, "No se pudo actualizar:\n"+err.Error())
                }
                // si funcionó, el programa se reinició solo
        }

        MW := MainWindow{
                AssignTo: &mw,
                Title:    "PuenteZebra SERVIDOR v" + version + " — tu PC con la ZD220",
                Icon:     appIcon(),
                MinSize:  Size{Width: 640, Height: 480},
                Size:     Size{Width: 720, Height: 560},
                Visible:  !startHidden,
                Layout:   VBox{Margins: Margins{Left: 12, Top: 10, Right: 12, Bottom: 10}, Spacing: 8},
                Children: []Widget{
                        GroupBox{Title: "Impresora y puerto", Layout: Grid{Columns: 2, Spacing: 8},
                                Children: []Widget{
                                        Label{Text: "Impresora Zebra:"},
                                        ComboBox{AssignTo: &cbPrinter, Model: model, CurrentIndex: selIdx},
                                        Label{Text: "Puerto de escucha:"},
                                        NumberEdit{AssignTo: &nePort, MinValue: 1, MaxValue: 65535, Decimals: 0, Value: float64(cfg.TCPPort)},
                                }},
                        Composite{Layout: HBox{MarginsZero: true, Spacing: 8}, Children: []Widget{
                                PushButton{Text: "Aplicar cambios", MinSize: Size{Width: 130}, OnClicked: applyClicked},
                                PushButton{Text: "Imprimir etiqueta de prueba", OnClicked: testClicked},
                                PushButton{Text: "Abrir en el Firewall", OnClicked: firewallClicked},
                                HSpacer{},
                        }},
                        GroupBox{Title: "Estado", Layout: Grid{Columns: 2, Spacing: 6}, Children: []Widget{
                                Label{Text: "Tu IP (dala al CLIENTE):"},
                                Label{AssignTo: &lblIP, Text: ipInfo},
                                Label{Text: "Servicio:"},
                                Label{AssignTo: &lblStatus, Text: "iniciando…"},
                                Label{Text: "Arranque:"},
                                CheckBox{AssignTo: &cbxAuto, Text: "Iniciar con Windows (queda junto al reloj)", Checked: cfg.AutoStart},
                        }},
                        GroupBox{Title: "Registro de actividad", Layout: VBox{}, Children: []Widget{
                                TextEdit{AssignTo: &teLog, ReadOnly: true, VScroll: true, MinSize: Size{Height: 150}},
                        }},
                        Composite{Layout: HBox{MarginsZero: true, Spacing: 8}, Children: []Widget{
                                PushButton{Text: "Actualizar desde un archivo nuevo…", OnClicked: updateClicked},
                                HSpacer{},
                                Label{Text: "Deja esta ventana abierta o minimízala. Ciérrala con la X y sigue funcionando junto al reloj.", TextColor: walk.RGB(110, 110, 110)},
                        }},
                },
        }

        if err := MW.Create(); err != nil {
                msgBoxNative("PuenteZebra", "No se pudo abrir la ventana: "+err.Error())
                return
        }
        hideOnClose(mw)

        trayExtra := func(menu *walk.Menu) {
                testAct := walk.NewAction()
                testAct.SetText("Imprimir etiqueta de prueba")
                testAct.Triggered().Attach(testClicked)
                menu.Actions().Add(testAct)

                fwAct := walk.NewAction()
                fwAct.SetText("Abrir en el Firewall")
                fwAct.Triggered().Attach(firewallClicked)
                menu.Actions().Add(fwAct)
        }
        if _, err := setupTray(mw, "PuenteZebra SERVIDOR — imprime etiquetas de la red", trayExtra); err != nil {
                logf("Aviso: sin icono en la bandeja: %v", err)
        }

        startLogPump(mw, teLog)

        // comprobar actualización por internet (si hay URL configurada)
        go func() {
                tmp, ver, err := checkRemoteUpdate(cfg.UpdateURL)
                if err != nil || tmp == "" {
                        return
                }
                logf("Existe la versión %s en la URL configurada — ya descargada", ver)
                mw.Synchronize(func() {
                        if confirmMsg(mw, "Se descargó la versión nueva "+ver+".\n\n¿Aplicarla ahora? El programa se reinicia solo.") {
                                if err := updateFromFile(tmp); err != nil {
                                        errorMsg(mw, "No se pudo actualizar:\n"+err.Error())
                                }
                        }
                })
        }()

        if err := startListen(); err != nil {
                refreshStatus(err.Error())
                infoMsg(mw, err.Error()+"\n\nCambia el puerto y dale a 'Aplicar cambios'.")
        } else {
                refreshStatus("")
                if cfg.PrinterName == "" {
                        logf("AVISO: no se encontró impresora. Instala el driver de Zebra y dale a 'Aplicar cambios'.")
                }
        }

        mw.Run()
}

// onServerJob procesa cada etiqueta que llega por la red.
func onServerJob(cfg *Config) func(data []byte, remote string) {
        return func(data []byte, remote string) {
                if len(data) == 0 {
                        logf("%s probó la conexión (OK)", remoteHost(remote))
                        return
                }
                p := cfg.PrinterName
                if p == "" || strings.HasPrefix(p, "(no hay") {
                        logf("Trabajo de %s (%d bytes) DESCARTADO: no hay impresora seleccionada. Elige una y dale a 'Aplicar cambios'.", remoteHost(remote), len(data))
                        return
                }
                logf("Etiqueta de %s: %d bytes → imprimiendo en '%s'", remoteHost(remote), len(data), p)
                if err := printRaw(p, data); err != nil {
                        logf("ERROR al imprimir: %v", err)
                        return
                }
                logf("OK: etiqueta enviada a la impresora")
        }
}

func remoteHost(remote string) string {
        if i := strings.LastIndex(remote, ":"); i > 0 {
                return remote[:i]
        }
        return remote
}

func containsStr(list []string, s string) bool { return indexOfStr(list, s) >= 0 }

func indexOfStr(list []string, s string) int {
        for i, v := range list {
                if v == s {
                        return i
                }
        }
        return -1
}

var errNoListener = errors.New("escucha no iniciada")
