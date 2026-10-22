package main

import (
        _ "embed"
        "os"
        "path/filepath"
        "strings"
        "time"

        "github.com/lxn/walk"
        "github.com/lxn/win"
)

//go:embed assets/icon.ico
var iconFileBytes []byte

var cachedIcon *walk.Icon

func appIcon() *walk.Icon {
        if cachedIcon != nil {
                return cachedIcon
        }
        tmp := filepath.Join(os.TempDir(), "PuenteZebra_icon.ico")
        if err := os.WriteFile(tmp, iconFileBytes, 0644); err == nil {
                if ic, err := walk.NewIconFromFile(tmp); err == nil {
                        cachedIcon = ic
                        return ic
                }
        }
        return nil
}

// setupTray crea el icono junto al reloj con su menú.
func setupTray(mw *walk.MainWindow, tooltip string, extra func(menu *walk.Menu)) (*walk.NotifyIcon, error) {
        nic, err := walk.NewNotifyIcon(mw)
        if err != nil {
                return nil, err
        }
        if ic := appIcon(); ic != nil {
                nic.SetIcon(ic)
        }
        nic.SetToolTip(tooltip)

        openAct := walk.NewAction()
        openAct.SetText("Abrir panel")
        openAct.Triggered().Attach(func() {
                mw.Show()
                mw.SetVisible(true)
                mw.Activate()
        })
        nic.ContextMenu().Actions().Add(openAct)

        if extra != nil {
                extra(nic.ContextMenu())
        }

        sepAct := walk.NewSeparatorAction()
        nic.ContextMenu().Actions().Add(sepAct)

        exitAct := walk.NewAction()
        exitAct.SetText("Salir")
        exitAct.Triggered().Attach(func() {
                walk.App().Exit(0)
        })
        nic.ContextMenu().Actions().Add(exitAct)

        nic.SetVisible(true)
        return nic, nil
}

// startLogPump refresca el cuadro de registro con lo que va pasando (cada 0.8 s).
func startLogPump(mw *walk.MainWindow, te *walk.TextEdit) {
        go func() {
                lastSeq := 0
                ticker := time.NewTicker(800 * time.Millisecond)
                defer ticker.Stop()
                for range ticker.C {
                        lines, seq := logSnapshot(lastSeq)
                        if len(lines) == 0 {
                                continue
                        }
                        lastSeq = seq
                        text := strings.Join(lines, "\r\n") + "\r\n"
                        mw.Synchronize(func() {
                                if te == nil {
                                        return
                                }
                                cur := te.Text()
                                if len(cur) > 80000 {
                                        cur = cur[len(cur)-40000:]
                                        if i := strings.Index(cur, "\n"); i > 0 {
                                                cur = cur[i+1:]
                                        }
                                }
                                te.SetText(cur + text)
                                te.SendMessage(win.WM_VSCROLL, win.SB_BOTTOM, 0)
                        })
                }
        }()
}

// minUIThread: helpers para mensajes comunes (siempre en el hilo de la interfaz).
func infoMsg(mw *walk.MainWindow, text string) {
        walk.MsgBox(mw, "PuenteZebra", text, walk.MsgBoxIconInformation|walk.MsgBoxOK)
}

func errorMsg(mw *walk.MainWindow, text string) {
        walk.MsgBox(mw, "PuenteZebra", text, walk.MsgBoxIconError|walk.MsgBoxOK)
}

func confirmMsg(mw *walk.MainWindow, text string) bool {
        return walk.MsgBox(mw, "PuenteZebra", text, walk.MsgBoxIconQuestion|walk.MsgBoxYesNo) == win.IDYES
}

func hideOnClose(mw *walk.MainWindow) {
        mw.Closing().Attach(func(canceled *bool, reason walk.CloseReason) {
                *canceled = true
                mw.Hide()
        })
}
