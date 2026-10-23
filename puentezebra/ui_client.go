package main

import (
        "fmt"
        "os"
        "path/filepath"
        "strings"
        "sync"

        "github.com/lxn/walk"
        . "github.com/lxn/walk/declarative"
)

// ---------------- CLIENTE (PC del compañero) ----------------

type clientState struct {
        mu sync.Mutex
        ln interface{ Close() error }
}

func runClientUI(cfg *Config, startHidden bool) {
        var mw *walk.MainWindow
        var leIP *walk.LineEdit
        var nePort *walk.NumberEdit
        var neLocal *walk.NumberEdit
        var cbxAuto *walk.CheckBox
        var cbxWrap *walk.CheckBox
        var teLog *walk.TextEdit
        var teText *walk.TextEdit
        var lblStatus *walk.Label

        state := &clientState{}

        startLocalListen := func() error {
                state.mu.Lock()
                defer state.mu.Unlock()
                if state.ln != nil {
                        state.ln.Close()
                        state.ln = nil
                }
                ln, err := startListener(fmt.Sprintf("127.0.0.1:%d", cfg.ClientPort), onClientForward(cfg))
                if err != nil {
                        return err
                }
                state.ln = ln
                logf("Impresora virtual conectada al puerto local %d → %s:%d", cfg.ClientPort, cfg.ServerIP, cfg.TCPPort)
                return nil
        }

        setStatus := func(ok bool, msg string) {
                mw.Synchronize(func() {
                        if ok {
                                lblStatus.SetTextColor(walk.RGB(0, 128, 0))
                        } else {
                                lblStatus.SetTextColor(walk.RGB(190, 30, 30))
                        }
                        lblStatus.SetText(msg)
                })
        }

        applyClicked := func() {
                cfg.ServerIP = strings.TrimSpace(leIP.Text())
                cfg.TCPPort = int(nePort.Value())
                cfg.ClientPort = int(neLocal.Value())
                cfg.AutoStart = cbxAuto.Checked()
                cfg.WrapText = cbxWrap.Checked()
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
                if err := startLocalListen(); err != nil {
                        logf("Aviso: %v", err)
                }
                logf("Ajustes guardados.")
                setStatus(true, "Ajustes guardados. IP guardada: "+cfg.ServerIP)
                infoMsg(mw, "Ajustes guardados.")
        }

        testClicked := func() {
                go func() {
                        ip := strings.TrimSpace(leIP.Text())
                        port := int(nePort.Value())
                        logf("Probando conexión con %s:%d…", ip, port)
                        err := testConnection(ip, port)
                        if err != nil {
                                setStatus(false, "SIN CONEXIÓN: "+err.Error())
                                mw.Synchronize(func() { errorMsg(mw, err.Error()) })
                                return
                        }
                        setStatus(true, "CONEXIÓN OK con "+ip+":"+fmt.Sprint(port))
                        mw.Synchronize(func() {
                                infoMsg(mw, "¡Conexión exitosa con tu computadora!\n\nYa puedes imprimir etiquetas de prueba o instalar la impresora virtual.")
                        })
                }()
        }

        printTestClicked := func() {
                go func() {
                        ip := strings.TrimSpace(leIP.Text())
                        port := int(nePort.Value())
                        logf("Enviando etiqueta de prueba a %s:%d…", ip, port)
                        err := sendData(ip, port, []byte(testLabelZPL("Prueba desde el CLIENTE")))
                        if err != nil {
                                mw.Synchronize(func() { errorMsg(mw, err.Error()) })
                                return
                        }
                        logf("OK: etiqueta de prueba enviada. Debe salir en la ZD220 de tu compañero.")
                        mw.Synchronize(func() {
                                infoMsg(mw, "Etiqueta enviada. Si todo está bien, saldrá impresa en la ZD220 en unos segundos.")
                        })
                }()
        }

        sendFileClicked := func() {
                dlg := walk.FileDialog{
                        Title:  "Elegir etiqueta a imprimir",
                        Filter: "Etiquetas (*.zpl;*.prn;*.txt)|*.zpl;*.prn;*.txt|Todos los archivos (*.*)|*.*",
                }
                if ok, _ := dlg.ShowOpen(mw); !ok {
                        return
                }
                go func() {
                        path := dlg.FilePath
                        data, err := os.ReadFile(path)
                        if err != nil {
                                mw.Synchronize(func() { errorMsg(mw, "No se pudo leer el archivo:\n"+err.Error()) })
                                return
                        }
                        if len(data) == 0 {
                                mw.Synchronize(func() { errorMsg(mw, "El archivo está vacío.") })
                                return
                        }
                        out := prepareOutgoing(data, filepath.Base(path), cfg.WrapText)
                        logf("Enviando '%s' (%d bytes) a %s:%d…", filepath.Base(path), len(out), cfg.ServerIP, cfg.TCPPort)
                        if err := sendData(cfg.ServerIP, cfg.TCPPort, out); err != nil {
                                mw.Synchronize(func() { errorMsg(mw, err.Error()) })
                                return
                        }
                        logf("OK: archivo enviado.")
                        mw.Synchronize(func() {
                                infoMsg(mw, "Archivo enviado a la impresora.")
                        })
                }()
        }

        sendTextClicked := func() {
                go func() {
                        text := teText.Text()
                        if strings.TrimSpace(text) == "" {
                                mw.Synchronize(func() { errorMsg(mw, "Escribe primero el texto de la etiqueta.") })
                                return
                        }
                        var out []byte
                        if cfg.WrapText {
                                out = []byte(wrapTextAsZPL(text))
                        } else {
                                out = []byte(text)
                        }
                        logf("Enviando texto (%d bytes) a %s:%d…", len(out), cfg.ServerIP, cfg.TCPPort)
                        if err := sendData(cfg.ServerIP, cfg.TCPPort, out); err != nil {
                                mw.Synchronize(func() { errorMsg(mw, err.Error()) })
                                return
                        }
                        mw.Synchronize(func() {
                                teText.SetText("")
                                infoMsg(mw, "Texto enviado a la impresora.")
                        })
                }()
        }

        installPrinterClicked := func() {
                go func() {
                        ip := strings.TrimSpace(leIP.Text())
                        if ip == "" {
                                mw.Synchronize(func() {
                                        errorMsg(mw, "Escribe primero la IP de tu computadora (Servidor) y dale a 'Aplicar cambios'.")
                                })
                                return
                        }
                        cfg.ServerIP = ip
                        cfg.TCPPort = int(nePort.Value())
                        cfg.ClientPort = int(neLocal.Value())
                        saveConfig(cfg)
                        if err := startLocalListen(); err != nil {
                                logf("Aviso: %v", err)
                        }
                        logf("Instalando la impresora virtual 'Zebra ZD220 (Red)' (acepta la ventana de permisos)…")
                        err := runElevatedSelf("--tarea", "instalar-impresora")
                        if err != nil {
                                mw.Synchronize(func() { errorMsg(mw, err.Error()) })
                                return
                        }
                        logf("OK: impresora virtual instalada. Aparece en 'Dispositivos e impresoras' como: %s", virtualPrinterName)
                        mw.Synchronize(func() {
                                infoMsg(mw, "¡Impresora virtual instalada!\n\nEn Word, Excel o cualquier programa elige la impresora:\n\n        "+virtualPrinterName+"\n\nLo que se imprima ahí llegará a la ZD220 de tu compañero.\n\nConsejo: imprime una etiqueta de prueba desde ahí.")
                        })
                }()
        }

        removePrinterClicked := func() {
                go func() {
                        mw.Synchronize(func() {
                                if !confirmMsg(mw, "¿Quitar la impresora virtual de esta computadora?") {
                                        return
                                }
                                go func() {
                                        err := runElevatedSelf("--tarea", "quitar-impresora")
                                        mw.Synchronize(func() {
                                                if err != nil {
                                                        errorMsg(mw, err.Error())
                                                        return
                                                }
                                                logf("Impresora virtual quitada.")
                                                infoMsg(mw, "Impresora virtual quitada.")
                                        })
                                }()
                        })
                }()
        }

        updateClicked := func() {
                dlg := walk.FileDialog{
                        Title:  "Elegir el archivo nuevo: PuenteZebra-CLIENTE.exe",
                        Filter: "Programa actualizado (*.exe)|*.exe",
                }
                if ok, _ := dlg.ShowOpen(mw); !ok {
                        return
                }
                if err := updateFromFile(dlg.FilePath); err != nil {
                        errorMsg(mw, "No se pudo actualizar:\n"+err.Error())
                }
        }

        MW := MainWindow{
                AssignTo: &mw,
                Title:    "PuenteZebra CLIENTE v" + version + " — imprime en la ZD220 de tu compañero",
                Icon:     appIcon(),
                MinSize:  Size{Width: 660, Height: 560},
                Size:     Size{Width: 740, Height: 640},
                Visible:  !startHidden,
                Layout:   VBox{Margins: Margins{Left: 12, Top: 10, Right: 12, Bottom: 10}, Spacing: 8},
                Children: []Widget{
                        GroupBox{Title: "1) Conexión con tu computadora (Servidor)", Layout: Grid{Columns: 2, Spacing: 8},
                                Children: []Widget{
                                        Label{Text: "IP del SERVIDOR:"},
                                        LineEdit{AssignTo: &leIP, CueBanner: "Ejemplo: 192.168.1.50", Text: cfg.ServerIP},
                                        Label{Text: "Puerto del SERVIDOR:"},
                                        NumberEdit{AssignTo: &nePort, MinValue: 1, MaxValue: 65535, Decimals: 0, Value: float64(cfg.TCPPort)},
                                }},
                        Composite{Layout: HBox{MarginsZero: true, Spacing: 8}, Children: []Widget{
                                PushButton{Text: "Aplicar cambios", MinSize: Size{Width: 130}, OnClicked: applyClicked},
                                PushButton{Text: "Probar conexión", OnClicked: testClicked},
                                PushButton{Text: "Etiqueta de prueba", OnClicked: printTestClicked},
                                HSpacer{},
                        }},
                        Composite{Layout: VBox{MarginsZero: true}, Children: []Widget{
                                Label{AssignTo: &lblStatus, Text: "Escribe la IP y dale a 'Probar conexión'."},
                        }},
                        GroupBox{Title: "2) Impresora virtual (para imprimir desde cualquier programa)", Layout: VBox{Spacing: 6},
                                Children: []Widget{
                                        Composite{Layout: HBox{MarginsZero: true, Spacing: 8}, Children: []Widget{
                                                PushButton{Text: "Instalar impresora virtual", MinSize: Size{Width: 170}, OnClicked: installPrinterClicked},
                                                PushButton{Text: "Quitar impresora virtual", OnClicked: removePrinterClicked},
                                                HSpacer{},
                                        }},
                                        Label{Text: "Crea la impresora \"" + virtualPrinterName + "\" en Windows. Al imprimir ahí (Word, Excel, tu sistema…), la etiqueta sale en la ZD220.", TextColor: walk.RGB(110, 110, 110)},
                                        Composite{Layout: HBox{MarginsZero: true, Spacing: 8}, Children: []Widget{
                                                Label{Text: "Puerto local:"},
                                                NumberEdit{AssignTo: &neLocal, MinValue: 1024, MaxValue: 65535, Decimals: 0, Value: float64(cfg.ClientPort)},
                                                Label{Text: "(no tocar salvo que lo indiques)", TextColor: walk.RGB(150, 150, 150)},
                                                HSpacer{},
                                        }},
                                }},
                        GroupBox{Title: "3) Envío rápido de etiquetas (por si acaso)", Layout: VBox{Spacing: 6},
                                Children: []Widget{
                                        Composite{Layout: HBox{MarginsZero: true, Spacing: 8}, Children: []Widget{
                                                PushButton{Text: "Enviar archivo…", OnClicked: sendFileClicked},
                                                PushButton{Text: "Enviar texto de arriba", OnClicked: sendTextClicked},
                                                CheckBox{AssignTo: &cbxWrap, Text: "Convertir texto a etiqueta", Checked: cfg.WrapText},
                                                HSpacer{},
                                        }},
                                        TextEdit{AssignTo: &teText, VScroll: true, MinSize: Size{Height: 60}},
                                }},
                        GroupBox{Title: "Registro de actividad", Layout: VBox{}, Children: []Widget{
                                TextEdit{AssignTo: &teLog, ReadOnly: true, VScroll: true, MinSize: Size{Height: 120}},
                        }},
                        Composite{Layout: HBox{MarginsZero: true, Spacing: 8}, Children: []Widget{
                                PushButton{Text: "Actualizar desde un archivo nuevo…", OnClicked: updateClicked},
                                CheckBox{AssignTo: &cbxAuto, Text: "Iniciar con Windows", Checked: cfg.AutoStart},
                                HSpacer{},
                                Label{Text: "Minimízalo con la X: sigue funcionando junto al reloj.", TextColor: walk.RGB(110, 110, 110)},
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
                testAct.SetText("Etiqueta de prueba")
                testAct.Triggered().Attach(printTestClicked)
                menu.Actions().Add(testAct)

                insAct := walk.NewAction()
                insAct.SetText("Instalar impresora virtual")
                insAct.Triggered().Attach(installPrinterClicked)
                menu.Actions().Add(insAct)
        }
        if _, err := setupTray(mw, "PuenteZebra CLIENTE — imprime en la ZD220 de tu compañero", trayExtra); err != nil {
                logf("Aviso: sin icono en la bandeja: %v", err)
        }

        startLogPump(mw, teLog)

        // actualización por internet si hay URL configurada
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

        if cfg.ServerIP != "" {
                setStatus(true, "IP guardada: "+cfg.ServerIP+" — dale a 'Probar conexión' para verificar.")
        }
        if err := startLocalListen(); err != nil {
                logf("Aviso: %v", err)
        }

        mw.Run()
}

// onClientForward reenvía a la PC del SERVIDOR todo lo que la impresora virtual manda al puerto local.
func onClientForward(cfg *Config) func(data []byte, remote string) {
        return func(data []byte, remote string) {
                if len(data) == 0 {
                        logf("La impresora virtual probó el puerto local (OK)")
                        return
                }
                logf("Trabajo de la impresora virtual: %d bytes → enviando a %s:%d", len(data), cfg.ServerIP, cfg.TCPPort)
                if cfg.ServerIP == "" {
                        logf("ERROR: falta la IP del SERVIDOR. Escríbela y dale a 'Aplicar cambios'.")
                        return
                }
                if err := sendData(cfg.ServerIP, cfg.TCPPort, data); err != nil {
                        logf("ERROR al reenviar: %v", err)
                        return
                }
                logf("OK: trabajo entregado al SERVIDOR")
        }
}
