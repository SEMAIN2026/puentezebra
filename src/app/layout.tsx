import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PuenteZebra — Descargas",
  description:
    "Descargas de PuenteZebra: sistema de impresión Zebra ZD220 en red por impresora virtual. SERVIDOR y CLIENTE para Windows 10/11 64-bit.",
  keywords: [
    "PuenteZebra",
    "Zebra ZD220",
    "impresora virtual",
    "impresión en red",
    "ZPL",
    "Windows",
  ],
  authors: [{ name: "PuenteZebra" }],
  openGraph: {
    title: "PuenteZebra — Descargas",
    description:
      "Sistema de impresión Zebra ZD220 en red por impresora virtual.",
    type: "website",
    locale: "es_ES",
  },
  twitter: {
    card: "summary",
    title: "PuenteZebra — Descargas",
    description:
      "Sistema de impresión Zebra ZD220 en red por impresora virtual.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
