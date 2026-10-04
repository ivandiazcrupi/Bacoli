"use client";

import { useActionState, useEffect } from "react";
import { importarArca, type EstadoArca } from "./actions";

export function SubirArchivo() {
  const [estado, enviar, cargando] = useActionState(importarArca, undefined as EstadoArca);
  // Al terminar de cargar, una alerta con el resumen (cuántas nuevas y cuántas repetidas).
  useEffect(() => { if (estado?.alerta) window.alert(estado.alerta); }, [estado]);
  return (
    <form action={enviar} className="flex flex-wrap items-center gap-3">
      <input type="file" name="archivo" accept=".csv,.txt,text/csv" required className="text-sm file:mr-3 file:rounded-md file:border file:border-stone-400 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium" />
      <button disabled={cargando} className="h-10 rounded-md bg-verde-700 px-5 text-sm font-bold text-white hover:bg-verde-800 disabled:opacity-50">{cargando ? "Leyendo…" : "Subir y comparar"}</button>
      {estado?.error && <p className="w-full text-sm font-semibold text-rojo-700" role="alert">{estado.error}</p>}
      {estado?.ok && <p className="w-full text-sm font-semibold text-verde-700">{estado.ok}</p>}
      {estado?.avisos?.map((a) => <p key={a} className="w-full text-xs text-stone-600">{a}</p>)}
    </form>
  );
}
