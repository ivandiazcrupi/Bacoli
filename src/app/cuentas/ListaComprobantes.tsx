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
  monto: number;
  vence: string;
  atraso: number;
  pagada: boolean;
  medio: string | null;
  obs: string;
};

const MEDIOS = [
  { valor: "EFECTIVO", texto: "Efectivo" },
  { valor: "TRANSFERENCIA", texto: "Transferencia" },
  { valor: "CHEQUE", texto: "Cheque" },
  { valor: "OTRO", texto: "Otro" },
];
const TEXTO_MEDIO: Record<string, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", CHEQUE: "Cheque", MERCADO_PAGO: "Mercado Pago", OTRO: "Otro" };
const COLUMNAS = "grid-cols-[28px_150px_minmax(160px,1.6fr)_84px_84px_150px_84px_170px_minmax(160px,1.2fr)]";
const fechaCorta = (s: string) => `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(2, 4)}`;

// Listado de comprobantes (facturas o remitos) en orden de número: se tildan los pagados, se elige el medio y se registra el pago.
export function ListaComprobantes({ filas }: { filas: FilaComprobante[] }) {
  const router = useRouter();
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [medio, setMedio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [trabajando, empezar] = useTransition();

  const pagables = filas.filter((f) => f.entregado && !f.pagada && !f.cubierta);
  const alternar = (id: string) => setElegidas((a) => {
    const n = new Set(a);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const suma = filas.filter((f) => elegidas.has(f.id)).reduce((s, f) => s + f.monto, 0);

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
      <div className={`hidden items-center gap-x-3 bg-verde-800 px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-white lg:grid ${COLUMNAS}`}>
        <input type="checkbox" aria-label="Elegir todos los de esta página" checked={pagables.length > 0 && elegidas.size === pagables.length} onChange={() => setElegidas(elegidas.size === pagables.length ? new Set() : new Set(pagables.map((f) => f.id)))} className="h-4 w-4 accent-[#ede6c8]" />
        <span>{filas[0].tipo === "FACTURA" ? "Factura" : "Remito"}</span><span className="text-left">Cliente</span><span>Cargado</span><span>Entrega</span><span>Monto</span><span>Vence</span><span>Estado</span><span>Observación</span>
      </div>
      <ul className="divide-y divide-stone-300">
        {filas.map((f) => (
          <li key={f.id} className={`items-center gap-x-3 gap-y-1 px-4 py-2.5 text-center text-sm lg:grid ${COLUMNAS} ${f.pagada ? "bg-verde-50" : elegidas.has(f.id) ? "bg-crema-50" : ""}`}>
            <input type="checkbox" aria-label={`Elegir ${f.numero ?? "comprobante"}`} checked={elegidas.has(f.id)} disabled={!f.entregado || f.pagada || f.cubierta} onChange={() => alternar(f.id)} className="h-4 w-4 accent-[#026433] disabled:opacity-30" />
            <span className="flex items-center justify-center gap-1.5 font-semibold tabular-nums">
              {f.numero ?? <span className="font-normal text-rojo-700">sin número</span>}
              {f.tipo === "FACTURA" && !f.pagada && !f.cubierta && <Link href={`/cuentas/${f.clienteId}/nc?factura=${f.id}`} title="Cargar nota de crédito" className="rounded border border-stone-400 px-1 text-[10px] font-semibold text-stone-600 hover:border-verde-700 hover:text-verde-800">NC</Link>}
            </span>
            <Link href={`/cuentas/${f.clienteId}`} className="text-left hover:underline">{f.cliente}</Link>
            <span className="tabular-nums">{fechaCorta(f.cargado)}</span>
            <span className="tabular-nums">{f.entregado ? fechaCorta(f.fecha) : <span className="text-stone-400">—</span>}</span>
            <span className="font-bold tabular-nums">
              {formatoPesos(f.cubierta ? 0 : f.monto)}
              {f.nc > 0 && <span className="block text-[10px] font-normal text-stone-500">de {formatoPesos(f.bruto)} · NC −{formatoPesos(f.nc)}</span>}
            </span>
            <span className="tabular-nums">{f.entregado && !f.pagada ? fechaCorta(f.vence) : <span className="text-stone-400">—</span>}</span>
            {f.pagada ? (
              <span className="font-semibold text-verde-800">Pagada · {TEXTO_MEDIO[f.medio ?? ""] ?? ""} <button type="button" onClick={() => deshacer(f.id)} className="ml-1 text-xs font-normal text-stone-500 underline hover:text-rojo-700">deshacer</button></span>
            ) : f.cubierta ? (
              <span className="font-semibold text-stone-700">Cubierta por NC</span>
            ) : !f.entregado ? (
              <span className="text-stone-600">Por entregar</span>
            ) : f.atraso > 0 ? (
              <span className="font-semibold text-rojo-700">Vencida {f.atraso} {f.atraso === 1 ? "día" : "días"}</span>
            ) : (
              <span className="text-stone-600">Sin pagar</span>
            )}
            <input
              aria-label="Observación"
              placeholder="N° de cheque, comprobante…"
              defaultValue={f.obs}
              maxLength={200}
              onBlur={(e) => e.target.value.trim() !== f.obs && void guardarObservacion(f.id, e.target.value)}
              className="h-8 w-full rounded border border-stone-300 bg-white px-2 text-left text-xs placeholder:text-stone-400 focus:border-verde-700 focus:outline-none"
            />
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
