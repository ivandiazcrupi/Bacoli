"use client";

import { useActionState } from "react";
import { Mensajes, estiloBoton } from "@/components/campos";
import { formatoPesos } from "@/lib/numeros";
import { marcarEntregado, type EstadoPedidoForm } from "../actions";
import { NotaEditable } from "./NotaEditable";

export type Renglon = { id: string; nombre: string; sku: string | null; unidad: string; precio: number; cantidad: number; entregada: number | null; sinCargo: number; motivoSinCargo: string | null; descuentoPct: number };
type Totales = { tasas: { tasa: number; iva: number }[]; bruto: number; descuento: number; base: number; iva: number; ivaPct: number; total: number; conFactura: boolean; sinCargoPaquetes: number; sinCargoValor: number };

const COLUMNAS = "lg:grid-cols-[minmax(0,2.2fr)_6.5rem_6rem_6.5rem_8rem]";
const COLUMNAS_WEB = "lg:grid-cols-[minmax(0,2.2fr)_7rem_7rem]"; // la tienda no tiene precio por renglón: vale el total pagado

// Cuerpo del pedido en dos columnas: a la izquierda los productos; a la derecha lo que se hace con ellos (total, cobro, confirmar entrega),
// la observación y las acciones (`lateral`, armadas en la página). El formulario de la entrega es invisible y sus campos se unen con form="form-entrega"
// (así las acciones del costado, que son formularios aparte, no quedan adentro de otro formulario).
export function TablaPedido({ pedidoId, abierto, entregado, items, totales, nota, lateral, rutaSalio, motivoApagado, web = false, pagoMp = false, pagoTexto = null, sinPagoWeb = false }: { pedidoId: string; abierto: boolean; entregado: boolean; items: Renglon[]; totales: Totales; nota: string; lateral: React.ReactNode; rutaSalio: boolean; motivoApagado: string; web?: boolean; pagoMp?: boolean; pagoTexto?: string | null; sinPagoWeb?: boolean }) {
  const cols = web ? COLUMNAS_WEB : COLUMNAS;
  const [estado, enviar] = useActionState(marcarEntregado.bind(null, pedidoId), undefined as EstadoPedidoForm);
  const ivaTexto = String(totales.ivaPct).replace(".", ",");
  const tarjeta = "rounded-xl border border-stone-300 bg-white shadow-sm";
  const titulo = "text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500";

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <form
        id="form-entrega"
        action={enviar}
        className="hidden"
        onSubmit={(e) => {
          const cobro = new FormData(e.currentTarget).get("cobro");
          if ((cobro === "EFECTIVO" || cobro === "TRANSFERENCIA") && !window.confirm(`¿Confirmás que se COBRÓ ${formatoPesos(totales.total)} en ${cobro === "EFECTIVO" ? "efectivo" : "transferencia"}?`)) e.preventDefault();
        }}
      />

      {/* IZQUIERDA: los productos */}
      <section className={`${tarjeta} overflow-hidden`} aria-label="Productos del pedido">
        <header className="flex items-baseline justify-between border-b border-stone-300 bg-crema-100 px-5 py-2.5">
          <h2 className={titulo}>Productos</h2>
          <span className="text-[12px] text-stone-500">{items.length} {items.length === 1 ? "renglón" : "renglones"}</span>
        </header>
        <div className={`hidden gap-x-4 border-b border-stone-200 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500 lg:grid ${cols}`}>
          <span>Producto</span>{!web && <span className="text-right">Precio</span>}<span className="text-center">Pedido</span><span className="text-center">Entregado</span>{!web && <span className="text-right">Subtotal</span>}
        </div>
        {items.length === 0 && <p className="px-5 py-6 text-center text-sm text-stone-600">Comprobante cargado directamente: solo tiene el total.</p>}
        {items.map((i) => {
          const entregadaFinal = i.entregada ?? i.cantidad;
          const parcial = entregado && i.entregada !== null && i.entregada !== i.cantidad;
          return (
            <div key={i.id} className={`grid items-center gap-x-4 gap-y-1 border-b border-stone-200 px-5 py-3 last:border-b-0 ${cols}`}>
              <div className="min-w-0">
                <p className="font-bold leading-snug text-stone-900">{i.nombre}</p>
                <p className="text-[12px] text-stone-500">{i.sku ? `${i.sku} · ` : ""}por {i.unidad}{i.descuentoPct > 0 && <span className="ml-2 font-semibold text-stone-700">bonif. {String(i.descuentoPct).replace(".", ",")}%</span>}</p>
                {i.sinCargo > 0 && <p className="text-[12px] font-semibold text-stone-600">+ {i.sinCargo} sin cargo{i.motivoSinCargo ? ` (${i.motivoSinCargo.toLowerCase()})` : ""}</p>}
              </div>
              {!web && <p className="text-right text-sm tabular-nums text-stone-600">{formatoPesos(i.precio)}</p>}
              <p className="text-center text-lg font-bold tabular-nums">{i.cantidad}</p>
              <div className="text-center">
                {abierto ? (
                  <input
                    name={`e_${i.id}`}
                    form="form-entrega"
                    aria-label={`Entregado de ${i.nombre}`}
                    inputMode="numeric"
                    defaultValue={i.entregada ?? i.cantidad}
                    className="h-9 w-20 rounded-md border border-stone-400 bg-white text-center text-base font-semibold tabular-nums focus:border-verde-700 focus:outline-none"
                  />
                ) : entregado ? (
                  <p className={`text-lg font-bold tabular-nums ${parcial ? "text-rojo-700" : ""}`}>{entregadaFinal}{parcial && <span className="block text-[11px] font-semibold uppercase">parcial</span>}</p>
                ) : (
                  <span className="text-stone-300">—</span>
                )}
              </div>
              {!web && <p className="text-right text-[15px] font-bold tabular-nums">{formatoPesos((entregado ? entregadaFinal : i.cantidad) * i.precio * (1 - i.descuentoPct / 100))}</p>}
            </div>
          );
        })}
      </section>

      {/* DERECHA: total y entrega, observación, acciones */}
      <aside className="space-y-4">
        <section className={`${tarjeta} p-4`} aria-label="Total y entrega">
          <h2 className={`${titulo} mb-2`}>Importe</h2>
          <div className="space-y-0.5 text-sm">
            {(totales.conFactura || totales.descuento > 0.004) && <div className="flex justify-between"><span className="text-stone-600">Subtotal</span><span className="tabular-nums">{formatoPesos(totales.bruto)}</span></div>}
            {totales.descuento > 0.004 && <div className="flex justify-between text-rojo-700"><span>Bonificación</span><span className="tabular-nums">−{formatoPesos(totales.descuento)}</span></div>}
            {totales.descuento > 0.004 && totales.conFactura && <div className="flex justify-between"><span className="text-stone-600">Neto</span><span className="tabular-nums">{formatoPesos(totales.base)}</span></div>}
            {totales.conFactura && (totales.tasas.length > 0 ? totales.tasas.map((l) => <div key={l.tasa} className="flex justify-between"><span className="text-stone-600">IVA {String(l.tasa).replace(".", ",")}%</span><span className="tabular-nums">{formatoPesos(l.iva)}</span></div>) : <div className="flex justify-between"><span className="text-stone-600">IVA {ivaTexto}%</span><span className="tabular-nums">{formatoPesos(totales.iva)}</span></div>)}
          </div>
          <p className={`flex items-baseline justify-between text-2xl font-extrabold ${totales.conFactura || totales.descuento > 0.004 ? "mt-2 border-t border-stone-300 pt-2" : ""}`}><span className="text-base font-bold">Total</span><span className="tabular-nums">{formatoPesos(totales.total)}</span></p>
          {totales.sinCargoPaquetes > 0 && <p className="mt-2 border-t border-stone-200 pt-2 text-xs text-stone-600">Sin cargo: <b>{totales.sinCargoPaquetes}</b> {totales.sinCargoPaquetes === 1 ? "paquete" : "paquetes"} · valor {formatoPesos(totales.sinCargoValor)} (no se cobra)</p>}

          {abierto && (
            <div className="mt-4 border-t border-stone-200 pt-3">
              <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">
                ¿Cómo se cobra? {pagoMp && <span className="font-normal normal-case tracking-normal text-stone-500">(ya pagado · {pagoTexto})</span>}
                {sinPagoWeb && <span className="mt-1 block text-sm font-semibold normal-case tracking-normal text-rojo-700">Falta confirmar la transferencia: sin pago no sale de fábrica.</span>}
                {!pagoMp && !sinPagoWeb && (
                  <select name="cobro" form="form-entrega" required defaultValue="" className="mt-1.5 h-10 w-full rounded-md border border-stone-400 bg-white px-2 text-sm font-medium normal-case tracking-normal text-stone-900">
                    <option value="" disabled hidden>Elegí una opción…</option>
                    <option value="EFECTIVO">Pago · Efectivo</option>
                    <option value="TRANSFERENCIA">Pago · Transferencia</option>
                    {!web && <option value="CC">Cuenta corriente</option>}
                  </select>
                )}
              </label>
              <button type="submit" form="form-entrega" disabled={!rutaSalio} title={rutaSalio ? undefined : motivoApagado} className="mt-3 h-11 w-full rounded-md bg-verde-700 text-[15px] font-bold text-white hover:bg-verde-800 disabled:cursor-not-allowed disabled:opacity-40">✓ Confirmar entrega</button>
              {!rutaSalio && <p className="mt-1.5 text-[12px] leading-snug text-stone-600">{motivoApagado}</p>}
            </div>
          )}
          <Mensajes estado={estado} />
        </section>

        <section className={`${tarjeta} p-4`} aria-label="Observación">
          <h2 className={`${titulo} mb-2`}>Observación</h2>
          <NotaEditable pedidoId={pedidoId} inicial={nota} />
        </section>

        {lateral}
      </aside>
    </div>
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
