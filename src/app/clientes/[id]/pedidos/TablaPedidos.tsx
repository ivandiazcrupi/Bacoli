"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatoPesos } from "@/lib/numeros";
import { CABECERA_TABLA } from "@/app/cuentas/estilo";

export type FilaPedido = {
  id: string;
  cargado: string; // AAAA-MM-DD
  entrega: string | null; // AAAA-MM-DD
  sucursal: string;
  pedido: string;
  monto: number;
  comprobante: string; // "F-4818", "R-0001" o ""
  comprobanteFalta: string; // "Factura sin número" / "Remito sin emitir"
  estado: "PENDIENTE" | "ENTREGADO" | "NO_ENTREGADO" | "CANCELADO";
  pagado: boolean;
  medio: string | null;
  aCuenta: boolean; // entregado y quedó en cuenta corriente
};

const COLUMNAS = "grid-cols-[104px_104px_minmax(130px,1fr)_minmax(220px,2.8fr)_112px_92px_112px_172px_60px]";
const ESTADOS = { PENDIENTE: "Pendiente", ENTREGADO: "Entregado", NO_ENTREGADO: "No entregado", CANCELADO: "Cancelado" } as const;
const MEDIOS: Record<string, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", CHEQUE: "Cheque", MERCADO_PAGO: "Mercado Pago", OTRO: "Otro" };
const fecha = (s: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "");

type Col = "cargado" | "entrega" | "sucursal" | "monto" | "estado";

// Historial de pedidos del cliente en una hoja: fecha completa (dd/mm/aaaa), orden al tocar el título y filtros rápidos.
export function TablaPedidos({ filas }: { filas: FilaPedido[] }) {
  const [orden, setOrden] = useState<{ col: Col; asc: boolean }>({ col: "cargado", asc: false });
  const [estadoF, setEstadoF] = useState<"" | FilaPedido["estado"]>("");
  const [pagoF, setPagoF] = useState<"" | "PAGADO" | "PENDIENTE">("");

  const visibles = useMemo(() => {
    const r = filas.filter((f) => (!estadoF || f.estado === estadoF) && (!pagoF || (pagoF === "PAGADO" ? f.pagado : f.estado === "ENTREGADO" && !f.pagado)));
    const clave = (f: FilaPedido): string | number => orden.col === "cargado" ? f.cargado : orden.col === "entrega" ? f.entrega ?? "9999-99-99" : orden.col === "sucursal" ? f.sucursal.toLowerCase() : orden.col === "monto" ? f.monto : ESTADOS[f.estado];
    return [...r].sort((a, b) => { const x = clave(a), y = clave(b); return (x < y ? -1 : x > y ? 1 : 0) * (orden.asc ? 1 : -1) || b.cargado.localeCompare(a.cargado); });
  }, [filas, orden, estadoF, pagoF]);

  const filtroTitulo = "w-full cursor-pointer appearance-none bg-transparent text-center text-[11px] font-semibold uppercase tracking-wide text-stone-500 hover:text-stone-900 focus:outline-none";
  const titulo = (col: Col, texto: string) => (
    <button type="button" onClick={() => setOrden((o) => ({ col, asc: o.col === col ? !o.asc : col === "sucursal" || col === "estado" }))} className="flex items-center justify-center gap-1 uppercase hover:text-stone-900">
      {texto}{orden.col === col && <span className="text-verde-700">{orden.asc ? "▲" : "▼"}</span>}
    </button>
  );

  return (
    <div className="rounded-lg border border-stone-300 bg-white">
      <div className="overflow-x-auto">
        <div className="min-w-[1000px]">
          <div className={`grid text-center ${CABECERA_TABLA} ${COLUMNAS}`}>
            {titulo("cargado", "Cargado")}{titulo("entrega", "Entrega")}{titulo("sucursal", "Sucursal")}<span>Pedido</span>{titulo("monto", "Monto")}<span>Comprobante</span>
            <select aria-label="Filtrar por estado" value={estadoF} onChange={(e) => setEstadoF(e.target.value as typeof estadoF)} className={filtroTitulo}>
              <option value="">Estado ▾</option>
              {(Object.keys(ESTADOS) as (keyof typeof ESTADOS)[]).map((k) => <option key={k} value={k}>{ESTADOS[k]}</option>)}
            </select>
            <select aria-label="Filtrar por pago" value={pagoF} onChange={(e) => setPagoF(e.target.value as typeof pagoF)} className={filtroTitulo}>
              <option value="">Pago ▾</option>
              <option value="PAGADO">Pagado</option>
              <option value="PENDIENTE">Pendiente</option>
            </select>
            <span />
          </div>
          {visibles.length === 0 && <p className="p-8 text-center text-sm text-stone-500">No hay pedidos con ese filtro.</p>}
          {visibles.map((f) => (
            <div key={f.id} className={`grid h-10 items-center gap-x-4 overflow-hidden border-b border-stone-200 px-4 text-center text-[13.5px] text-stone-800 hover:bg-crema-50 ${COLUMNAS} ${f.estado === "CANCELADO" ? "text-stone-400" : ""}`}>
              <span className="tabular-nums text-stone-700">{fecha(f.cargado)}</span>
              <span className="tabular-nums text-stone-700">{f.entrega ? fecha(f.entrega) : <span className="text-stone-400">Sin día</span>}</span>
              <span className="truncate" title={f.sucursal}>{f.sucursal}</span>
              <span className="truncate" title={f.pedido}>{f.pedido}</span>
              <span className={`font-bold tabular-nums ${f.estado === "CANCELADO" ? "line-through" : ""}`}>{formatoPesos(f.monto)}</span>
              <span className="font-semibold tabular-nums">{f.comprobante || <span className="text-xs font-normal text-stone-400">{f.comprobanteFalta}</span>}</span>
              <span className={f.estado === "NO_ENTREGADO" ? "text-rojo-700" : f.estado === "CANCELADO" ? "text-stone-500" : ""}>{ESTADOS[f.estado]}</span>
              <span className={`whitespace-nowrap ${f.pagado ? "font-semibold text-verde-700" : f.estado === "ENTREGADO" ? "font-semibold text-rojo-700" : "text-stone-300"}`}>
                {f.pagado ? `Pagado${f.medio ? ` · ${MEDIOS[f.medio] ?? ""}` : ""}` : f.estado === "ENTREGADO" ? "Pendiente" : "—"}
              </span>
              <Link href={`/pedidos/${f.id}`} className="text-[12.5px] font-semibold text-verde-800 hover:underline">Abrir ›</Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
