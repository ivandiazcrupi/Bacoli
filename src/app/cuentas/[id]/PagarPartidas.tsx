"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatoPesos } from "@/lib/numeros";
import { registrarPagos } from "../actions";

export type FilaAbierta = { id: string; cargado: string; fecha: string; entregado: boolean; tipo: string; numero: string | null; monto: number; vence: string; atraso: number };

const MEDIOS = [
  { valor: "EFECTIVO", texto: "Efectivo" },
  { valor: "TRANSFERENCIA", texto: "Transferencia" },
  { valor: "CHEQUE", texto: "Cheque" },
  { valor: "OTRO", texto: "Otro" },
];
const COLUMNAS = "grid-cols-[28px_90px_90px_1fr_130px_90px_140px]";
const fechaCorta = (s: string) => `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(2, 4)}`;

// Comprobantes sin pagar de un cliente: se tildan los que se pagaron, se elige el medio y se registra el pago.
export function PagarPartidas({ filas }: { filas: FilaAbierta[] }) {
  const router = useRouter();
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [medio, setMedio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [trabajando, empezar] = useTransition();

  const pagables = filas.filter((f) => f.entregado);
  const alternar = (id: string) => setElegidas((a) => {
    const n = new Set(a);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const todas = pagables.length > 0 && elegidas.size === pagables.length;
  const suma = filas.filter((f) => elegidas.has(f.id)).reduce((s, f) => s + f.monto, 0);

  const registrar = () => {
    setError(null);
    if (!medio) return setError("Elegí cómo pagó.");
    const cant = elegidas.size;
    if (!window.confirm(`¿Confirmás que se pagaron ${cant} ${cant === 1 ? "comprobante" : "comprobantes"} por ${formatoPesos(suma)} con ${MEDIOS.find((m) => m.valor === medio)?.texto.toLowerCase()}?\n\nQuedan marcados como pagados.`)) return;
    empezar(async () => {
      const r = await registrarPagos([...elegidas], medio);
      if (!r.ok) setError(r.error ?? "No se pudo registrar.");
      else { setElegidas(new Set()); setMedio(""); }
      router.refresh();
    });
  };

  if (filas.length === 0) return <p className="p-8 text-center text-stone-600">Sin comprobantes pendientes.</p>;

  return (
    <div>
      <div className={`grid items-center gap-x-3 border-b border-stone-300 bg-crema-100 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-stone-600 ${COLUMNAS}`}>
        <input type="checkbox" aria-label="Elegir todos" checked={todas} onChange={() => setElegidas(todas ? new Set() : new Set(pagables.map((f) => f.id)))} className="h-4 w-4 accent-[#026433]" />
        <span>Cargado</span><span>Entrega</span><span>Comprobante</span><span>Monto</span><span>Vence</span><span>Estado</span>
      </div>
      <ul className="divide-y divide-stone-300">
        {filas.map((f) => (
          <li key={f.id} className={`grid items-center gap-x-3 px-4 py-2.5 text-center text-sm ${COLUMNAS} ${elegidas.has(f.id) ? "bg-crema-50" : ""}`}>
            <input type="checkbox" aria-label={`Elegir ${f.tipo} ${f.numero ?? ""}`} checked={elegidas.has(f.id)} disabled={!f.entregado} onChange={() => alternar(f.id)} className="h-4 w-4 accent-[#026433] disabled:opacity-30" />
            <span className="tabular-nums">{fechaCorta(f.cargado)}</span>
            <span className="tabular-nums">{f.entregado ? fechaCorta(f.fecha) : <span className="text-stone-400">—</span>}</span>
            <span className="font-semibold">
              {f.tipo === "FACTURA" ? "FACTURA" : "REMITO"} {f.numero ?? (f.entregado ? <span className="text-rojo-700">sin número</span> : <span className="font-normal text-stone-500">(se carga al entregar)</span>)}
            </span>
            <span className="font-bold tabular-nums">{formatoPesos(f.monto)}</span>
            <span className="tabular-nums">{f.entregado ? fechaCorta(f.vence) : <span className="text-stone-400">—</span>}</span>
            <span className={!f.entregado ? "text-stone-600" : f.atraso > 0 ? "font-semibold text-rojo-700" : "text-stone-600"}>{!f.entregado ? "Por entregar" : f.atraso > 0 ? `Vencida ${f.atraso} ${f.atraso === 1 ? "día" : "días"}` : "Al día"}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-300 bg-crema-100 px-4 py-3 text-sm">
        <p>{elegidas.size > 0 ? <><span className="font-semibold">{elegidas.size}</span> {elegidas.size === 1 ? "comprobante elegido" : "comprobantes elegidos"} · <span className="font-bold tabular-nums">{formatoPesos(suma)}</span></> : <span className="text-stone-600">Tildá los comprobantes entregados que pagó.</span>}</p>
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
