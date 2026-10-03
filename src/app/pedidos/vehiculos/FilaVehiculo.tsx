"use client";

import { titulo } from "@/lib/mayusculas";
import { useActionState } from "react";
import { cabeceraTabla, estiloCampo } from "@/components/campos";
import { cambiarActivoVehiculo, eliminarVehiculo, guardarVehiculo } from "../ruta/actions";

export type DatosVehiculo = { id: string; nombre: string; patente: string; capacidad: string; activo: boolean };

const COLUMNAS = "lg:grid-cols-[2fr_1.2fr_1.4fr_23rem]";
const campo = `${estiloCampo} mt-0 py-3 text-base`;
const boton = "rounded-md px-4 py-3 text-sm font-semibold shadow-sm";
const etiquetaChica = "mb-0.5 block text-xs font-semibold text-stone-600 lg:hidden";

export function EncabezadoVehiculos() {
  return (
    <div className={`hidden gap-3 px-5 py-3.5 lg:grid ${cabeceraTabla} ${COLUMNAS}`}>
      <span>Vehículo</span><span>Patente</span><span>Capacidad máxima (paquetes)</span><span className="w-[23rem]" />
    </div>
  );
}

// Un vehículo por fila, editable ahí mismo. Sin `vehiculo`, agrega uno nuevo.
export function FilaVehiculo({ vehiculo }: { vehiculo?: DatosVehiculo }) {
  const [estado, enviar, cargando] = useActionState(guardarVehiculo.bind(null, vehiculo?.id ?? null), undefined);
  const [estadoBorrar, borrar] = useActionState(eliminarVehiculo, undefined);
  const v = (c: "nombre" | "patente" | "capacidad") => estado?.valores?.[c] ?? vehiculo?.[c] ?? "";
  const activo = vehiculo?.activo ?? true;

  return (
    <div className={`grid grid-cols-2 items-end gap-3 border-t border-stone-300 px-5 py-4 lg:items-center ${COLUMNAS} ${vehiculo ? "bg-white even:bg-crema-50" : "border-t-2 border-t-verde-700 bg-crema-100"} ${activo ? "" : "opacity-60"}`}>
      <form key={JSON.stringify(estado ?? null)} action={enviar} className="contents">
        {vehiculo && <input type="hidden" name="id" value={vehiculo.id} />}
        <label className="col-span-2 min-w-0 lg:col-span-1">
          <span className={etiquetaChica}>Vehículo</span>
          <input name="nombre" aria-label="Nombre del vehículo" placeholder="Ej: Camioneta 1" autoCapitalize="words" defaultValue={titulo(v("nombre"))} required className={campo} />
        </label>
        <label className="min-w-0">
          <span className={etiquetaChica}>Patente</span>
          <input name="patente" aria-label="Patente" placeholder="Opcional" autoCapitalize="characters" defaultValue={v("patente")} className={`${campo} dato`} />
        </label>
        <label className="min-w-0">
          <span className={etiquetaChica}>Capacidad máxima (paquetes)</span>
          <input name="capacidad" aria-label="Capacidad máxima en paquetes" inputMode="numeric" placeholder="Sin tope" defaultValue={v("capacidad")} className={campo} />
        </label>
        <div className="col-span-2 flex flex-wrap items-center gap-3 lg:col-span-1 lg:w-[23rem] lg:flex-nowrap">
          <button disabled={cargando} className={`${boton} bg-verde-700 text-white hover:bg-verde-800 disabled:opacity-60`}>{cargando ? "…" : vehiculo ? "Guardar" : "+ Agregar"}</button>
          {vehiculo && (
            <>
              <button formAction={cambiarActivoVehiculo} formNoValidate className={`${boton} border border-stone-400 bg-white hover:border-verde-700`}>{activo ? "Desactivar" : "Activar"}</button>
              <button
                formAction={borrar}
                formNoValidate
                onClick={(e) => { if (!window.confirm(`¿Eliminar el vehículo ${vehiculo.nombre}? Si ya salió a repartir, se oculta pero las hojas de ruta viejas conservan su nombre.`)) e.preventDefault(); }}
                className={`${boton} border border-rojo-600 bg-white text-rojo-700 hover:bg-rojo-50`}
              >
                Eliminar
              </button>
            </>
          )}
        </div>
      </form>
      {[estado, estadoBorrar].map((e, i) => (e?.error || e?.ok) && (
        <p key={i} className={`col-span-full text-sm ${e.error ? "text-rojo-700" : "text-verde-800"}`}>{e.error ?? e.ok}</p>
      ))}
    </div>
  );
}
