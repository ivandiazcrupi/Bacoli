"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const CLAVE = "bacoli-recorrido";
const MAX = 40;
// Pantallas de formulario: no se vuelve "a un formulario ya guardado" (editar, cargar, nota de crédito…).
const ES_FORMULARIO = /\/(editar|nuevo|nc|cargar|importar|remito|imprimir)(\/|$|\?)/;

const leer = (): string[] => {
  try { return JSON.parse(sessionStorage.getItem(CLAVE) ?? "[]") as string[]; } catch { return []; }
};
const guardar = (v: string[]) => {
  try { sessionStorage.setItem(CLAVE, JSON.stringify(v.slice(-MAX))); } catch { /* sin almacenamiento: se usa la pantalla de arriba */ }
};

/** Anota por qué pantallas se va pasando (en esta pestaña) para que "Volver" lleve a la anterior de verdad. Va una sola vez en el layout. */
export function RegistroDeRecorrido() {
  const ruta = usePathname();
  useEffect(() => {
    const actual = ruta + window.location.search;
    const v = leer();
    if (v[v.length - 1] !== actual) guardar([...v, actual]);
  }, [ruta]);
  return null;
}

/** Botón "← Volver": va a la pantalla donde estabas antes (no a un formulario ya usado). Si no hay, va a la que se le indica. */
export function BotonVolver({ fallback, texto = "Volver" }: { fallback: string; texto?: string }) {
  const router = useRouter();
  const ruta = usePathname();
  const volver = () => {
    const v = leer();
    const actual = ruta;
    while (v.length > 0 && v[v.length - 1].split("?")[0] === actual) v.pop(); // la pantalla actual
    let destino: string | undefined;
    while (v.length > 0) {
      const u = v.pop()!;
      if (u.split("?")[0] === actual || ES_FORMULARIO.test(u)) continue;
      destino = u;
      break;
    }
    guardar(v); // al llegar, la pantalla se vuelve a anotar sola
    router.push(destino ?? fallback);
  };
  return (
    <button type="button" onClick={volver} className="inline-flex items-center gap-1.5 rounded-md border border-stone-400 bg-white px-3.5 py-2 text-sm font-semibold text-stone-800 shadow-sm hover:bg-crema-100 print:hidden">
      <span aria-hidden>←</span> {texto}
    </button>
  );
}
