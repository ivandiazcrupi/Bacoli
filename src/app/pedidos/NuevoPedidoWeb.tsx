"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Mensajes, estiloBoton } from "@/components/campos";
import { crearPedidoWebManual, type EstadoPedidoForm } from "./actions";

type Producto = { id: string; nombre: string; sku: string | null; unidad: string };

const campo = "mt-1 h-10 w-full rounded-md border border-stone-400 bg-white px-3 text-base font-normal text-stone-900 shadow-sm focus:border-verde-700 focus:outline-none focus:ring-2 focus:ring-verde-700/25";
const etiqueta = "block text-xs font-semibold uppercase tracking-wide text-stone-600";
const boton = "flex h-11 w-11 items-center justify-center rounded-md border border-stone-400 bg-white text-xl font-medium hover:bg-crema-100 lg:h-9 lg:w-9 lg:text-lg";

// Pedido minorista cargado a mano: datos de entrega, productos con cantidad, total que paga y si ya pagó por transferencia.
export function NuevoPedidoWeb({ productos }: { productos: Producto[] }) {
  const [estado, enviar, cargando] = useActionState(crearPedidoWebManual, undefined as EstadoPedidoForm);
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const form = useRef<HTMLFormElement>(null);
  const cantidad = (id: string) => Number(cantidades[id]?.replace(/\D/g, "") || 0);
  const cambiar = (id: string, delta: number) => setCantidades((c) => ({ ...c, [id]: String(Math.max(0, cantidad(id) + delta) || "") }));

  // Al guardar bien, el formulario queda limpio para cargar el siguiente.
  useEffect(() => {
    if (estado?.ok) { form.current?.reset(); setCantidades({}); }
  }, [estado]);

  return (
    <form ref={form} action={enviar} className="space-y-4">
      <section className="rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-stone-600">Datos de entrega</p>
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_2fr_1fr]">
          <label className={etiqueta}>Nombre<input name="nombre" required className={`${campo} dato`} autoCapitalize="characters" /></label>
          <label className={etiqueta}>Barrio<input name="barrio" className={`${campo} dato`} autoCapitalize="characters" /></label>
          <label className={etiqueta}>Dirección<input name="direccion" required className={campo} /></label>
          <label className={etiqueta}>Teléfono<input name="telefono" inputMode="tel" className={campo} /></label>
        </div>
      </section>

      <div className="overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm">
        <div className="hidden grid-cols-[minmax(0,2fr)_6rem_11rem] gap-x-4 px-5 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-stone-600 lg:grid">
          <span>Producto</span><span>Unidad</span><span>Cantidad</span>
        </div>
        {productos.map((p) => (
          <div key={p.id} className={`grid grid-cols-[minmax(0,2fr)_6rem_11rem] items-center gap-x-4 border-t border-stone-400 px-5 py-2.5 text-center max-lg:grid-cols-1 max-lg:gap-y-2 ${cantidad(p.id) > 0 ? "bg-crema-50" : "bg-white"}`}>
            <div>
              <p className="font-semibold leading-snug">{p.nombre}</p>
              <p className="text-xs text-stone-500">{p.sku ?? ""}</p>
            </div>
            <p className="text-sm text-stone-600">{p.unidad}</p>
            <div className="flex items-center justify-center gap-1">
              <button type="button" className={boton} onClick={() => cambiar(p.id, -1)} aria-label={`Menos ${p.nombre}`}>−</button>
              <input
                name={`q_${p.id}`}
                aria-label={`Cantidad de ${p.nombre}`}
                inputMode="numeric"
                value={cantidades[p.id] ?? ""}
                onChange={(e) => setCantidades((c) => ({ ...c, [p.id]: e.target.value.replace(/\D/g, "") }))}
                placeholder="0"
                className="h-11 w-16 rounded-md border border-stone-400 bg-white text-center text-lg tabular-nums lg:h-9 lg:text-base"
              />
              <button type="button" className={boton} onClick={() => cambiar(p.id, 1)} aria-label={`Más ${p.nombre}`}>+</button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-3 rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
          <label className="block">
            <span className="mb-2 block text-center text-xs font-semibold uppercase tracking-wide text-stone-600">Nota importante (se ve en rojo en la ruta)</span>
            <input name="nota" placeholder="Ej.: Entregar en portería" className="w-full rounded-md border border-stone-400 bg-white px-3 py-2.5 text-base" />
          </label>
          <label className="flex items-center justify-center gap-2 text-sm font-medium">
            <input type="checkbox" name="pagado" value="1" className="h-5 w-5" />
            Ya pagó por transferencia (sin esto no sale de fábrica)
          </label>
        </div>
        <div className="rounded-xl border border-stone-300 bg-white p-4 text-sm shadow-sm">
          <label className="block text-center text-xs font-semibold uppercase tracking-wide text-stone-600">
            Total que paga ($, con envío si lo lleva)
            <input name="total" inputMode="decimal" required placeholder="0" className="mt-1 h-10 w-full rounded-md border border-stone-400 bg-white px-3 text-center text-lg font-bold tabular-nums text-stone-900" />
          </label>
          <button disabled={cargando} className={`${estiloBoton} mt-3`}>{cargando ? "Guardando…" : "Cargar pedido minorista"}</button>
          <Mensajes estado={estado} />
        </div>
      </div>
    </form>
  );
}
