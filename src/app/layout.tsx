import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BACOLI · Gestión",
  description: "Sistema de gestión de BACOLI",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="intermedio">
      <body className="min-h-screen bg-crema-50 text-stone-900 antialiased">
        {children}
        <p className="px-4 py-6 text-center text-xs text-stone-400 print:hidden">Desarrollado por IVÁN DÍAZ CRUPI</p>
      </body>
    </html>
  );
}
