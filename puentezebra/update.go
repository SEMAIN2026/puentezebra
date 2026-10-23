package main

import (
        "errors"
        "fmt"
        "io"
        "net/http"
        "os"
        "path/filepath"
        "regexp"
        "strconv"
        "strings"
        "time"
)

// La auto-actualización NO desinstala ni reinstala nada:
//  1. "Actualizar desde un archivo nuevo…": eliges el .exe nuevo y el programa se reemplaza a sí mismo.
//  2. Si pones un archivo "Nombre_v1.2.3.exe" junto al programa, al arrancar lo detecta y se actualiza.
//  3. Si configuras una URL en config.json, descarga la versión nueva solo.

const oldSuffix = ".old"

var reVersionFile = regexp.MustCompile(`_v?(\d+(?:\.\d+){1,2})\.exe$`)

func compareVersions(a, b string) int {
        pa, pb := parseVersion(a), parseVersion(b)
        for i := 0; i < 3; i++ {
                if pa[i] != pb[i] {
                        if pa[i] > pb[i] {
                                return 1
                        }
                        return -1
                }
        }
        return 0
}

func parseVersion(s string) [3]int {
        var out [3]int
        s = strings.ToLower(strings.TrimSpace(s))
        s = strings.TrimPrefix(s, "v")
        if i := strings.IndexAny(s, "-_ "); i >= 0 {
                s = s[:i]
        }
        parts := strings.Split(s, ".")
        for i := 0; i < len(parts) && i < 3; i++ {
                out[i], _ = strconv.Atoi(strings.TrimSpace(parts[i]))
        }
        return out
}

func cleanupOldUpdate() {
        self := selfExePath()
        if self == "" {
                return
        }
        if old := self + oldSuffix; fileExists(old) {
                os.Remove(old)
        }
        os.Remove(filepath.Join(os.TempDir(), "PuenteZebra_nueva.exe"))
}

// findLocalUpdate busca "PuenteZebra-XXX_v1.2.3.exe" en la carpeta del programa.
func findLocalUpdate() string {
        self := selfExePath()
        if self == "" {
                return ""
        }
        base := strings.TrimSuffix(filepath.Base(self), ".exe")
        lbase := lower(base)
        ents, err := os.ReadDir(filepath.Dir(self))
        if err != nil {
                return ""
        }
        best := ""
        bestV := version
        for _, e := range ents {
                if e.IsDir() {
                        continue
                }
                name := e.Name()
                lname := lower(name)
                if !strings.HasPrefix(lname, lbase) || !strings.HasSuffix(lname, ".exe") {
                        continue
                }
                if strings.EqualFold(name, base+".exe") {
                        continue
                }
                m := reVersionFile.FindStringSubmatch(lname)
                if m == nil {
                        continue
                }
                if compareVersions(m[1], bestV) > 0 {
                        bestV = m[1]
                        best = filepath.Join(filepath.Dir(self), name)
                }
        }
        return best
}

// validateUpdateFile comprueba que el archivo parezca un PuenteZebra válido.
func validateUpdateFile(path string) error {
        st, err := os.Stat(path)
        if err != nil {
                return err
        }
        if st.Size() < 300*1024 {
                return errors.New("el archivo es demasiado pequeño para ser el programa")
        }
        f, err := os.Open(path)
        if err != nil {
                return err
        }
        defer f.Close()
        head := make([]byte, 2)
        if _, err := io.ReadFull(f, head); err != nil {
                return err
        }
        if head[0] != 'M' || head[1] != 'Z' {
                return errors.New("el archivo no es un programa de Windows (.exe)")
        }
        // buscar el nombre propio dentro del ejecutable (comprobación amable)
        chunk := make([]byte, 4*1024*1024)
        n, _ := io.ReadFull(f, chunk)
        if n <= 0 {
                return errors.New("no se pudo leer el archivo")
        }
        if !strings.Contains(lower(string(chunk[:n])), "puentezebra") {
                return errors.New("el archivo no parece ser PuenteZebra (elige el .exe correcto)")
        }
        return nil
}

// applyUpdateAndRestart reemplaza este programa por newExe y arranca la versión nueva.
func applyUpdateAndRestart(newExe string) error {
        self := selfExePath()
        if self == "" {
                return errors.New("no se pudo ubicar el programa actual")
        }
        if filepath.Clean(newExe) == filepath.Clean(self) {
                return errors.New("el archivo elegido ya es el programa actual")
        }
        if err := validateUpdateFile(newExe); err != nil {
                return err
        }
        // 1) renombrar el que está corriendo (Windows lo permite aunque esté abierto)
        if err := os.Rename(self, self+oldSuffix); err != nil {
                return fmt.Errorf("no se pudo apartar la versión vieja: %v", err)
        }
        // 2) poner el nuevo en su lugar con el mismo nombre
        if err := copyFile(newExe, self); err != nil {
                os.Rename(self+oldSuffix, self) // revertir
                return fmt.Errorf("no se pudo copiar la versión nueva: %v", err)
        }
        logf("Actualizado a %s — reiniciando…", filepathBase(newExe))
        // 3) soltar el "ya estoy abierto", arrancar la versión nueva y salir
        releaseSingleInstance()
        if err := startDetached(self); err != nil {
                return err
        }
        return nil
}

func startDetached(path string) error {
        cmd := newCmd(path)
        cmd.Dir = filepath.Dir(path)
        return cmd.Start()
}

// updateFromFile = botón "Actualizar desde un archivo nuevo…"
func updateFromFile(newExe string) error {
        err := applyUpdateAndRestart(newExe)
        if err == nil {
                os.Exit(0)
        }
        return err
}

// checkRemoteUpdate consulta <url>.version y si hay versión más nueva descarga <url>.
func checkRemoteUpdate(baseURL string) (downloadedTo, ver string, err error) {
        baseURL = strings.TrimSpace(baseURL)
        if baseURL == "" {
                return "", "", nil
        }
        client := &http.Client{Timeout: 15 * time.Second}

        resp, err := client.Get(strings.TrimRight(baseURL, "/") + ".version")
        if err != nil {
                return "", "", nil // sin internet o URL mal puesta: se ignora en silencio
        }
        body, _ := io.ReadAll(io.LimitReader(resp.Body, 64))
        resp.Body.Close()
        ver = strings.TrimSpace(string(body))
        if ver == "" || compareVersions(ver, version) <= 0 {
                return "", "", nil
        }

        resp2, err := client.Get(baseURL)
        if err != nil {
                return "", "", fmt.Errorf("no se pudo descargar la versión %s: %v", ver, err)
        }
        defer resp2.Body.Close()
        if resp2.StatusCode != 200 {
                return "", "", fmt.Errorf("el servidor respondió %d al descargar la actualización", resp2.StatusCode)
        }
        tmp := filepath.Join(os.TempDir(), "PuenteZebra_nueva.exe")
        f, err := os.Create(tmp)
        if err != nil {
                return "", "", err
        }
        _, err = io.Copy(f, io.LimitReader(resp2.Body, 120*1024*1024))
        f.Close()
        if err != nil {
                return "", "", err
        }
        if err := validateUpdateFile(tmp); err != nil {
                os.Remove(tmp)
                return "", "", err
        }
        return tmp, ver, nil
}
