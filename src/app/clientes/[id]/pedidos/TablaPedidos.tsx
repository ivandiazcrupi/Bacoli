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
const VISTAS = [["todos", "Todos"], ["abiertos", "Pendientes"], ["entregados", "Entregados"], ["sin-pagar", "Sin pagar"], ["otros", "No entregados / cancelados"]] as const;

// Historial de pedidos del cliente en una hoja: fecha completa (dd/mm/aaaa), orden al tocar el título y filtros rápidos.
export function TablaPedidos({ filas }: { filas: FilaPedido[] }) {
  const [orden, setOrden] = useState<{ col: Col; asc: boolean }>({ col: "cargado", asc: false });
  const [vista, setVista] = useState<(typeof VISTAS)[number][0]>("todos");

  const visibles = useMemo(() => {
    const r = filas.filter((f) =>
      vista === "todos" ? true
        : vista === "abiertos" ? f.estado === "PENDIENTE"
        : vista === "entregados" ? f.estado === "ENTREGADO"
        : vista === "sin-pagar" ? f.estado === "ENTREGADO" && !f.pagado
        : f.estado === "NO_ENTREGADO" || f.estado === "CANCELADO");
    const clave = (f: FilaPedido): string | number => orden.col === "cargado" ? f.cargado : orden.col === "entrega" ? f.entrega ?? "9999-99-99" : orden.col === "sucursal" ? f.sucursal.toLowerCase() : orden.col === "monto" ? f.monto : ESTADOS[f.estado];
    return [...r].sort((a, b) => { const x = clave(a), y = clave(b); return (x < y ? -1 : x > y ? 1 : 0) * (orden.asc ? 1 : -1) || b.cargado.localeCompare(a.cargado); });
  }, [filas, orden, vista]);

  const total = visibles.filter((f) => f.estado !== "CANCELADO" && f.estado !== "NO_ENTREGADO").reduce((s, f) => s + f.monto, 0);
  const titulo = (col: Col, texto: string) => (
    <button type="button" onClick={() => setOrden((o) => ({ col, asc: o.col === col ? !o.asc : col === "sucursal" || col === "estado" }))} className="flex items-center justify-center gap-1 uppercase hover:text-stone-900">
      {texto}{orden.col === col && <span className="text-verde-700">{orden.asc ? "▲" : "▼"}</span>}
    </button>
  );

  return (
    <div className="rounded-lg border border-stone-300 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-300 px-3 py-2">
        <div role="group" aria-label="Mostrar" className="inline-flex overflow-hidden rounded-md border border-stone-300 text-[13px]">
          {VISTAS.map(([v, t]) => (
            <button key={v} type="button" onClick={() => setVista(v)} aria-pressed={vista === v} className={`h-8 px-3 ${vista === v ? "bg-stone-800 font-semibold text-white" : "text-stone-600 hover:bg-crema-100"}`}>{t}</button>
          ))}
        </div>
        <span className="text-[13px] text-stone-500">{visibles.length} {visibles.length === 1 ? "pedido" : "pedidos"} · <b className="tabular-nums text-stone-800">{formatoPesos(total)}</b></span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[1000px]">
          <div className={`grid text-center ${CABECERA_TABLA} ${COLUMNAS}`}>
            {titulo("cargado", "Cargado")}{titulo("entrega", "Entrega")}{titulo("sucursal", "Sucursal")}<span>Pedido</span>{titulo("monto", "Monto")}<span>Comprobante</span>{titulo("estado", "Estado")}<span>Pago</span><span />
          </div>
          {visibles.length === 0 && <p className="p-8 text-center text-sm text-stone-500">No hay pedidos con ese filtro.</p>}
          {visibles.map((f) => (
            <div key={f.id} className={`grid h-10 items-center gap-x-4 overflow-hidden border-b border-stone-200 px-4 text-center text-[13.5px] text-stone-800 hover:bg-crema-50 ${COLUMNAS} ${f.estado === "CANCELADO" ? "text-stone-400" : ""}`}>
              <span className="tabular-nums text-stone-700">{fecha(f.cargado)}</span>
              <span className="tabular-nums text-stone-700">{f.entrega ? fecha(f.entrega) : <span className="text-stone-400">Sin día</span>}</span>
              <span className="truncate" title={f.sucursal}>{f.sucursal}</span>
              <span className="truncate text-left" title={f.pedido}>{f.pedido}</span>
              <span className={`font-bold tabular-nums ${f.estado === "CANCELADO" ? "line-through" : ""}`}>{formatoPesos(f.monto)}</span>
              <span className="font-semibold tabular-nums">{f.comprobante || <span className="text-xs font-normal text-stone-400">{f.comprobanteFalta}</span>}</span>
              <span className={`flex h-full items-center justify-center ${f.estado === "PENDIENTE" ? "" : f.estado === "ENTREGADO" ? "text-verde-800" : f.estado === "NO_ENTREGADO" ? "text-rojo-700" : "text-stone-500"}`}>{ESTADOS[f.estado]}</span>
              <span className={`flex h-full items-center justify-center whitespace-nowrap ${f.pagado ? "bg-verde-100 text-verde-800" : f.estado === "ENTREGADO" ? "bg-rojo-100 text-rojo-800" : ""}`}>
                {f.pagado ? <span className="font-semibold">Pagado{f.medio ? ` · ${MEDIOS[f.medio] ?? ""}` : ""}</span> : f.estado === "ENTREGADO" ? <span className="font-semibold">{f.aCuenta ? "En cuenta corriente" : "Sin pagar"}</span> : <span className="text-stone-300">—</span>}
              </span>
              <Link href={`/pedidos/${f.id}`} className="text-[12.5px] font-semibold text-verde-800 hover:underline">Abrir ›</Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
