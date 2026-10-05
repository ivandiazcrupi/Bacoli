"use client";

import { useActionState } from "react";
import { Mensajes, estiloBoton } from "@/components/campos";
import { formatoPesos } from "@/lib/numeros";
import { marcarEntregado, type EstadoPedidoForm } from "../actions";
import { NotaEditable } from "./NotaEditable";

export type Renglon = { id: string; nombre: string; sku: string | null; unidad: string; precio: number; cantidad: number; entregada: number | null; sinCargo: number; motivoSinCargo: string | null; descuentoPct: number };
type Totales = { tasas: { tasa: number; iva: number }[]; bruto: number; descuento: number; base: number; iva: number; ivaPct: number; total: number; conFactura: boolean; sinCargoPaquetes: number; sinCargoValor: number };

const COLUMNAS = "lg:grid-cols-[minmax(0,2fr)_7rem_7rem_8rem_9rem]";
const COLUMNAS_WEB = "lg:grid-cols-[minmax(0,2fr)_9rem_9rem]"; // la tienda no tiene precio por renglón: vale el total pagado

// Los productos del pedido en una tabla a lo ancho. Si el pedido está abierto, la columna ENTREGADO se edita y abajo está "Confirmar entrega".
export function TablaPedido({ pedidoId, abierto, entregado, items, totales, nota, web = false, pagoMp = false, pagoTexto = null, sinPagoWeb = false }: { pedidoId: string; abierto: boolean; entregado: boolean; items: Renglon[]; totales: Totales; nota: string; web?: boolean; pagoMp?: boolean; pagoTexto?: string | null; sinPagoWeb?: boolean }) {
  const cols = web ? COLUMNAS_WEB : COLUMNAS;
  const [estado, enviar, cargando] = useActionState(marcarEntregado.bind(null, pedidoId), undefined as EstadoPedidoForm);
  const ivaTexto = String(totales.ivaPct).replace(".", ",");

  return (
    <form
      id="form-entrega"
      action={enviar}
      onSubmit={(e) => {
        const cobro = new FormData(e.currentTarget).get("cobro");
        if ((cobro === "EFECTIVO" || cobro === "TRANSFERENCIA") && !window.confirm(`¿Confirmás que se COBRÓ ${formatoPesos(totales.total)} en ${cobro === "EFECTIVO" ? "efectivo" : "transferencia"}?`)) e.preventDefault();
      }}
      className="space-y-4"
    >
      <div className="overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm">
        <div className={`hidden gap-x-4 px-5 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-stone-600 lg:grid ${cols}`}>
          <span>Producto</span>{!web && <span>Precio</span>}<span>Pedido</span><span>Entregado</span>{!web && <span>Subtotal</span>}
        </div>
        {items.length === 0 && <p className="border-t border-stone-400 px-5 py-4 text-center text-sm text-stone-600">Comprobante cargado directamente: solo tiene el total.</p>}
        {items.map((i) => {
          const entregadaFinal = i.entregada ?? i.cantidad;
          const parcial = entregado && i.entregada !== null && i.entregada !== i.cantidad;
          return (
            <div key={i.id} className={`grid items-center gap-x-4 gap-y-1 border-t border-stone-400 px-5 py-2.5 text-center ${cols}`}>
              <div>
                <p className="font-semibold leading-snug">{i.nombre}</p>
                <p className="text-xs text-stone-500">{i.sku ?? ""} · por {i.unidad}</p>
              </div>
              {!web && <p className="text-sm tabular-nums">{formatoPesos(i.precio)}</p>}
              <p className="font-semibold tabular-nums">{i.cantidad}{i.sinCargo > 0 && <span className="block text-xs font-normal text-stone-600">+ {i.sinCargo} sin cargo{i.motivoSinCargo ? ` (${i.motivoSinCargo.toLowerCase()})` : ""}</span>}{i.descuentoPct > 0 && <span className="block text-xs font-normal text-stone-600">bonif. {String(i.descuentoPct).replace(".", ",")}%</span>}</p>
              <div>
                {abierto ? (
                  <input
                    name={`e_${i.id}`}
                    aria-label={`Entregado de ${i.nombre}`}
                    inputMode="numeric"
                    defaultValue={i.entregada ?? i.cantidad}
                    className="h-9 w-20 rounded-md border border-stone-400 bg-white text-center text-base tabular-nums"
                  />
                ) : entregado ? (
                  <p className={`font-semibold tabular-nums ${parcial ? "text-rojo-700" : ""}`}>{entregadaFinal}</p>
                ) : (
                  <span className="text-stone-400">—</span>
                )}
              </div>
              {!web && <p className="text-sm font-semibold tabular-nums">{formatoPesos((entregado ? entregadaFinal : i.cantidad) * i.precio * (1 - i.descuentoPct / 100))}</p>}
            </div>
          );
        })}
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-stone-600">Observación</p>
          <NotaEditable pedidoId={pedidoId} inicial={nota} />
          <Mensajes estado={estado} />
        </div>
        <div className="rounded-xl border border-stone-300 bg-white p-4 text-sm shadow-sm">
          {(totales.conFactura || totales.descuento > 0.004) && <div className="flex justify-between"><span className="text-stone-600">Subtotal</span><span className="tabular-nums">{formatoPesos(totales.bruto)}</span></div>}
          {totales.descuento > 0.004 && <div className="flex justify-between text-rojo-700"><span>Bonificación</span><span className="tabular-nums">−{formatoPesos(totales.descuento)}</span></div>}
          {totales.descuento > 0.004 && totales.conFactura && <div className="flex justify-between"><span className="text-stone-600">Neto</span><span className="tabular-nums">{formatoPesos(totales.base)}</span></div>}
          {totales.conFactura && (totales.tasas.length > 0 ? totales.tasas.map((l) => <div key={l.tasa} className="flex justify-between"><span className="text-stone-600">IVA {String(l.tasa).replace(".", ",")}%</span><span className="tabular-nums">{formatoPesos(l.iva)}</span></div>) : <div className="flex justify-between"><span className="text-stone-600">IVA {ivaTexto}%</span><span className="tabular-nums">{formatoPesos(totales.iva)}</span></div>)}
          <div className={`flex justify-between text-lg font-bold ${totales.conFactura ? "mt-1 border-t border-stone-300 pt-2" : ""}`}><span>Total</span><span className="tabular-nums">{formatoPesos(totales.total)}</span></div>
          {abierto && (
            <label className="mt-2 block text-xs font-semibold uppercase tracking-wide text-stone-600">
              ¿Cómo se cobra? {pagoMp && <span className="font-normal normal-case text-stone-500">(ya pagado · {pagoTexto})</span>}
              {sinPagoWeb && <span className="mt-1 block text-sm font-semibold normal-case text-rojo-700">Falta confirmar la transferencia: sin pago no sale de fábrica.</span>}
              {!pagoMp && !sinPagoWeb && (
                <select name="cobro" required defaultValue="" className="mt-1 h-10 w-full rounded-md border border-stone-400 bg-white px-2 text-sm font-medium normal-case text-stone-900">
                  <option value="" disabled hidden>Elegí una opción…</option>
                  <option value="EFECTIVO">Pago · Efectivo</option>
                  <option value="TRANSFERENCIA">Pago · Transferencia</option>
                  {!web && <option value="CC">Cuenta corriente</option>}
                </select>
              )}
            </label>
          )}
          {totales.sinCargoPaquetes > 0 && <p className="mt-1 border-t border-stone-300 pt-1.5 text-xs text-stone-600">Sin cargo: <b>{totales.sinCargoPaquetes}</b> {totales.sinCargoPaquetes === 1 ? "paquete" : "paquetes"} · valor {formatoPesos(totales.sinCargoValor)} (no se cobra)</p>}
        </div>
      </div>
    </form>
  );
}

export function BotonConAviso({ texto, aviso, clase }: { texto: string; aviso: string; clase: string }) {
  return (
    <button
      className={clase}
      onClick={(e) => {
        if (!window.confirm(aviso)) e.preventDefault();
      }}
    >
      {texto}
    </button>
  );
}

export { estiloBoton };
