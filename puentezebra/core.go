package main

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// ---------- configuración ----------

// Config se guarda en config.json junto al .exe (o en %APPDATA% si la carpeta no permite escribir).
type Config struct {
	ServerIP    string `json:"ip_servidor"`
	TCPPort     int    `json:"puerto_servidor"` // puerto donde escucha el SERVIDOR (9100)
	ClientPort  int    `json:"puerto_local"`    // puerto local del CLIENTE para la impresora virtual (9101)
	PrinterName string `json:"impresora"`
	AutoStart   bool   `json:"autoarranque"`
	WrapText    bool   `json:"envolver_texto"`
	UpdateURL   string `json:"url_actualizacion"`
}

const (
	defaultServerPort = 9100
	defaultClientPort = 9101
)

func exeDir() string {
	p, err := os.Executable()
	if err != nil {
		return "."
	}
	return filepath.Dir(p)
}

func selfExePath() string {
	p, err := os.Executable()
	if err != nil {
		return ""
	}
	return filepath.Clean(p)
}

func filepathBase(p string) string { return filepath.Base(p) }

func configPath() string {
	p := filepath.Join(exeDir(), "config.json")
	if f, err := os.OpenFile(p, os.O_WRONLY|os.O_CREATE, 0666); err == nil {
		f.Close()
		return p
	}
	base, err := os.UserConfigDir()
	if err != nil {
		base = os.TempDir()
	}
	d := filepath.Join(base, "PuenteZebra")
	os.MkdirAll(d, 0755)
	return filepath.Join(d, "config.json")
}

func loadConfig() *Config {
	c := &Config{
		TCPPort:    defaultServerPort,
		ClientPort: defaultClientPort,
		WrapText:   true,
		AutoStart:  true,
	}
	if data, err := os.ReadFile(configPath()); err == nil {
		json.Unmarshal(data, c)
	}
	if c.TCPPort <= 0 || c.TCPPort > 65535 {
		c.TCPPort = defaultServerPort
	}
	if c.ClientPort <= 0 || c.ClientPort > 65535 {
		c.ClientPort = defaultClientPort
	}
	c.ServerIP = strings.TrimSpace(c.ServerIP)
	return c
}

func saveConfig(c *Config) error {
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(configPath(), data, 0644)
}

// ---------- registro de actividad (log) ----------

var (
	logMu    sync.Mutex
	logLines []string
	logSeq   int
	logFile  *os.File
)

func initLogFile(m string) {
	base, err := os.UserCacheDir()
	if err != nil {
		return
	}
	dir := filepath.Join(base, "PuenteZebra")
	os.MkdirAll(dir, 0755)
	f, err := os.OpenFile(filepath.Join(dir, "log-"+modeName(m)+".txt"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return
	}
	logFile = f
	fmt.Fprintln(logFile, "---- sesión iniciada "+time.Now().Format("02/01/2006 15:04:05")+" ----")
}

func logf(format string, args ...interface{}) {
	line := time.Now().Format("02/01/2006 15:04:05") + "   " + fmt.Sprintf(format, args...)
	logMu.Lock()
	logLines = append(logLines, line)
	if len(logLines) > 400 {
		logLines = logLines[len(logLines)-400:]
	}
	logSeq++
	if logFile != nil {
		fmt.Fprintln(logFile, line)
	}
	logMu.Unlock()
}

// logSnapshot devuelve las líneas nuevas desde lastSeq (o todas si lastSeq==0).
func logSnapshot(lastSeq int) ([]string, int) {
	logMu.Lock()
	defer logMu.Unlock()
	seq := logSeq
	if lastSeq == 0 {
		return append([]string(nil), logLines...), seq
	}
	n := logSeq - lastSeq
	if n <= 0 {
		return nil, seq
	}
	if n > len(logLines) {
		n = len(logLines)
	}
	return append([]string(nil), logLines[len(logLines)-n:]...), seq
}

// ---------- utilidades ----------

func fileExists(p string) bool {
	st, err := os.Stat(p)
	return err == nil && !st.IsDir()
}

func copyFile(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, data, 0755)
}

// primaryIP devuelve la IP local de la red (ej. 192.168.1.50) para mostrarla al usuario.
func primaryIP() string {
	if conn, err := net.Dial("udp", "8.8.8.8:80"); err == nil {
		if ip := conn.LocalAddr().(*net.UDPAddr).IP.String(); !strings.HasPrefix(ip, "127.") {
			conn.Close()
			return ip
		}
		conn.Close()
	}
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "(no encontrada)"
	}
	for _, a := range addrs {
		if ipn, ok := a.(*net.IPNet); ok && ipn.IP.To4() != nil && !ipn.IP.IsLoopback() {
			return ipn.IP.String()
		}
	}
	return "(no encontrada)"
}

func openURL(url string) {
	url = strings.TrimSpace(url)
	if url == "" {
		return
	}
	exec := os.Getenv("ComSpec")
	if exec == "" {
		exec = "cmd.exe"
	}
	cmd := newCmd(exec, "/c", "start", "", url)
	cmd.Start()
}
