"use client";

import { useState } from "react";
import { estiloCampo } from "@/components/campos";
import { ESTADOS, TIPOS_CONTACTO } from "@/lib/leads";

// Anotar un contacto en el historial (y, si se quiere, fijar cuándo volver a escribirle).
export function FormContacto({ accion, manana }: { accion: (f: FormData) => Promise<void>; manana: string }) {
  const [enviando, setEnviando] = useState(false);
  return (
    <form action={async (f) => { setEnviando(true); await accion(f); setEnviando(false); (document.getElementById("form-contacto") as HTMLFormElement | null)?.reset(); }} id="form-contacto" className="space-y-2">
      <select name="tipo" defaultValue="WHATSAPP" className={estiloCampo}>{TIPOS_CONTACTO.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
      <textarea name="texto" rows={3} placeholder="Qué se dijo, qué respondió, qué quedó pendiente…" className={estiloCampo} />
      <label className="block text-xs font-semibold text-stone-600">Volver a escribirle el
        <input name="proximoContacto" type="date" defaultValue={manana} className={estiloCampo} />
      </label>
      <button disabled={enviando} className="w-full rounded-lg bg-verde-700 px-4 py-2.5 font-semibold text-white hover:bg-verde-800 disabled:opacity-60">{enviando ? "Anotando…" : "Anotar en el historial"}</button>
    </form>
  );
}

// Cambiar el estado. "Perdido" pide el motivo.
export function CambiarEstado({ actual, accion }: { actual: string; accion: (f: FormData) => Promise<void> }) {
  const [perdido, setPerdido] = useState(false);
  return (
    <form action={accion} className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {ESTADOS.map(([k, n, a]) => k === "PERDIDO" ? (
          <button key={k} type="button" title={a} disabled={actual === k} onClick={() => setPerdido((p) => !p)} className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${actual === k ? "border-stone-800 bg-stone-800 text-white" : perdido ? "border-rojo-700 text-rojo-700" : "border-stone-300 bg-white hover:border-stone-500"}`}>{n}</button>
        ) : (
          <button key={k} title={a} name="estado" value={k} disabled={actual === k} className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${actual === k ? "border-stone-800 bg-stone-800 text-white" : "border-stone-300 bg-white hover:border-stone-500"}`}>{n}</button>
        ))}
      </div>
      {perdido && (
        <div className="flex gap-2">
          <input name="motivo" placeholder="¿Por qué no compra? (precio, zona, no respondió…)" className={`${estiloCampo} !mt-0`} />
          <button name="estado" value="PERDIDO" className="shrink-0 rounded-md bg-rojo-700 px-4 text-sm font-semibold text-white">Marcar perdido</button>
        </div>
      )}
    </form>
  );
}

export function BotonEliminar({ accion, nombre }: { accion: () => Promise<void>; nombre: string }) {
  return (
    <form action={accion} onSubmit={(e) => { if (!confirm(`¿Eliminar el lead ${nombre} con todo su historial? No se puede deshacer.`)) e.preventDefault(); }}>
      <button className="rounded-md border border-rojo-700 bg-white px-3 py-1.5 text-sm font-semibold text-rojo-700 hover:bg-rojo-50">Eliminar lead</button>
    </form>
  );
}
