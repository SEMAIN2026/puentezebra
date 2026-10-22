package main

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"syscall"
)

// Este archivo hace las cosas que piden permisos de Windows (una sola vez):
//  - abrir el puerto en el Firewall
//  - crear/quitar la impresora virtual en la PC del compañero
// El truco: el propio programa se relanza a sí mismo como administrador (UAC)
// con un modo especial "--tarea", hace el trabajo y se cierra.

const virtualPrinterName = "Zebra ZD220 (Red)"
const virtualPortName = "ZBridgeLocal"

// newCmd crea un exec.Cmd sin ventana negra de MS-DOS.
func newCmd(name string, args ...string) *exec.Cmd {
	cmd := exec.Command(name, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd
}

// runElevatedSelf relanza este exe como administrador para ejecutar una tarea.
func runElevatedSelf(args ...string) error {
	resultFile := os.TempDir() + "\\PuenteZebra_tarea.txt"
	os.Remove(resultFile)

	all := append(append([]string{}, args...), "--resultado", resultFile)
	quoted := make([]string, len(all))
	for i, a := range all {
		quoted[i] = "'" + strings.ReplaceAll(a, "'", "''") + "'"
	}
	self := strings.ReplaceAll(selfExePath(), "'", "''")
	cmdStr := fmt.Sprintf("$p = Start-Process -FilePath '%s' -ArgumentList @(%s) -Verb RunAs -Wait -PassThru; exit $p.ExitCode",
		self, strings.Join(quoted, ","))

	ps := newCmd("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmdStr)
	out, err := ps.CombinedOutput()
	if err != nil {
		so := strings.TrimSpace(string(out))
		if strings.Contains(so, "cancelada por el usuario") || strings.Contains(strings.ToLower(so), "canceled") || strings.Contains(strings.ToLower(so), "cancelled") {
			return errors.New("cancelaste la ventana de permisos de Windows (UAC). Vuelve a intentarlo y dale clic en Sí.")
		}
		return fmt.Errorf("Windows no dejó ejecutar la tarea con permisos: %v", err)
	}
	if data, rerr := os.ReadFile(resultFile); rerr == nil {
		msg := strings.TrimSpace(string(data))
		if strings.HasPrefix(msg, "ERROR:") {
			return errors.New(strings.TrimPrefix(msg, "ERROR: "))
		}
	}
	return nil
}

func writeTaskResult(path, msg string) {
	if path != "" {
		os.WriteFile(path, []byte(msg), 0644)
	}
}

// runMaintenanceTask se ejecuta SOLO dentro del proceso elevado (sin interfaz).
func runMaintenanceTask(tarea, resultPath string, cfg *Config) {
	var msg string
	switch tarea {
	case "firewall":
		msg = taskFirewall(cfg.TCPPort)
	case "instalar-impresora":
		msg = taskInstallVirtualPrinter(cfg.ClientPort)
	case "quitar-impresora":
		msg = taskRemoveVirtualPrinter()
	default:
		msg = "ERROR: tarea desconocida: " + tarea
	}
	writeTaskResult(resultPath, msg)
}

func taskFirewall(port int) string {
	// limpiar reglas viejas con el mismo nombre (si existieran)
	newCmd("netsh", "advfirewall", "firewall", "delete", "rule", "name=PuenteZebra").Run()
	out, err := newCmd("netsh", "advfirewall", "firewall", "add", "rule",
		"name=PuenteZebra", "dir=in", "action=allow", "protocol=TCP",
		fmt.Sprintf("localport=%d", port)).CombinedOutput()
	if err != nil {
		return "ERROR: " + strings.TrimSpace(string(out))
	}
	return "OK: puerto " + fmt.Sprint(port) + " abierto en el Firewall"
}

func taskInstallVirtualPrinter(port int) string {
	script := fmt.Sprintf(`
$ErrorActionPreference = 'Stop'
$portName = '%s'
$prnName  = '%s'
$portNum  = %d
try {
  if (-not (Get-PrinterPort -Name $portName -ErrorAction SilentlyContinue)) {
    Add-PrinterPort -Name $portName -PrinterHostAddress '127.0.0.1' -PortNumber $portNum
  }
  $regPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Print\Monitors\Standard TCP/IP Port\Ports\' + $portName
  if (Test-Path $regPath) {
    Set-ItemProperty -Path $regPath -Name 'SNMP Status Enabled' -Value 0
  }
  Restart-Service Spooler -Force
  if (Get-Printer -Name $prnName -ErrorAction SilentlyContinue) { Remove-Printer -Name $prnName }
  $drvName = 'Generic / Text Only'
  $drv = Get-PrinterDriver -Name 'ZDesigner*' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($drv) { $drvName = $drv.Name }
  Add-Printer -Name $prnName -DriverName $drvName -PortName $portName
  Write-Output ('OK:' + $prnName + ' creada con driver ' + $drvName)
  exit 0
} catch {
  Write-Output ('ERROR: ' + $_.Exception.Message)
  exit 0
}`, virtualPortName, virtualPrinterName, port)

	out, err := newCmd("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script).CombinedOutput()
	if err != nil {
		return "ERROR: " + err.Error()
	}
	return strings.TrimSpace(string(out))
}

func taskRemoveVirtualPrinter() string {
	script := fmt.Sprintf(`
$ErrorActionPreference = 'Continue'
$prnName = '%s'
$portName = '%s'
if (Get-Printer -Name $prnName -ErrorAction SilentlyContinue) { Remove-Printer -Name $prnName }
Start-Sleep -Milliseconds 800
if (Get-PrinterPort -Name $portName -ErrorAction SilentlyContinue) { Remove-PrinterPort -Name $portName }
Write-Output 'OK: impresora virtual quitada'
exit 0`, virtualPrinterName, virtualPortName)

	out, err := newCmd("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script).CombinedOutput()
	if err != nil {
		return "ERROR: " + err.Error()
	}
	return strings.TrimSpace(string(out))
}

// ---------- autoarranque con Windows ----------

const runKey = `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`

func autostartValueName() string { return "PuenteZebra " + modeName(mode) }

func setAutostart(enable bool) error {
	if !enable {
		newCmd("reg", "delete", runKey, "/v", autostartValueName(), "/f").Run()
		return nil
	}
	data := `"` + selfExePath() + `" -minimizado`
	return newCmd("reg", "add", runKey, "/v", autostartValueName(), "/t", "REG_SZ", "/d", data, "/f").Run()
}

func autostartEnabled() bool {
	return newCmd("reg", "query", runKey, "/v", autostartValueName()).Run() == nil
}
