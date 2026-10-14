"use client";

import { useActionState } from "react";
import { crearClienteVendedor } from "../../actions";

const input = "mt-1 h-12 w-full rounded-lg border border-stone-400 bg-white px-3 text-base text-stone-900 focus:border-verde-700 focus:outline-none focus:ring-2 focus:ring-verde-700/25";
const etiqueta = "block text-sm font-semibold text-stone-700";

// Cliente nuevo desde el celular: lo mínimo para poder entregarle (nombre, dirección, barrio y zona); lo demás es opcional.
export function FormCliente({ zonas }: { zonas: { id: string; nombre: string }[] }) {
  const [estado, enviar, cargando] = useActionState(crearClienteVendedor, undefined);
  return (
    <form action={enviar} className="space-y-4 pb-28">
      <label className={etiqueta}>Nombre del comercio *
        <input name="nombre" required autoCapitalize="characters" autoComplete="off" placeholder="Ej.: ALMACEN DON PEPE" className={`${input} uppercase`} />
      </label>
      <label className={etiqueta}>Dirección de entrega *
        <input name="direccion" required autoComplete="off" placeholder="Calle y número" className={input} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={etiqueta}>Barrio *
          <input name="barrio" required autoCapitalize="characters" autoComplete="off" placeholder="Ej.: PALERMO" className={`${input} uppercase`} />
        </label>
        <label className={etiqueta}>Zona *
          <select name="zonaId" required defaultValue="" className={input}>
            <option value="" disabled hidden>Elegí…</option>
            {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
          </select>
        </label>
      </div>
      <label className={etiqueta}>Teléfono
        <input name="telefono" inputMode="tel" autoComplete="off" placeholder="Para avisarle por WhatsApp" className={input} />
      </label>
      <details className="rounded-xl border border-stone-300 bg-white">
        <summary className="cursor-pointer select-none px-4 py-3 text-[15px] font-semibold text-stone-700">Más datos (opcionales)</summary>
        <div className="space-y-4 border-t border-stone-200 p-4">
          <label className={etiqueta}>Razón social
            <input name="razonSocial" autoCapitalize="characters" autoComplete="off" className={`${input} uppercase`} />
          </label>
          <label className={etiqueta}>CUIT
            <input name="cuit" inputMode="numeric" autoComplete="off" placeholder="11 números" className={input} />
          </label>
          <label className={etiqueta}>Comentario (ej.: recibe hasta las 10)
            <input name="comentario" autoComplete="off" className={input} />
          </label>
        </div>
      </details>
      {estado?.error && <p role="alert" className="rounded-xl border border-rojo-600 bg-rojo-50 px-4 py-3 text-[15px] font-medium text-rojo-700">{estado.error}</p>}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-300 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto max-w-xl">
          <button disabled={cargando} className="h-14 w-full rounded-xl bg-verde-700 text-base font-bold uppercase tracking-wide text-white active:bg-verde-800 disabled:opacity-60">{cargando ? "Guardando…" : "Guardar y cargar pedido"}</button>
        </div>
      </div>
    </form>
  );
}
