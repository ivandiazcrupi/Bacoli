"use client";

import { useEffect } from "react";

/** Fija el título de la pestaña (que el navegador usa como nombre al "Guardar como PDF") justo al abrir y justo antes de imprimir. */
export function NombreDelPdf({ nombre }: { nombre: string }) {
  useEffect(() => {
    const original = document.title;
    const poner = () => { document.title = nombre; };
    const devolver = () => { document.title = nombre; };
    poner();
    window.addEventListener("beforeprint", poner);
    window.addEventListener("afterprint", devolver);
    return () => {
      window.removeEventListener("beforeprint", poner);
      window.removeEventListener("afterprint", devolver);
      document.title = original;
    };
  }, [nombre]);
  return null;
}
