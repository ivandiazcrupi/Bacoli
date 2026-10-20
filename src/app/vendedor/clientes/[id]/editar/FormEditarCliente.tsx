"use client";

import { useActionState } from "react";
import { guardarClienteVendedor } from "../../../actions";

const input = "mt-1 h-11 w-full rounded-lg border border-stone-400 bg-white px-3 text-base text-stone-900 focus:border-verde-700 focus:outline-none";
const etiqueta = "block text-sm font-semibold text-stone-700";
type Punto = { id: string; barrio: string; direccion: string; telefono: string; comentario: string; activo: boolean };

export function FormEditarCliente({ id, razonSocial, cuit, puntos }: { id: string; razonSocial: string; cuit: string; puntos: Punto[] }) {
  const [estado, enviar, cargando] = useActionState(guardarClienteVendedor.bind(null, id), undefined);
  return (
    <form action={enviar} className="space-y-4 pb-24">
      <section className="grid gap-3 rounded-xl border border-stone-300 bg-white p-4 sm:grid-cols-2">
        <label className={etiqueta}>Razón social<input name="razonSocial" defaultValue={razonSocial} autoCapitalize="characters" className={`${input} uppercase`} /></label>
        <label className={etiqueta}>CUIT<input name="cuit" defaultValue={cuit} inputMode="numeric" placeholder="11 números" className={input} /></label>
      </section>
      {puntos.map((p, i) => (
        <section key={p.id} className={`space-y-3 rounded-xl border border-stone-300 bg-white p-4 ${p.activo ? "" : "opacity-70"}`}>
          <h2 className="text-sm font-bold uppercase tracking-wide text-stone-600">Sucursal {i + 1}{p.activo ? "" : " · desactivada"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={etiqueta}>Barrio<input name={`barrio_${p.id}`} defaultValue={p.barrio} required autoCapitalize="characters" className={`${input} uppercase`} /></label>
            <label className={etiqueta}>Dirección<input name={`direccion_${p.id}`} defaultValue={p.direccion} required className={input} /></label>
            <label className={etiqueta}>Teléfono<input name={`telefono_${p.id}`} defaultValue={p.telefono} inputMode="tel" className={input} /></label>
            <label className={etiqueta}>Nota (ej.: recibe hasta las 10)<input name={`comentario_${p.id}`} defaultValue={p.comentario} className={input} /></label>
          </div>
        </section>
      ))}
      {estado?.error && <p role="alert" className="rounded-xl border border-rojo-600 bg-rojo-50 px-4 py-3 text-[15px] font-medium text-rojo-700">{estado.error}</p>}
      {estado?.ok && <p role="status" className="rounded-xl border border-verde-700/30 bg-verde-50 px-4 py-3 text-[15px] font-medium text-verde-800">Guardado.</p>}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-300 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto max-w-3xl"><button disabled={cargando} className="h-12 w-full rounded-xl bg-verde-700 text-base font-bold uppercase tracking-wide text-white disabled:opacity-60">{cargando ? "Guardando…" : "Guardar cambios"}</button></div>
      </div>
    </form>
  );
}
