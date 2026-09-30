"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Campo, Mensajes, estiloBoton, estiloBotonChico, estiloCampo } from "@/components/campos";
import { crearLista, crearProducto, guardarPrecios, guardarProducto, type EstadoPrecios } from "./actions";

type Lista = { id: string; nombre: string };
type Producto = { id: string; nombre: string; sku: string | null; unidad: string; orden: number };

export function SelectorLista({ listas, actual }: { listas: Lista[]; actual: string }) {
  const router = useRouter();
  return (
    <label className="block text-xs font-medium uppercase tracking-wide text-stone-500">
      Lista de precios
      <select
        value={actual}
        onChange={(e) => router.push(`/precios?lista=${e.target.value}`)}
        className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-3 text-base font-semibold normal-case tracking-normal text-stone-900"
      >
        {listas.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
      </select>
    </label>
  );
}

// Una sola lista a la vez: a la izquierda nombre y código, a la derecha el precio.
export function GrillaPrecios({ lista, productos, precios }: { lista: Lista; productos: Producto[]; precios: Record<string, string> }) {
  const [estado, enviar, cargando] = useActionState(guardarPrecios.bind(null, lista.id), undefined);
  return (
    <form key={lista.id + JSON.stringify(estado ?? null)} action={enviar} className="space-y-4">
      <ul className="divide-y divide-stone-200 border-y border-stone-200">
        {productos.map((p) => (
          <li key={p.id}>
            <label className="flex items-center justify-between gap-4 py-3">
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.nombre}</span>
                <span className="block text-xs text-stone-500">{p.sku ?? "Sin código"}</span>
              </span>
              <span className="relative shrink-0">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden="true">$</span>
                <input
                  name={`p_${p.id}`}
                  aria-label={`Precio de ${p.nombre} en la lista ${lista.nombre}`}
                  inputMode="decimal"
                  defaultValue={estado?.valores?.[`p_${p.id}`] ?? precios[p.id] ?? ""}
                  className="w-36 rounded-md border border-stone-200 bg-white py-3 pl-7 pr-3 text-right text-base tabular-nums"
                />
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="text-xs text-stone-500">Precios sin IVA, por la unidad de venta de cada producto. Vacío = sin precio.</p>
      <Mensajes estado={estado} />
      <button disabled={cargando} className={estiloBoton}>{cargando ? "Guardando…" : `Guardar precios de ${lista.nombre}`}</button>
    </form>
  );
}

export function EditarProducto({ producto }: { producto: Producto & { ean: string | null; descripcion: string | null } }) {
  const [estado, enviar, cargando] = useActionState(guardarProducto.bind(null, producto.id), undefined as EstadoPrecios);
  const v = (c: string, inicial: string) => estado?.valores?.[c] ?? inicial;
  return (
    <form key={JSON.stringify(estado ?? null)} action={enviar} className="space-y-3">
      <Campo etiqueta="Nombre"><input name="nombre" defaultValue={v("nombre", producto.nombre)} required className={`${estiloCampo} uppercase`} /></Campo>
      <div className="grid grid-cols-3 gap-3">
        <Campo etiqueta="Código (SKU)"><input name="sku" defaultValue={v("sku", producto.sku ?? "")} className={`${estiloCampo} uppercase`} /></Campo>
        <Campo etiqueta="Orden"><input name="orden" inputMode="numeric" defaultValue={v("orden", String(producto.orden))} className={estiloCampo} /></Campo>
        <Campo etiqueta="Se vende por">
          <select name="unidad" defaultValue={v("unidad", producto.unidad)} className={estiloCampo}>
            <option value="paquete">Paquete</option>
            <option value="unidad">Unidad</option>
          </select>
        </Campo>
      </div>
      <Campo etiqueta="Descripción para el remito"><input name="descripcion" defaultValue={v("descripcion", producto.descripcion ?? "")} className={estiloCampo} /></Campo>
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
      <Campo etiqueta="Nombre"><input name="nombre" defaultValue={estado?.valores?.nombre ?? ""} required className={`${estiloCampo} uppercase`} /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Código (SKU)"><input name="sku" defaultValue={estado?.valores?.sku ?? ""} className={`${estiloCampo} uppercase`} /></Campo>
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
        <input name="nombre" defaultValue={estado?.valores?.nombre ?? ""} required className={estiloCampo} />
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
