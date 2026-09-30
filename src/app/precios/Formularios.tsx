"use client";

import { useActionState } from "react";
import { Campo, Mensajes, estiloBoton, estiloBotonChico, estiloCampo } from "@/components/campos";
import { agregarLista, crearProducto, guardarPrecios, guardarProducto, type EstadoPrecios } from "./actions";

type Lista = { id: string; nombre: string };
type Producto = { id: string; nombre: string; sku: string | null; unidad: string };

export function GrillaPrecios({ listas, productos, precios }: { listas: Lista[]; productos: Producto[]; precios: Record<string, string> }) {
  const [estado, enviar, cargando] = useActionState(guardarPrecios, undefined);
  return (
    <form action={enviar} className="space-y-4">
      <ul className="divide-y divide-stone-200 border-y border-stone-200">
        {productos.map((p) => (
          <li key={p.id} className="space-y-3 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{p.nombre}</span>
              <span className="whitespace-nowrap text-xs text-stone-500">{p.sku ? `${p.sku} · ` : ""}por {p.unidad}</span>
            </div>
            <div className={`grid gap-2 ${listas.length <= 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3"}`}>
              {listas.map((l) => (
                <label key={l.id} className="block text-xs font-medium uppercase tracking-wide text-stone-500">
                  {l.nombre}
                  <div className="relative mt-1">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[15px] normal-case text-stone-400" aria-hidden="true">$</span>
                    <input
                      name={`p_${l.id}_${p.id}`}
                      inputMode="decimal"
                      defaultValue={precios[`${l.id}_${p.id}`] ?? ""}
                      className="w-full rounded-md border border-stone-200 bg-white py-3 pl-6 pr-2 text-right text-[15px] normal-case tabular-nums text-stone-900"
                    />
                  </div>
                </label>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-stone-500">Precios sin IVA, por la unidad de venta de cada producto. Vacío = sin precio.</p>
      <Mensajes estado={estado} />
      <button disabled={cargando} className={estiloBoton}>{cargando ? "Guardando…" : "Guardar precios"}</button>
    </form>
  );
}

export function EditarProducto({ producto }: { producto: Producto & { ean: string | null; descripcion: string | null } }) {
  const [estado, enviar, cargando] = useActionState(guardarProducto.bind(null, producto.id), undefined as EstadoPrecios);
  return (
    <form action={enviar} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Código (SKU)"><input name="sku" defaultValue={producto.sku ?? ""} className={estiloCampo} /></Campo>
        <Campo etiqueta="Unidad de venta">
          <select name="unidad" defaultValue={producto.unidad} className={estiloCampo}>
            <option value="paquete">Paquete</option>
            <option value="unidad">Unidad</option>
          </select>
        </Campo>
      </div>
      <Campo etiqueta="Nombre"><input name="nombre" defaultValue={producto.nombre} required className={estiloCampo} /></Campo>
      <Campo etiqueta="Descripción para el remito"><input name="descripcion" defaultValue={producto.descripcion ?? ""} className={estiloCampo} /></Campo>
      <Campo etiqueta="EAN (código de barras)" ayuda="Opcional. Entre 8 y 14 números."><input name="ean" inputMode="numeric" defaultValue={producto.ean ?? ""} className={estiloCampo} /></Campo>
      <Mensajes estado={estado} />
      <button disabled={cargando} className={estiloBoton}>{cargando ? "Guardando…" : "Guardar producto"}</button>
    </form>
  );
}

export function AgregarProducto() {
  const [estado, enviar, cargando] = useActionState(crearProducto, undefined);
  return (
    <form key={JSON.stringify(estado ?? null)} action={enviar} className="space-y-3">
      <Campo etiqueta="Nombre"><input name="nombre" required className={estiloCampo} /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Código (SKU)"><input name="sku" className={estiloCampo} /></Campo>
        <Campo etiqueta="Unidad de venta">
          <select name="unidad" defaultValue="paquete" className={estiloCampo}>
            <option value="paquete">Paquete</option>
            <option value="unidad">Unidad</option>
          </select>
        </Campo>
      </div>
      <Mensajes estado={estado} />
      <button disabled={cargando} className={estiloBotonChico}>Agregar producto</button>
    </form>
  );
}

export function AgregarLista() {
  const [estado, enviar, cargando] = useActionState(agregarLista, undefined);
  return (
    <form key={JSON.stringify(estado ?? null)} action={enviar} className="space-y-3">
      <Campo etiqueta="Nombre de la lista" ayuda="Ej: VACALIN. Después se la asignas a cada cliente en su ficha.">
        <input name="nombre" required className={estiloCampo} />
      </Campo>
      <Mensajes estado={estado} />
      <button disabled={cargando} className={estiloBotonChico}>Agregar lista</button>
    </form>
  );
}
