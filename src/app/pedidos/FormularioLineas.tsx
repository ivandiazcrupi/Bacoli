"use client";

import { useActionState, useEffect, useState } from "react";
import { Mensajes, estiloBoton } from "@/components/campos";
import { IVA_PCT } from "@/lib/cuenta";
import { formatoPesos, leerMonto } from "@/lib/numeros";
import type { EstadoPedidoForm } from "./actions";

export type LineaProducto = { id: string; nombre: string; sku: string | null; unidad: string; precio: string | null; cantidad: number };

type Props = {
  accion: (estado: EstadoPedidoForm, formData: FormData) => Promise<EstadoPedidoForm>;
  puntoId: string;
  productos: LineaProducto[];
  conFacturaInicial: boolean;
  notaInicial: string;
  esDueno: boolean;
  textoBoton: string;
  alGuardar?: (mensaje: string) => void;
};

const boton = "flex h-11 w-11 items-center justify-center rounded-md border border-stone-400 bg-white text-xl font-medium hover:bg-crema-100 lg:h-9 lg:w-9 lg:text-lg";
const COLUMNAS = "lg:grid-cols-[minmax(0,2fr)_6rem_10rem_11rem_10rem]";

// Productos con cantidad y precio, en una tabla a lo ancho. Al tocar + / − o escribir el número, el total se calcula al instante.
export function FormularioLineas({ accion, puntoId, productos, conFacturaInicial, notaInicial, esDueno, textoBoton, alGuardar }: Props) {
  const [estado, enviar, cargando] = useActionState(accion, undefined);
  const [cantidades, setCantidades] = useState<Record<string, string>>(() => Object.fromEntries(productos.map((p) => [p.id, p.cantidad ? String(p.cantidad) : ""])));
  const [precios, setPrecios] = useState<Record<string, string>>(() => Object.fromEntries(productos.map((p) => [p.id, p.precio ?? ""])));
  const [conFactura, setConFactura] = useState(conFacturaInicial);

  useEffect(() => {
    if (estado?.ok) alGuardar?.(estado.ok);
  }, [estado, alGuardar]);

  const cantidad = (id: string) => Number(cantidades[id]?.replace(/\D/g, "") || 0);
  const cambiar = (id: string, delta: number) => setCantidades((c) => ({ ...c, [id]: String(Math.max(0, cantidad(id) + delta) || "") }));
  const subtotal = productos.reduce((s, p) => s + cantidad(p.id) * (leerMonto(precios[p.id]) ?? 0), 0);
  const iva = conFactura ? subtotal * (IVA_PCT / 100) : 0;
  const ivaTexto = String(IVA_PCT).replace(".", ",");

  return (
    <form action={enviar} className="space-y-4">
      <input type="hidden" name="puntoId" value={puntoId} />
      <input type="hidden" name="conFactura" value={conFactura ? "1" : "0"} />

      <div className="overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm">
        <div className={`hidden gap-x-4 px-5 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-stone-600 lg:grid ${COLUMNAS}`}>
          <span>Producto</span><span>Unidad</span><span>Precio</span><span>Cantidad</span><span>Subtotal</span>
        </div>
        {productos.map((p) => {
          const q = cantidad(p.id);
          const precio = leerMonto(precios[p.id]) ?? 0;
          const sinPrecio = q > 0 && !precio;
          return (
            <div key={p.id} className={`grid items-center gap-x-4 gap-y-2 border-t border-stone-400 px-5 py-2.5 text-center ${COLUMNAS} ${q > 0 ? "bg-crema-50" : "bg-white"}`}>
              <div>
                <p className="font-semibold leading-snug">{p.nombre}</p>
                <p className="text-xs text-stone-500">{p.sku ?? ""}</p>
              </div>
              <p className="text-sm text-stone-600">{p.unidad}</p>
              <label className="flex items-center justify-center gap-1.5 text-sm text-stone-600 lg:block">
                <span className="lg:hidden">Precio</span>
                <span className="relative inline-block">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden="true">$</span>
                  <input
                    name={`pr_${p.id}`}
                    aria-label={`Precio de ${p.nombre}`}
                    inputMode="decimal"
                    value={precios[p.id] ?? ""}
                    onChange={(e) => setPrecios((x) => ({ ...x, [p.id]: e.target.value }))}
                    className={`h-9 w-32 rounded-md border bg-white pl-5 pr-2 text-center tabular-nums text-stone-900 ${sinPrecio ? "border-rojo-600" : "border-stone-400"}`}
                  />
                </span>
              </label>
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
              <p className="text-sm font-semibold tabular-nums">
                {sinPrecio ? <span className="text-xs font-medium text-rojo-700">Falta el precio</span> : q > 0 ? formatoPesos(q * precio) : <span className="font-normal text-stone-400">—</span>}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_1fr_20rem]">
        <div className="rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-stone-600">Comprobante</p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de comprobante">
            {[
              { valor: false, texto: "Con remito" },
              { valor: true, texto: `Con factura (+${ivaTexto}% IVA)` },
            ].map((o) => (
              <button
                key={String(o.valor)}
                type="button"
                aria-pressed={conFactura === o.valor}
                onClick={() => setConFactura(o.valor)}
                className={`rounded-md border px-3 py-2.5 text-sm font-medium ${conFactura === o.valor ? "border-stone-800 bg-stone-800 text-white" : "border-stone-400 bg-white hover:bg-crema-100"}`}
              >
                {o.texto}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
          <span className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-stone-600">Nota (opcional)</span>
          <input name="nota" defaultValue={notaInicial} className="w-full rounded-md border border-stone-400 bg-white px-3 py-2.5 text-base" />
        </label>

        <div className="rounded-xl border border-stone-300 bg-white p-4 text-sm shadow-sm">
          <div className="flex justify-between"><span className="text-stone-600">Subtotal</span><span className="tabular-nums">{formatoPesos(subtotal)}</span></div>
          {conFactura && <div className="flex justify-between"><span className="text-stone-600">IVA {ivaTexto}%</span><span className="tabular-nums">{formatoPesos(iva)}</span></div>}
          <div className="mt-1 flex justify-between border-t border-stone-300 pt-2 text-lg font-bold"><span>Total</span><span className="tabular-nums">{formatoPesos(subtotal + iva)}</span></div>
          <button disabled={cargando} className={`${estiloBoton} mt-3`}>{cargando ? "Guardando…" : textoBoton}</button>
        </div>
      </div>

      {estado?.aviso && (
        <div className="space-y-3 rounded-lg border border-rojo-600 bg-rojo-50 p-4 text-sm">
          <p>{estado.aviso}</p>
          {esDueno && <button name="autorizar" value="1" disabled={cargando} className={`${estiloBoton} lg:w-auto lg:px-6`}>Autorizar y guardar el pedido</button>}
        </div>
      )}
      <Mensajes estado={estado} />
    </form>
  );
}
