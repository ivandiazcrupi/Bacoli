"use client";

import { useActionState } from "react";
import { Campo, Mensajes, estiloBoton, estiloBotonChico, estiloCampo, estiloDato } from "@/components/campos";
import { crearLista, crearProducto, guardarPrecios, guardarProducto, type EstadoPrecios } from "./actions";

type Lista = { id: string; nombre: string };
type Producto = { id: string; nombre: string; sku: string | null; unidad: string; orden: number };

// Una sola lista a la vez: a la izquierda nombre y código, a la derecha el precio.
export function GrillaPrecios({ lista, productos, precios }: { lista: Lista; productos: Producto[]; precios: Record<string, string> }) {
  const [estado, enviar, cargando] = useActionState(guardarPrecios.bind(null, lista.id), undefined);
  return (
    <form key={lista.id + JSON.stringify(estado ?? null)} action={enviar} className="space-y-5">
      <ul>
        {productos.map((p) => (
          <li key={p.id} className="border-b border-stone-300 last:border-b-0">
            <label className="flex items-center justify-between gap-4 py-3">
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-crema-200 text-xs font-bold text-verde-800">{p.orden}</span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.nombre}</span>
                  <span className="block text-xs text-stone-500">{p.sku ?? "Sin código"}</span>
                </span>
              </span>
              <span className="relative shrink-0">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden="true">$</span>
                <input
                  name={`p_${p.id}`}
                  aria-label={`Precio de ${p.nombre} en la lista ${lista.nombre}`}
                  inputMode="decimal"
                  defaultValue={estado?.valores?.[`p_${p.id}`] ?? precios[p.id] ?? ""}
                  className="w-32 rounded-lg sm:w-40 border border-stone-200 bg-stone-50 py-3 pl-7 pr-3 text-right text-lg font-semibold tabular-nums focus:border-verde-600 focus:bg-white focus:outline-none"
                />
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="text-xs text-stone-500">Dejá vacío si ese producto no tiene precio en esta lista.</p>
      <Mensajes estado={estado} />
      <div className="flex justify-end"><button disabled={cargando} className="rounded-lg bg-verde-700 px-6 py-3 font-semibold text-white hover:bg-verde-800 disabled:opacity-60">{cargando ? "Guardando…" : `Guardar precios de ${lista.nombre}`}</button></div>
    </form>
  );
}

export function EditarProducto({ producto }: { producto: Producto & { ean: string | null; descripcion: string | null } }) {
  const [estado, enviar, cargando] = useActionState(guardarProducto.bind(null, producto.id), undefined as EstadoPrecios);
  const v = (c: string, inicial: string) => estado?.valores?.[c] ?? inicial;
  return (
    <form key={JSON.stringify(estado ?? null)} action={enviar} className="space-y-3 rounded-xl bg-stone-50 p-4">
      <Campo etiqueta="Nombre"><input name="nombre" autoCapitalize="characters" defaultValue={v("nombre", producto.nombre)} required className={estiloDato} /></Campo>
      <div className="grid grid-cols-3 gap-3">
        <Campo etiqueta="Código (SKU)"><input name="sku" autoCapitalize="characters" defaultValue={v("sku", producto.sku ?? "")} className={estiloDato} /></Campo>
        <Campo etiqueta="Orden"><input name="orden" inputMode="numeric" defaultValue={v("orden", String(producto.orden))} className={estiloCampo} /></Campo>
        <Campo etiqueta="Se vende por">
          <select name="unidad" defaultValue={v("unidad", producto.unidad)} className={estiloCampo}>
            <option value="paquete">Paquete</option>
            <option value="unidad">Unidad</option>
          </select>
        </Campo>
      </div>
      <Campo etiqueta="Descripción para el remito"><input name="descripcion" autoCapitalize="characters" defaultValue={v("descripcion", producto.descripcion ?? "")} className={estiloDato} /></Campo>
      <Campo etiqueta="EAN (código de barras)" ayuda="Opcional. Entre 8 y 14 números."><input name="ean" inputMode="numeric" defaultValue={v("ean", producto.ean ?? "")} className={estiloCampo} /></Campo>
      <Mensajes estado={estado} />
      <button disabled={cargando} className={estiloBoton}>{cargando ? "Guardando…" : "Guardar producto"}</button>
    </form>
  );
}

export function AgregarProducto() {
  const [estado, enviar, cargando] = useActionState(crearProducto, undefined);
  return (
    <form key={JSON.stringify(estado ?? null)} action={enviar} className="space-y-3">
      <Campo etiqueta="Nombre"><input name="nombre" autoCapitalize="characters" defaultValue={estado?.valores?.nombre ?? ""} required className={estiloDato} /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Código (SKU)"><input name="sku" autoCapitalize="characters" defaultValue={estado?.valores?.sku ?? ""} className={estiloDato} /></Campo>
        <Campo etiqueta="Se vende por">
          <select name="unidad" defaultValue={estado?.valores?.unidad ?? "paquete"} className={estiloCampo}>
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

export function AgregarLista({ listas }: { listas: Lista[] }) {
  const [estado, enviar, cargando] = useActionState(crearLista, undefined);
  return (
    <form key={JSON.stringify(estado ?? null)} action={enviar} className="space-y-3">
      <Campo etiqueta="Nombre de la lista" ayuda="Ej: ABASTECEDOR. Después se la asignas a cada cliente en su ficha.">
        <input name="nombre" autoCapitalize="characters" defaultValue={estado?.valores?.nombre ?? ""} required className={estiloDato} />
      </Campo>
      <Campo etiqueta="Precios iniciales">
        <select name="copiarDe" defaultValue={estado?.valores?.copiarDe ?? ""} className={estiloCampo}>
          <option value="">Empezar vacía</option>
          {listas.map((l) => <option key={l.id} value={l.id}>Copiar los de {l.nombre}</option>)}
        </select>
      </Campo>
      <Mensajes estado={estado} />
      <button disabled={cargando} className={estiloBotonChico}>Crear lista</button>
    </form>
  );
}
