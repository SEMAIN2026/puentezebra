package main

import (
	"fmt"
	"strings"
	"time"
)

// ZPL es el lenguaje de las impresoras Zebra. La ZD220 imprime etiquetas cuando recibe ZPL.

func escapeZPLField(s string) string {
	return strings.NewReplacer(
		"\\", "_5C",
		"^", "_5E",
		"~", "_7E",
		"_", "_5F",
	).Replace(s)
}

// wrapTextAsZPL convierte texto plano (de un .txt o pegado) en una etiqueta ZPL legible.
func wrapTextAsZPL(text string) string {
	text = strings.ReplaceAll(text, "\r\n", "\n")
	text = strings.ReplaceAll(text, "\r", "\n")
	lines := strings.Split(text, "\n")
	var b strings.Builder
	b.WriteString("^XA\r\n^CI28\r\n^PW640\r\n^LH20,20\r\n")
	y := 30
	count := 0
	for _, ln := range lines {
		ln = strings.TrimRight(ln, " \t")
		fmt.Fprintf(&b, "^A0N,26,26^FT0,%d^FH_^FD%s^FS\r\n", y, escapeZPLField(ln))
		y += 34
		count++
		if count >= 140 {
			break
		}
	}
	b.WriteString("^PQ1\r\n^XZ\r\n")
	return b.String()
}

// testLabelZPL genera una etiqueta de prueba bonita.
func testLabelZPL(subtitle string) string {
	now := time.Now().Format("02/01/2006 15:04")
	return "^XA\r\n" +
		"^CI28\r\n" +
		"^PW640\r\n" +
		"^LH30,30\r\n" +
		"^FO0,0^GB560,200,4^FS\r\n" +
		"^A0N,46,46^FO30,26^FDPuenteZebra^FS\r\n" +
		"^A0N,30,30^FO30,92^FH_^FD" + escapeZPLField(subtitle) + "^FS\r\n" +
		"^A0N,26,26^FO30,140^FH_^FDFecha: " + now + "^FS\r\n" +
		"^A0N,24,24^FO30,172^FDSi ves esta etiqueta, el puente funciona^FS\r\n" +
		"^PQ1\r\n" +
		"^XZ\r\n"
}

// looksLikeZPL detecta si un archivo/texto ya viene en lenguaje ZPL.
func looksLikeZPL(data []byte) bool {
	s := strings.TrimSpace(string(data))
	return strings.HasPrefix(s, "^XA") || strings.HasPrefix(s, "\n^XA") ||
		strings.Contains(s[:min(200, len(s))], "^XA")
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// prepareOutgoing decide si hay que convertir a ZPL antes de enviar.
func prepareOutgoing(data []byte, fileName string, wrapEnabled bool) []byte {
	if looksLikeZPL(data) {
		return data // ya es ZPL: tal cual
	}
	if wrapEnabled {
		return []byte(wrapTextAsZPL(string(data)))
	}
	_ = fileName
	return data
}
