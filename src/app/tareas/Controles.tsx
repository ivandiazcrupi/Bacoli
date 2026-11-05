"use client";

import { useRef, useState, useTransition } from "react";
import { alternarTarea, borrarHechas, borrarTarea, crearTarea } from "./actions";

// Una tarea: casillero para tildar (si puede) y, para el gerente, una ✕ para borrarla.
export function FilaTarea({ id, titulo, hecha, puedeTildar, puedeBorrar }: { id: string; titulo: string; hecha: boolean; puedeTildar: boolean; puedeBorrar: boolean }) {
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState("");
  return (
    <li className="group flex items-start gap-3 py-1.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={hecha}
        aria-label={hecha ? `Destildar: ${titulo}` : `Marcar como hecha: ${titulo}`}
        disabled={!puedeTildar || pendiente}
        onClick={() => empezar(async () => { const r = await alternarTarea(id); setError(r.error ?? ""); })}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[13px] leading-none ${hecha ? "border-verde-700 bg-verde-700 text-white" : "border-stone-400 bg-white"} ${puedeTildar ? "cursor-pointer hover:border-stone-700" : "cursor-default"} disabled:opacity-60`}
      >{hecha ? "✓" : ""}</button>
      <span className={`min-w-0 flex-1 text-[14px] leading-snug ${hecha ? "text-stone-400 line-through" : "text-stone-900"}`}>{titulo}{error && <span className="ml-2 text-[12px] text-rojo-700 no-underline">{error}</span>}</span>
      {puedeBorrar && (
        <button type="button" aria-label="Borrar tarea" title="Borrar tarea" disabled={pendiente} onClick={() => window.confirm(`¿Borrar la tarea "${titulo}"?`) && empezar(async () => { await borrarTarea(id); })} className="shrink-0 px-1 text-[13px] text-stone-300 hover:text-rojo-700">✕</button>
      )}
    </li>
  );
}

// Campo para sumar una tarea (solo lo ve el gerente). Enter la guarda y queda listo para la siguiente.
export function NuevaTarea({ asignadaId }: { asignadaId: string }) {
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState("");
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={(fd) => empezar(async () => { const r = await crearTarea(asignadaId, fd); setError(r.error ?? ""); if (!r.error) ref.current?.reset(); })}
      className="mt-3 flex items-center gap-2 border-t border-stone-200 pt-3"
    >
      <input name="titulo" placeholder="+ Agregar una tarea…" aria-label="Nueva tarea" maxLength={200} autoComplete="off" disabled={pendiente} className="h-9 min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-3 text-[13px] placeholder:text-stone-400 focus:border-verde-700 focus:outline-none" />
      <button type="submit" disabled={pendiente} className="h-9 rounded-md border border-stone-300 bg-white px-3 text-[12px] font-semibold text-stone-700 hover:border-stone-600 disabled:opacity-50">Agregar</button>
      {error && <span className="text-[12px] text-rojo-700">{error}</span>}
    </form>
  );
}

export function BorrarHechas({ asignadaId, cuantas }: { asignadaId: string; cuantas: number }) {
  const [pendiente, empezar] = useTransition();
  return (
    <button type="button" disabled={pendiente} onClick={() => window.confirm(cuantas === 1 ? "¿Borrar la tarea ya hecha?" : `¿Borrar las ${cuantas} tareas ya hechas?`) && empezar(async () => { await borrarHechas(asignadaId); })} className="text-[12px] text-stone-400 underline-offset-2 hover:text-stone-700 hover:underline">
      {cuantas === 1 ? "Borrar la hecha" : `Borrar las ${cuantas} hechas`}
    </button>
  );
}
