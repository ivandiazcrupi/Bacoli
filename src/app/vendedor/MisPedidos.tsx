"use client";

import { useMemo, useState } from "react";
import { FiltroLista, SEP } from "../cuentas/FiltroLista";
import { formatoPesos } from "@/lib/numeros";

type Fila = {
  id: string; cargado: string; entrega: string | null; cliente: string; barrio: string;
  items: { cantidad: number; nombre: string }[]; monto: number;
  estado: "PENDIENTE" | "ENTREGADO" | "NO_ENTREGADO" | "CANCELADO"; pagado: boolean; medio: string | null; aCuenta: boolean;
};

const ESTADOS = { PENDIENTE: "Pendiente", ENTREGADO: "Entregado", NO_ENTREGADO: "No entregado", CANCELADO: "Cancelado" } as const;
const MEDIOS: Record<string, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", CHEQUE: "Cheque", MERCADO_PAGO: "Mercado Pago", OTRO: "Otro" };
const PASTILLA_ESTADO = { PENDIENTE: "bg-[#fdf8e3] text-[#8a6a05]", ENTREGADO: "bg-verde-50 text-verde-700", NO_ENTREGADO: "bg-rojo-50 text-rojo-700", CANCELADO: "bg-rojo-50 text-rojo-700" } as const;
const pastilla = "inline-flex h-7 items-center whitespace-nowrap rounded-full px-3 text-[12.5px] font-bold";
const fecha = (s: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "");

// Entregado y sin pagar = el cliente nos debe. Pendiente de entrega todavía no se cobra.
const debe = (f: Fila) => f.estado === "ENTREGADO" && !f.pagado;
type Vista = "todos" | "sinpagar" | "pagados";

export function MisPedidos({ filas }: { filas: Fila[] }) {
  const [vista, setVista] = useState<Vista>("todos");
  const [clientes, setClientes] = useState("");
  const [buscar, setBuscar] = useState("");
  const nombres = useMemo(() => [...new Set(filas.map((f) => f.cliente))].sort((a, b) => a.localeCompare(b, "es")), [filas]);
  const porCobrar = filas.filter(debe).reduce((t, f) => t + f.monto, 0);

  const visibles = filas.filter((f) => {
    if (vista === "sinpagar" && !debe(f)) return false;
    if (vista === "pagados" && !f.pagado) return false;
    if (clientes && !clientes.split(SEP).includes(f.cliente)) return false;
    if (buscar.trim() && !`${f.cliente} ${f.barrio} ${f.items.map((i) => i.nombre).join(" ")}`.toLowerCase().includes(buscar.trim().toLowerCase())) return false;
    return true;
  });

  const boton = (v: Vista, texto: string, n: number) => (
    <button type="button" onClick={() => setVista(v)} className={`rounded-md px-4 py-1.5 text-sm font-semibold ${vista === v ? "bg-stone-800 text-white" : "border border-stone-300 bg-white text-stone-700 hover:border-stone-500"}`}>{texto} <span className="opacity-70">{n}</span></button>
  );

  return (
    <div className="mt-4 space-y-3">
      <div className="grid max-w-2xl grid-cols-3 divide-x divide-stone-200 rounded-lg border border-stone-300 bg-white">
        {[["Pedidos", String(filas.length), false], ["Sin pagar", String(filas.filter(debe).length), filas.some(debe)], ["Por cobrar", formatoPesos(porCobrar), porCobrar > 0]].map(([t, v, rojo]) => (
          <div key={t as string} className="px-4 py-3 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{t}</div>
            <div className={`text-xl font-bold tabular-nums ${rojo ? "text-rojo-700" : "text-stone-900"}`}>{v}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {boton("todos", "Todos", filas.length)}{boton("sinpagar", "Sin pagar", filas.filter(debe).length)}{boton("pagados", "Pagados", filas.filter((f) => f.pagado).length)}
        <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar cliente, barrio o producto…" className="ml-auto h-9 w-72 max-w-full rounded-md border border-stone-400 bg-white px-3 text-sm focus:border-verde-700 focus:outline-none" />
      </div>

      <div className="overflow-hidden rounded-lg border border-stone-300 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-center text-[13px]">
            <thead className="bg-stone-100 text-[11px] uppercase tracking-wide text-stone-600">
              <tr className="align-bottom">
                <th className="px-2 py-2 font-semibold">Cargado</th>
                <th className="w-64 px-2 pb-1 pt-2 font-semibold">Cliente<div className="mt-1 font-normal normal-case"><FiltroLista varios titulo="Cliente" opciones={nombres} valor={clientes} onCambio={setClientes} /></div></th>
                <th className="px-2 py-2 font-semibold">Pedido</th>
                <th className="px-2 py-2 font-semibold">Monto</th>
                <th className="px-2 py-2 font-semibold">Entrega</th>
                <th className="px-2 py-2 font-semibold">Estado</th>
                <th className="px-2 py-2 font-semibold">Pago</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={f.id} className="border-t border-stone-200">
                  <td className="px-2 py-2.5 tabular-nums">{fecha(f.cargado)}</td>
                  <td className="px-2 py-2.5 text-left"><div className="font-semibold">{f.cliente}</div><div className="text-[12px] text-stone-500">{f.barrio}</div></td>
                  <td className="px-2 py-2.5 text-left">{f.items.map((i, k) => <div key={k}><b>{i.cantidad}</b> {i.nombre}</div>)}</td>
                  <td className="px-2 py-2.5 font-semibold tabular-nums">{formatoPesos(f.monto)}</td>
                  <td className="px-2 py-2.5 tabular-nums">{f.entrega ? fecha(f.entrega) : <span className="text-stone-400">Sin día</span>}</td>
                  <td className="px-2 py-2.5"><span className={`${pastilla} ${PASTILLA_ESTADO[f.estado]}`}>{ESTADOS[f.estado]}</span></td>
                  <td className="px-2 py-2.5">
                    {f.pagado ? <span className={`${pastilla} bg-verde-50 text-verde-700`}>Pagado{f.medio ? ` · ${MEDIOS[f.medio] ?? ""}` : ""}</span>
                      : f.estado === "ENTREGADO" ? <span className={`${pastilla} bg-rojo-50 text-rojo-700`}>Sin pagar</span>
                      : <span className="text-stone-400">{f.estado === "CANCELADO" || f.estado === "NO_ENTREGADO" ? "—" : "Sin entregar"}</span>}
                  </td>
                </tr>
              ))}
              {visibles.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-stone-500">{filas.length === 0 ? "Todavía no hay pedidos de tus clientes." : "No hay pedidos con ese filtro."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
