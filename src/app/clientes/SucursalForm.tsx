"use client";

import { useActionState } from "react";
import { estiloCampo } from "@/components/campos";
import { titulo } from "@/lib/mayusculas";
import { cambiarActivoSucursal, eliminarSucursal, guardarSucursal } from "./actions";

export type DatosSucursal = { id: string; alias: string; direccion: string; barrio: string; zonaId: string; telefono: string; comentario: string; activo: boolean };
type Zona = { id: string; nombre: string };

// Columnas de la fila (PC): barrio, dirección, zona, teléfono, comentario y los botones.
const COLUMNAS = "lg:grid-cols-[1.6fr_2fr_1.4fr_1fr_1.2fr_auto]";
const celda = "min-w-0";
const campo = `${estiloCampo} mt-0 py-2 text-sm`;
const etiquetaChica = "mb-0.5 block text-xs font-medium text-stone-500 lg:hidden";

/** Encabezado de las columnas (solo en PC: en el celular cada campo trae su etiqueta). */
export function EncabezadoSucursales() {
  return (
    <div className={`hidden gap-2 px-4 text-xs font-semibold uppercase tracking-wide text-stone-500 lg:grid ${COLUMNAS}`}>
      <span>Barrio *</span><span>Dirección *</span><span>Zona *</span><span>Teléfono</span><span>Comentario</span><span className="w-[17rem]" />
    </div>
  );
}

// Una sucursal por fila, siempre visible y editable. Con `sucursal` edita; sin ella, agrega una nueva.
export function FilaSucursal({ clienteId, sucursal, zonas, barrios }: { clienteId: string; sucursal?: DatosSucursal; zonas: Zona[]; barrios: string[] }) {
  const [estado, enviar, cargando] = useActionState(guardarSucursal.bind(null, clienteId, sucursal?.id ?? null), undefined);
  const v = (c: "alias" | "direccion" | "barrio" | "zonaId" | "telefono" | "comentario") => estado?.valores?.[c] ?? sucursal?.[c] ?? "";
  const [estadoBorrar, borrar] = useActionState(eliminarSucursal, undefined);
  const activa = sucursal?.activo ?? true;

  return (
    <div
      className={`grid grid-cols-2 items-end gap-2 rounded-xl border p-4 lg:items-center ${COLUMNAS} ${sucursal ? "border-stone-200 bg-white" : "border-dashed border-amber-400 bg-amber-50/40"} ${activa ? "" : "opacity-60"}`}
    >
      <form key={JSON.stringify(estado ?? null)} action={enviar} className="contents">
        {sucursal && <input type="hidden" name="id" value={sucursal.id} />}
        <label className={celda}>
          <span className={etiquetaChica}>Barrio *</span>
          <input name="barrio" aria-label="Barrio" placeholder={sucursal ? "" : "Barrio"} autoCapitalize="characters" list="barrios-sucursal" defaultValue={v("barrio")} required className={`${campo} dato`} />
        </label>
        <label className={`${celda}`}>
          <span className={etiquetaChica}>Dirección *</span>
          <input name="direccion" aria-label="Dirección" placeholder={sucursal ? "" : "Dirección"} autoCapitalize="words" defaultValue={titulo(v("direccion"))} required className={campo} />
        </label>
        <label className={celda}>
          <span className={etiquetaChica}>Zona *</span>
          <select name="zonaId" aria-label="Zona de reparto" defaultValue={v("zonaId")} required className={campo}>
            <option value="" disabled hidden>Zona</option>
            {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
          </select>
        </label>
        <label className={celda}>
          <span className={etiquetaChica}>Teléfono</span>
          <input name="telefono" aria-label="Teléfono" placeholder={sucursal ? "" : "Teléfono"} inputMode="tel" defaultValue={v("telefono")} className={campo} />
        </label>
        <label className={celda}>
          <span className={etiquetaChica}>Comentario</span>
          <input name="comentario" aria-label="Comentario" placeholder={sucursal ? "" : "Ej: horario de entrega"} defaultValue={v("comentario")} className={campo} />
        </label>
        <div className="col-span-2 flex items-center gap-2 lg:col-span-1 lg:w-auto">
          <button disabled={cargando} className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-60">
            {cargando ? "…" : sucursal ? "Guardar" : "+ Agregar"}
          </button>
          {sucursal && (
            <button formAction={cambiarActivoSucursal} formNoValidate className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm">
              {activa ? "Desactivar" : "Activar"}
            </button>
          )}
          {sucursal && (
            <button
              formAction={borrar}
              formNoValidate
              onClick={(e) => { if (!window.confirm(`¿Eliminar la sucursal ${sucursal.direccion}? No se puede deshacer.`)) e.preventDefault(); }}
              className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-red-700 hover:bg-red-50"
            >
              Eliminar
            </button>
          )}
        </div>
      </form>
      {[estado, estadoBorrar].map((e, i) => (e?.error || e?.ok) && (
        <p key={i} className={`col-span-full text-sm ${e.error ? "text-red-700" : "text-green-700"}`}>{e.error ?? e.ok}</p>
      ))}
    </div>
  );
}

export function ListaBarrios({ barrios }: { barrios: string[] }) {
  return <datalist id="barrios-sucursal">{barrios.map((b) => <option key={b} value={b} />)}</datalist>;
}
