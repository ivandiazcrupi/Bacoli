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

const boton = "flex h-11 w-11 items-center justify-center rounded-lg border border-stone-300 bg-white text-xl font-medium active:bg-stone-100";

// Productos con cantidad y precio. Al tocar + / − o escribir el número, el total se calcula al instante.
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

  return (
    <form action={enviar} className="space-y-5">
      <input type="hidden" name="puntoId" value={puntoId} />
      <input type="hidden" name="conFactura" value={conFactura ? "1" : "0"} />

      <ul className="divide-y divide-stone-200 border-y border-stone-200">
        {productos.map((p) => {
          const q = cantidad(p.id);
          const sinPrecio = q > 0 && !leerMonto(precios[p.id]);
          return (
            <li key={p.id} className={`space-y-2 py-3 ${q > 0 ? "bg-amber-50" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.nombre}</p>
                  <p className="text-xs text-stone-500">{p.sku ?? ""} · por {p.unidad}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" className={boton} onClick={() => cambiar(p.id, -1)} aria-label={`Menos ${p.nombre}`}>−</button>
                  <input
                    name={`q_${p.id}`}
                    aria-label={`Cantidad de ${p.nombre}`}
                    inputMode="numeric"
                    value={cantidades[p.id] ?? ""}
                    onChange={(e) => setCantidades((c) => ({ ...c, [p.id]: e.target.value.replace(/\D/g, "") }))}
                    placeholder="0"
                    className="h-11 w-16 rounded-lg border border-stone-300 bg-white text-center text-lg tabular-nums"
                  />
                  <button type="button" className={boton} onClick={() => cambiar(p.id, 1)} aria-label={`Más ${p.nombre}`}>+</button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <label className="flex items-center gap-2 text-stone-600">
                  Precio
                  <span className="relative">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden="true">$</span>
                    <input
                      name={`pr_${p.id}`}
                      inputMode="decimal"
                      value={precios[p.id] ?? ""}
                      onChange={(e) => setPrecios((x) => ({ ...x, [p.id]: e.target.value }))}
                      className={`h-9 w-28 rounded-md border bg-white pl-5 pr-2 text-right tabular-nums text-stone-900 ${sinPrecio ? "border-red-500" : "border-stone-200"}`}
                    />
                  </span>
                </label>
                <span className="tabular-nums text-stone-700">{q > 0 && !sinPrecio ? formatoPesos(q * (leerMonto(precios[p.id]) ?? 0)) : sinPrecio ? <span className="text-red-700">Falta el precio</span> : ""}</span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de comprobante">
        {[
          { valor: false, texto: "Con remito" },
          { valor: true, texto: `Con factura (+${String(IVA_PCT).replace(".", ",")}% IVA)` },
        ].map((o) => (
          <button
            key={String(o.valor)}
            type="button"
            aria-pressed={conFactura === o.valor}
            onClick={() => setConFactura(o.valor)}
            className={`rounded-lg border px-3 py-3 text-sm font-medium ${conFactura === o.valor ? "border-amber-700 bg-amber-700 text-white" : "border-stone-300 bg-white"}`}
          >
            {o.texto}
          </button>
        ))}
      </div>

      <label className="block text-sm font-medium">
        Nota (opcional)
        <input name="nota" defaultValue={notaInicial} className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-3 text-base" />
      </label>

      <div className="space-y-1 rounded-lg border border-stone-200 bg-white p-4 text-sm">
        <div className="flex justify-between"><span className="text-stone-600">Subtotal</span><span className="tabular-nums">{formatoPesos(subtotal)}</span></div>
        {conFactura && <div className="flex justify-between"><span className="text-stone-600">IVA {String(IVA_PCT).replace(".", ",")}%</span><span className="tabular-nums">{formatoPesos(iva)}</span></div>}
        <div className="flex justify-between border-t border-stone-200 pt-2 text-lg font-semibold"><span>Total</span><span className="tabular-nums">{formatoPesos(subtotal + iva)}</span></div>
      </div>

      {estado?.aviso && (
        <div className="space-y-3 rounded-lg border border-amber-600 bg-amber-50 p-4 text-sm">
          <p>{estado.aviso}</p>
          {esDueno && <button name="autorizar" value="1" disabled={cargando} className={estiloBoton}>Autorizar y guardar el pedido</button>}
        </div>
      )}
      <Mensajes estado={estado} />
      <button disabled={cargando} className={estiloBoton}>{cargando ? "Guardando…" : textoBoton}</button>
    </form>
  );
}
