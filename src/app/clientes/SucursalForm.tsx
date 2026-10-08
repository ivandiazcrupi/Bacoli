"use client";

import { useActionState } from "react";
import { cabeceraTabla, estiloCampo } from "@/components/campos";
import { titulo } from "@/lib/mayusculas";
import { cambiarActivoSucursal, eliminarSucursal, guardarSucursal } from "./actions";

export type DatosSucursal = { id: string; alias: string; direccion: string; barrio: string; zonaId: string; telefono: string; comentario: string; cuit: string; activo: boolean };
type Zona = { id: string; nombre: string };

// CUIT propio de la sucursal (franquicias): apagado por ahora (pedido del dueño). Los datos y la lógica siguen; para volver a mostrarlo, ponerlo en true.
const MOSTRAR_CUIT = false;

// Columnas de la fila (PC): barrio, dirección, zona, teléfono, comentario y los botones.
const COLUMNAS = MOSTRAR_CUIT ? "lg:grid-cols-[1.4fr_2.1fr_1.2fr_1.3fr_1.4fr_1.5fr_19.5rem]" : "lg:grid-cols-[1.5fr_2.3fr_1.3fr_1.4fr_1.5fr_19.5rem]";
const celda = "min-w-0";
const campo = `${estiloCampo} mt-0 py-3 text-base`;
const boton = "rounded-md px-4 py-3 text-sm font-semibold shadow-sm";
const etiquetaChica = "mb-0.5 block text-xs font-medium text-stone-500 lg:hidden";

/** Encabezado de las columnas (solo en PC: en el celular cada campo trae su etiqueta). */
export function EncabezadoSucursales() {
  return (
    <div className={`hidden gap-2 px-5 py-3.5 lg:grid ${cabeceraTabla} ${COLUMNAS}`}>
      <span>Barrio *</span><span>Dirección *</span><span>Zona *</span><span>Teléfono</span>{MOSTRAR_CUIT && <span title="Solo si la sucursal tiene un CUIT distinto al del cliente (franquicia)">CUIT propio</span>}<span>Comentario</span><span className="w-[19.5rem]" />
    </div>
  );
}

// Una sucursal por fila, siempre visible y editable. Con `sucursal` edita; sin ella, agrega una nueva.
export function FilaSucursal({ clienteId, sucursal, zonas, barrios }: { clienteId: string; sucursal?: DatosSucursal; zonas: Zona[]; barrios: string[] }) {
  const [estado, enviar, cargando] = useActionState(guardarSucursal.bind(null, clienteId, sucursal?.id ?? null), undefined);
  const v = (c: "alias" | "direccion" | "barrio" | "zonaId" | "telefono" | "comentario" | "cuit") => estado?.valores?.[c] ?? sucursal?.[c] ?? "";
  const [estadoBorrar, borrar] = useActionState(eliminarSucursal, undefined);
  const activa = sucursal?.activo ?? true;

  return (
    <div
      className={`grid grid-cols-2 items-end gap-3 border-t border-stone-300 px-5 py-4 lg:items-center ${COLUMNAS} ${sucursal ? "bg-white even:bg-crema-50" : "border-t-2 border-t-verde-700 bg-crema-100"} ${activa ? "" : "opacity-60"}`}
    >
      <form key={JSON.stringify(estado ?? null)} action={enviar} className="contents">
        {sucursal && <input type="hidden" name="id" value={sucursal.id} />}
        <label className={celda}>
          <span className={etiquetaChica}>Barrio *</span>
          <input name="barrio" aria-label="Barrio" placeholder={sucursal ? "" : "Barrio"} autoCapitalize="characters" defaultValue={v("barrio")} required className={`${campo} dato`} />
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
        {MOSTRAR_CUIT ? (
          <label className={celda}>
            <span className={etiquetaChica}>CUIT propio (si es otro)</span>
            <input name="cuit" aria-label="CUIT propio de la sucursal" placeholder={sucursal ? "" : "CUIT propio"} inputMode="numeric" defaultValue={v("cuit")} title="Solo si la sucursal tiene un CUIT distinto al del cliente (franquicia). Vacío = usa el del cliente." className={campo} />
          </label>
        ) : (
          <input type="hidden" name="cuit" value={v("cuit")} /> /* se conserva lo que ya tenía cargado */
        )}
        <label className={celda}>
          <span className={etiquetaChica}>Comentario</span>
          <input name="comentario" aria-label="Comentario" placeholder={sucursal ? "" : "Ej: recibe hasta las 10 hs"} defaultValue={v("comentario")} className={campo} />
        </label>
        <div className="col-span-2 flex items-center gap-2 lg:col-span-1 lg:w-auto">
          <button disabled={cargando} className={`${boton} bg-verde-700 text-white hover:bg-verde-800 disabled:opacity-60`}>
            {cargando ? "…" : sucursal ? "Guardar" : "+ Agregar"}
          </button>
          {sucursal && (
            <button formAction={cambiarActivoSucursal} formNoValidate className={`${boton} border border-stone-400 bg-white hover:border-verde-700`}>
              {activa ? "Desactivar" : "Activar"}
            </button>
          )}
          {sucursal && (
            <button
              formAction={borrar}
              formNoValidate
              onClick={(e) => { if (!window.confirm(`¿Eliminar la sucursal ${sucursal.direccion}? No se puede deshacer.`)) e.preventDefault(); }}
              className={`${boton} border border-rojo-600 bg-white text-rojo-700 hover:bg-rojo-50`}
            >
              Eliminar
            </button>
          )}
        </div>
      </form>
      {[estado, estadoBorrar].map((e, i) => (e?.error || e?.ok) && (
        <p key={i} className={`col-span-full text-sm ${e.error ? "text-rojo-700" : "text-verde-700"}`}>{e.error ?? e.ok}</p>
      ))}
    </div>
  );
}

