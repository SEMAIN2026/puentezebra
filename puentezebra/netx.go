package main

import (
	"errors"
	"fmt"
	"io"
	"net"
	"time"
)

// startListener escucha TCP en addr y llama a handler con lo que llegue de cada conexión.
// Es el mismo mecanismo que usan las impresoras de red (puerto RAW 9100).
func startListener(addr string, handler func(data []byte, remote string)) (net.Listener, error) {
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("no se pudo abrir el puerto %s (¿lo usa otro programa?): %v", addr, err)
	}
	go acceptLoop(ln, handler)
	return ln, nil
}

func acceptLoop(ln net.Listener, handler func(data []byte, remote string)) {
	for {
		conn, err := ln.Accept()
		if err != nil {
			return // se cerró el listener a propósito
		}
		go handleJobConn(conn, handler)
	}
}

func handleJobConn(conn net.Conn, handler func(data []byte, remote string)) {
	defer conn.Close()
	remote := conn.RemoteAddr().String()
	conn.SetDeadline(time.Now().Add(180 * time.Second))
	data, err := io.ReadAll(conn)
	if err != nil && len(data) == 0 {
		logf("Conexión de %s cortada sin datos: %v", remote, err)
		return
	}
	handler(data, remote)
}

// sendData manda bytes a ip:puerto y cierra la escritura para que el otro lado procese ya.
func sendData(ip string, port int, data []byte) error {
	if ip == "" {
		return errors.New("falta la IP de tu computadora (Servidor)")
	}
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", ip, port), 5*time.Second)
	if err != nil {
		return fmt.Errorf("no se pudo conectar con %s:%d — ¿el SERVIDOR está abierto allá? (%v)", ip, port, err)
	}
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(120 * time.Second))
	if _, err := conn.Write(data); err != nil {
		return fmt.Errorf("la conexión se cayó al enviar: %v", err)
	}
	if tc, ok := conn.(*net.TCPConn); ok {
		tc.CloseWrite() // señal de fin de trabajo
	}
	// espera breve a que el otro lado cierre
	conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	io.ReadAll(io.LimitReader(conn, 1024))
	return nil
}

// testConnection solo verifica que el SERVIDOR responde en su puerto.
func testConnection(ip string, port int) error {
	if ip == "" {
		return errors.New("escribe primero la IP de tu computadora (Servidor)")
	}
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", ip, port), 4*time.Second)
	if err != nil {
		return fmt.Errorf("sin respuesta de %s:%d — revisa que el SERVIDOR esté abierto y el Firewall ya configurado", ip, port)
	}
	conn.Close()
	return nil
}
