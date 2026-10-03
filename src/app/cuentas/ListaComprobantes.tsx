"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatoPesos } from "@/lib/numeros";
import { deshacerPago, guardarObservacion, registrarPagos } from "./actions";

export type FilaComprobante = {
  id: string;
  clienteId: string;
  cliente: string;
  tipo: "FACTURA" | "REMITO";
  numero: string | null;
  cargado: string;
  fecha: string;
  entregado: boolean;
  bruto: number;
  nc: number;
  cubierta: boolean;
  anulado?: string | null; // "Anulado" o "No entregado": tiene número pero ya no se debe
  ncTexto: string; // "NC 0001-00000045" (vacío si no tiene)
  monto: number;
  vence: string;
  atraso: number;
  pagada: boolean;
  medio: string | null;
  obs: string;
  hueco?: boolean; // número que no aparece en ningún pedido: se ve para que la numeración esté completa
};

const MEDIOS = [
  { valor: "EFECTIVO", texto: "Efectivo" },
  { valor: "TRANSFERENCIA", texto: "Transferencia" },
  { valor: "CHEQUE", texto: "Cheque" },
  { valor: "OTRO", texto: "Otro" },
];
const TEXTO_MEDIO: Record<string, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", CHEQUE: "Cheque", MERCADO_PAGO: "Mercado Pago", OTRO: "Otro" };
const COLUMNAS = "grid-cols-[28px_150px_minmax(160px,1.6fr)_84px_84px_150px_84px_215px_minmax(150px,1.2fr)]";
const fechaCorta = (s: string) => `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(2, 4)}`;

