"use client";

import { useActionState } from "react";
import { Mensajes, estiloBoton, estiloBotonChico, estiloCampo } from "@/components/campos";
import { agregarLista, agregarProducto, guardarPrecios } from "./actions";

type Datos = {
  listas: { id: string; nombre: string }[];
  productos: { id: string; nombre: string }[];
  precios: Record<string, string>; // "listaId_productoId" -> texto
};

export function GrillaPrecios({ listas, productos, precios }: Datos) {
  const [estado, enviar, cargando] = useActionState(guardarPrecios, undefined);
  return (
    <form action={enviar} className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left">
              <th className="p-3">Producto (por paquete)</th>
              {listas.map((l) => <th key={l.id} className="p-3">{l.nombre}</th>)}
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id} className="border-b border-stone-100 last:border-0">
                <td className="p-3 font-medium">{p.nombre}</td>
                {listas.map((l) => (
                  <td key={l.id} className="p-2">
                    <input
                      name={`p_${l.id}_${p.id}`}
                      inputMode="decimal"
                      placeholder="$"
                      defaultValue={precios[`${l.id}_${p.id}`] ?? ""}
                      className={`${estiloCampo} mt-0 min-w-24 py-2`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-stone-500">Precios sin IVA, por paquete (2 prepizzas). Dejar vacío = sin precio.</p>
      <Mensajes estado={estado} />
      <button disabled={cargando} className={estiloBoton}>{cargando ? "Guardando…" : "Guardar precios"}</button>
    </form>
  );
}

function AgregarNombre({ etiqueta, accion }: { etiqueta: string; accion: typeof agregarProducto }) {
  const [estado, enviar, cargando] = useActionState(accion, undefined);
  return (
    <form action={enviar} className="space-y-2">
      <div className="flex gap-2">
        <input name="nombre" placeholder={etiqueta} required className={`${estiloCampo} mt-0`} />
        <button disabled={cargando} className={estiloBotonChico}>Agregar</button>
      </div>
      <Mensajes estado={estado} />
    </form>
  );
}

export const AgregarProducto = () => <AgregarNombre etiqueta="Nuevo producto" accion={agregarProducto} />;
export const AgregarLista = () => <AgregarNombre etiqueta="Nueva lista de precios" accion={agregarLista} />;
