"use client";

import { useActionState } from "react";
import { Mensajes, estiloBoton, estiloCampo } from "@/components/campos";
import { formatoPesos } from "@/lib/numeros";
import { guardarPreciosEspeciales } from "./actions";

type Fila = { productoId: string; nombre: string; especial: string; precioLista: number | null; descuentoPct: number };

export function PreciosEspeciales({ clienteId, filas, nombreLista }: { clienteId: string; filas: Fila[]; nombreLista: string | null }) {
  const [estado, enviar, cargando] = useActionState(guardarPreciosEspeciales.bind(null, clienteId), undefined);

  return (
    <form key={JSON.stringify(estado ?? null)} action={enviar} className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
      {filas.map((f) => {
        const conDescuento = f.precioLista === null ? null : f.precioLista * (1 - f.descuentoPct / 100);
        return (
          <label key={f.productoId} className="block text-sm font-medium">
            {f.nombre}
            <input name={`pe_${f.productoId}`} defaultValue={estado?.valores?.[`pe_${f.productoId}`] ?? f.especial} inputMode="decimal" placeholder="Precio de su lista" className={estiloCampo} />
            <span className="mt-1 block text-xs font-normal text-stone-500">
              {f.especial
                ? "Paga el precio especial (final, sin descuento encima)."
                : conDescuento === null
                  ? nombreLista ? `Su lista (${nombreLista}) no tiene precio para este producto.` : "Sin lista asignada."
                  : `Vacío: paga ${formatoPesos(conDescuento)} (lista ${nombreLista}${f.descuentoPct ? ` con ${f.descuentoPct}% de descuento` : ""}).`}
            </span>
          </label>
        );
      })}
      <p className="text-xs text-stone-500">Precio por paquete, sin IVA. Vale para todas las sucursales del cliente.</p>
      <Mensajes estado={estado} />
      <button disabled={cargando} className={estiloBoton}>{cargando ? "Guardando…" : "Guardar precios especiales"}</button>
    </form>
  );
}
