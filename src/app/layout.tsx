import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BACOLI · Gestión",
  description: "Sistema de gestión de BACOLI",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Versión que está corriendo (Railway la informa): sirve para comprobar que lo último ya se publicó.
const version = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        {children}
        <p className="px-4 py-6 text-center text-xs text-stone-400 print:hidden">Versión {version}</p>
      </body>
    </html>
  );
}
