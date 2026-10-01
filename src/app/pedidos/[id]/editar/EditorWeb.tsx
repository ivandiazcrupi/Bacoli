"use client";

import { useActionState, useState } from "react";
import { Mensajes, estiloBoton } from "@/components/campos";
import { actualizarPedidoWeb, type EstadoPedidoForm } from "../../actions";

type Renglon = { id: string; nombre: string; unidad: string; cantidad: number };
type Datos = { nombre: string; barrio: string; direccion: string; telefono: string; total: string; nota: string };

const campo = "mt-1 h-10 w-full rounded-md border border-stone-400 bg-white px-3 text-base font-normal text-stone-900 shadow-sm focus:border-verde-700 focus:outline-none focus:ring-2 focus:ring-verde-700/25";
const etiqueta = "block text-xs font-semibold uppercase tracking-wide text-stone-600";
const boton = "flex h-11 w-11 items-center justify-center rounded-md border border-stone-400 bg-white text-xl font-medium hover:bg-crema-100 lg:h-9 lg:w-9 lg:text-lg";

// Editar un pedido de la tienda online: mismos cuadros que el pedido mayorista, pero con los datos de entrega escritos en el pedido y sin precios por renglón.
export function EditorWeb({ pedidoId, items, datos }: { pedidoId: string; items: Renglon[]; datos: Datos }) {
  const [estado, enviar, cargando] = useActionState(actualizarPedidoWeb.bind(null, pedidoId), undefined as EstadoPedidoForm);
  const [cantidades, setCantidades] = useState<Record<string, string>>(() => Object.fromEntries(items.map((i) => [i.id, String(i.cantidad)])));
  const cantidad = (id: string) => Number(cantidades[id]?.replace(/\D/g, "") || 0);
  const cambiar = (id: string, delta: number) => setCantidades((c) => ({ ...c, [id]: String(Math.max(0, cantidad(id) + delta)) }));

  return (
    <form action={enviar} className="space-y-4">
      <section className="rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-stone-600">Datos de entrega</p>
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_2fr_1fr]">
          <label className={etiqueta}>Nombre<input name="nombre" defaultValue={datos.nombre} required className={`${campo} dato`} autoCapitalize="characters" /></label>
          <label className={etiqueta}>Barrio<input name="barrio" defaultValue={datos.barrio} className={`${campo} dato`} autoCapitalize="characters" /></label>
          <label className={etiqueta}>Dirección<input name="direccion" defaultValue={datos.direccion} className={campo} /></label>
          <label className={etiqueta}>Teléfono<input name="telefono" defaultValue={datos.telefono} inputMode="tel" className={campo} /></label>
        </div>
      </section>

      <div className="overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm">
        <div className="hidden grid-cols-[minmax(0,2fr)_6rem_11rem] gap-x-4 px-5 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-stone-600 lg:grid">
          <span>Producto</span><span>Unidad</span><span>Cantidad</span>
        </div>
        {items.map((i) => (
          <div key={i.id} className={`grid grid-cols-[minmax(0,2fr)_6rem_11rem] items-center gap-x-4 border-t border-stone-400 px-5 py-2.5 text-center max-lg:grid-cols-1 max-lg:gap-y-2 ${cantidad(i.id) > 0 ? "bg-crema-50" : "bg-white"}`}>
            <p className="font-semibold leading-snug">{i.nombre}</p>
            <p className="text-sm text-stone-600">{i.unidad}</p>
            <div className="flex items-center justify-center gap-1">
              <button type="button" className={boton} onClick={() => cambiar(i.id, -1)} aria-label={`Menos ${i.nombre}`}>−</button>
              <input
                name={`q_${i.id}`}
                aria-label={`Cantidad de ${i.nombre}`}
                inputMode="numeric"
                value={cantidades[i.id] ?? ""}
                onChange={(e) => setCantidades((c) => ({ ...c, [i.id]: e.target.value.replace(/\D/g, "") }))}
                className="h-11 w-16 rounded-md border border-stone-400 bg-white text-center text-lg tabular-nums lg:h-9 lg:text-base"
              />
              <button type="button" className={boton} onClick={() => cambiar(i.id, 1)} aria-label={`Más ${i.nombre}`}>+</button>
            </div>
          </div>
        ))}
        <p className="border-t border-stone-300 px-5 py-2 text-center text-xs text-stone-500">Con cantidad 0 el producto se saca del pedido.</p>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_20rem]">
        <label className="flex flex-col rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
          <span className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-stone-600">Nota (opcional)</span>
          <input name="nota" defaultValue={datos.nota} className="w-full rounded-md border border-stone-400 bg-white px-3 py-2.5 text-base" />
        </label>
        <div className="rounded-xl border border-stone-300 bg-white p-4 text-sm shadow-sm">
          <label className="block text-center text-xs font-semibold uppercase tracking-wide text-stone-600">
            Total pagado ($)
            <input name="total" defaultValue={datos.total} inputMode="decimal" className="mt-1 h-10 w-full rounded-md border border-stone-400 bg-white px-3 text-center text-lg font-bold tabular-nums text-stone-900" />
          </label>
          <button disabled={cargando} className={`${estiloBoton} mt-3`}>{cargando ? "Guardando…" : "Guardar cambios"}</button>
          <Mensajes estado={estado} />
        </div>
      </div>
    </form>
  );
}