// Listado de comprobantes (facturas o remitos) en orden de número: se tildan los pagados, se elige el medio y se registra el pago.
export function ListaComprobantes({ filas }: { filas: FilaComprobante[] }) {
  const router = useRouter();
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [medio, setMedio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [trabajando, empezar] = useTransition();

  const pagables = filas.filter((f) => !f.hueco).filter((f) => f.entregado && !f.pagada && !f.cubierta && !f.anulado);
  const alternar = (id: string) => setElegidas((a) => {
    const n = new Set(a);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const suma = filas.filter((f) => elegidas.has(f.id) && !f.hueco).reduce((s, f) => s + f.monto, 0);

  const registrar = () => {
    setError(null);
    if (!medio) return setError("Elegí cómo pagó.");
    empezar(async () => {
      const r = await registrarPagos([...elegidas], medio);
      if (!r.ok) setError(r.error ?? "No se pudo registrar.");
      else { setElegidas(new Set()); setMedio(""); }
      router.refresh();
    });
  };
  const deshacer = (id: string) => {
    if (!window.confirm("¿Deshacer este pago? El comprobante vuelve a figurar sin pagar.")) return;
    empezar(async () => {
      const r = await deshacerPago(id);
      if (!r.ok) window.alert(r.error);
      router.refresh();
    });
  };

  if (filas.length === 0) return <p className="p-8 text-center text-stone-600">No hay comprobantes con ese filtro.</p>;

  return (
    <div>
      <div className={`hidden items-center gap-x-3 border-b border-stone-300 bg-crema-200 px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-stone-700 lg:grid ${COLUMNAS}`}>
        <input type="checkbox" aria-label="Elegir todos los de esta página" checked={pagables.length > 0 && elegidas.size === pagables.length} onChange={() => setElegidas(elegidas.size === pagables.length ? new Set() : new Set(pagables.map((f) => f.id)))} className="h-4 w-4 accent-[#ede6c8]" />
        <span>{filas[0].tipo === "FACTURA" ? "FACTURA" : "REMITO"}</span><span className="text-left">Cliente</span><span>Cargado</span><span>Entrega</span><span>Monto</span><span>Vence</span><span>Estado</span><span>Observación</span>
      </div>
      <ul className="divide-y divide-stone-300">
        {filas.map((f) => f.hueco ? (
          <li key={f.id} className={`items-center gap-x-3 px-4 py-1.5 text-center text-sm text-stone-400 lg:grid ${COLUMNAS}`}>
            <span />
            <span className="font-semibold tabular-nums">{f.numero}</span>
            <span className="text-left italic">Número sin usar</span>
          </li>
        ) : (
          <li key={f.id} className={`items-center gap-x-3 gap-y-1 px-4 py-2.5 text-center text-sm lg:grid ${COLUMNAS} ${f.anulado ? "bg-stone-100 text-stone-500" : f.pagada ? "bg-verde-50" : elegidas.has(f.id) ? "bg-crema-50" : ""}`}>
            <input type="checkbox" aria-label={`Elegir ${f.numero ?? "comprobante"}`} checked={elegidas.has(f.id)} disabled={!f.entregado || f.pagada || f.cubierta || !!f.anulado} onChange={() => alternar(f.id)} className="h-4 w-4 accent-[#026433] disabled:opacity-30" />
            <span className="flex items-center justify-center gap-1.5 font-semibold tabular-nums">
              {f.numero ?? <span className="font-normal text-rojo-700">sin número</span>}
              {f.tipo === "FACTURA" && !f.pagada && !f.cubierta && !f.anulado && <Link href={`/cuentas/${f.clienteId}/nc?factura=${f.id}`} title="Cargar nota de crédito" className="rounded border border-stone-400 px-1 text-[10px] font-semibold text-stone-600 hover:border-verde-700 hover:text-verde-800">NC</Link>}
            </span>
            <Link href={`/cuentas/${f.clienteId}`} className="text-left hover:underline">{f.cliente}</Link>
            <span className="tabular-nums">{fechaCorta(f.cargado)}</span>
            <span className="tabular-nums">{f.entregado ? fechaCorta(f.fecha) : <span className="text-stone-400">—</span>}</span>
            <span className={`font-bold tabular-nums ${f.cubierta || f.anulado ? "text-stone-400 line-through" : ""}`}>{formatoPesos(f.cubierta || f.anulado ? f.bruto : f.monto)}</span>
            <span className="tabular-nums">{f.entregado && !f.pagada ? fechaCorta(f.vence) : <span className="text-stone-400">—</span>}</span>
            {f.anulado ? (
              <span className="font-semibold text-stone-600">{f.anulado}</span>
            ) : f.pagada ? (
              <span className="whitespace-nowrap font-semibold text-verde-800">Pagada · {TEXTO_MEDIO[f.medio ?? ""] ?? ""} <button type="button" onClick={() => deshacer(f.id)} className="ml-1 text-xs font-normal text-stone-500 underline hover:text-rojo-700">deshacer</button></span>
            ) : f.cubierta ? (
              <span className="font-semibold text-stone-700">Anulada por NC</span>
            ) : !f.entregado ? (
              <span className="text-stone-600">Por entregar</span>
            ) : f.atraso > 0 ? (
              <span className="font-semibold text-rojo-700">Vencida {f.atraso} {f.atraso === 1 ? "día" : "días"}</span>
            ) : (
              <span className="text-stone-600">Sin pagar</span>
            )}
            {f.ncTexto ? (
              <span className="flex h-8 w-full items-center truncate rounded border border-stone-200 bg-stone-100 px-2 text-left text-xs font-semibold text-stone-700" title="Se completa solo al aplicar la nota de crédito">{f.ncTexto}{!f.cubierta && f.nc > 0 ? ` (−${formatoPesos(f.nc)})` : ""}</span>
            ) : (
            <input
              aria-label="Observación"
              placeholder="N° de cheque, comprobante…"
              defaultValue={f.obs}
              maxLength={200}
              onBlur={(e) => e.target.value.trim() !== f.obs && void guardarObservacion(f.id, e.target.value)}
              className="h-8 w-full rounded border border-stone-300 bg-white px-2 text-left text-xs placeholder:text-stone-400 focus:border-verde-700 focus:outline-none"
            />
            )}
          </li>
        ))}
      </ul>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-stone-300 bg-crema-100 px-4 py-3 text-sm">
        <p>{elegidas.size > 0 ? <><span className="font-semibold">{elegidas.size}</span> {elegidas.size === 1 ? "comprobante elegido" : "comprobantes elegidos"} · <span className="font-bold tabular-nums">{formatoPesos(suma)}</span></> : <span className="text-stone-600">Tildá los comprobantes entregados que pagaron.</span>}</p>
        <div className="flex items-center gap-2">
          <select aria-label="Medio de pago" value={medio} onChange={(e) => setMedio(e.target.value)} disabled={elegidas.size === 0} className="h-9 rounded-md border border-stone-400 bg-white px-2 text-sm shadow-sm disabled:opacity-50">
            <option value="" disabled hidden>Pagó con…</option>
            {MEDIOS.map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
          </select>
          <button type="button" onClick={registrar} disabled={elegidas.size === 0 || trabajando} className="h-9 rounded-md bg-verde-700 px-4 text-sm font-semibold text-white hover:bg-verde-800 disabled:opacity-50">{trabajando ? "Guardando…" : "Registrar pago"}</button>
        </div>
      </div>
      {error && <p className="border-t border-rojo-600 bg-rojo-50 px-4 py-2 text-sm text-rojo-700" role="alert">{error}</p>}
    </div>
  );
}
