"use client";

import { useActionState } from "react";
import { Mensajes, estiloBoton, estiloCampo } from "@/components/campos";
import type { EstadoForm } from "./validacion";

// Recuadros de precio por producto. Sirve para un cliente y para una marca: la acción ya viene con el destino aplicado.
export type FilaPrecio = { productoId: string; nombre: string; especial: string; textoVacio: string; textoLleno: string };

export function PreciosEspeciales({ accion, filas, pie }: { accion: (estado: EstadoForm, formData: FormData) => Promise<EstadoForm>; filas: FilaPrecio[]; pie: string }) {
  const [estado, enviar, cargando] = useActionState(accion, undefined);

  return (
    <form key={JSON.stringify(estado ?? null)} action={enviar} className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
      {filas.map((f) => (
        <label key={f.productoId} className="block text-sm font-medium">
          {f.nombre}
          <input
            name={`pe_${f.productoId}`}
            defaultValue={estado?.valores?.[`pe_${f.productoId}`] ?? f.especial}
            inputMode="decimal"
            placeholder="Usa el de su lista"
            className={estiloCampo}
          />
          <span className="mt-1 block text-xs font-normal text-stone-500">{f.especial ? f.textoLleno : f.textoVacio}</span>
        </label>
      ))}
      <p className="text-xs text-stone-500">{pie}</p>
      <Mensajes estado={estado} />
      <button disabled={cargando} className={estiloBoton}>{cargando ? "Guardando…" : "Guardar precios"}</button>
    </form>
  );
}
