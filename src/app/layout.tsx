import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "BACOLI · Gestión",
  description: "Sistema de gestión de BACOLI",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const vista = (await cookies()).get("vista")?.value; // prueba piloto: "clasica" / "intermedia" / (vacío = moderna)
  return (
    <html lang="es" className={vista === "clasica" ? "clasico" : vista === "intermedia" ? "intermedio" : undefined}>
      <body className="min-h-screen bg-crema-50 text-stone-900 antialiased">
        {children}
        <p className="px-4 py-6 text-center text-xs text-stone-400 print:hidden">Desarrollado por IVÁN DÍAZ CRUPI</p>
      </body>
    </html>
  );
}
