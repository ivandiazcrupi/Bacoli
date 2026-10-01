import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "BACOLI · Gestión",
  description: "Sistema de gestión de BACOLI",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const clasica = (await cookies()).get("vista")?.value === "clasica"; // prueba piloto de la vista clásica
  return (
    <html lang="es" className={clasica ? "clasico" : undefined}>
      <body className="min-h-screen bg-crema-50 text-stone-900 antialiased">
        {children}
        <p className="px-4 py-6 text-center text-xs text-stone-400 print:hidden">Desarrollado por IVÁN DÍAZ CRUPI</p>
      </body>
    </html>
  );
}
