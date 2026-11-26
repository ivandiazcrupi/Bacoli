"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { cancelarDesdeTienda, pagoDesdeTienda } from "./actions";

export type FilaDia = {
  id: string; orden: string; nombre: string; fechaHora: string; monto: number;
  pago: "pagado" | "pendiente" | "sincargo"; medio: string; cancelado: boolean; entregado: boolean;
  grupo?: number; veces?: number; // mismo cliente con más de un pedido en el día
};
// Un tono por cada cliente repetido, para ver de un vistazo cuáles van juntos.
const TONOS = [
  { barra: "#d9a406", fondo: "#fdf8e3", texto: "#8a6a05" },
  { barra: "#3b82c4", fondo: "#eaf3fb", texto: "#1d5a94" },
  { barra: "#9b59b6", fondo: "#f4ecf8", texto: "#6c3483" },
  { barra: "#2e9e6b", fondo: "#e9f6ef", texto: "#1d6b47" },
  { barra: "#d9622b", fondo: "#fcefe8", texto: "#a0431a" },
];
const pesos = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });

function Menu({ f }: { f: FilaDia }) {
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState("");
  const [ocupado, empezar] = useTransition();
  const caja = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  useEffect(() => {
    if (!abierto) return;
    const cerrar = () => setAbierto(false);
    window.addEventListener("scroll", cerrar, true);
    const fuera = (e: MouseEvent) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    return () => { document.removeEventListener("mousedown", fuera); window.removeEventListener("scroll", cerrar, true); };
  }, [abierto]);

  const correr = (confirmar: string, accion: () => Promise<{ ok: boolean; error?: string }>) => {
    setAbierto(false);
    if (!window.confirm(confirmar)) return;
    setAviso("");
    empezar(async () => { const r = await accion(); if (!r.ok) { setAviso(r.error ?? "No se pudo."); window.alert(r.error ?? "No se pudo."); } });
  };
  const vivo = !f.cancelado && !f.entregado;
  const item = "block w-full px-3 py-2 text-left text-[13px] hover:bg-crema-100";
  return (
    <div ref={caja} className="relative inline-block">
      <button type="button" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPos({ top: r.bottom + 4, right: window.innerWidth - r.right }); setAbierto(!abierto); }} disabled={ocupado} aria-label={`Acciones del pedido ${f.orden}`} aria-expanded={abierto} title={aviso || "Acciones"}
        className="flex h-8 w-8 items-center justify-center rounded-md text-xl font-bold leading-none text-stone-600 hover:bg-crema-100 disabled:opacity-40">⋮</button>
      {abierto && (
        <div role="menu" style={{ top: pos.top, right: pos.right }} className="fixed z-50 w-56 overflow-hidden rounded-md border border-stone-300 bg-white py-1 text-left">
          <Link href={`/pedidos/${f.id}`} className={item}>Abrir pedido ›</Link>
          {vivo && f.pago === "pendiente" && <button type="button" role="menuitem" className={item} onClick={() => correr(`¿Confirmás que YA LLEGÓ el pago del pedido #${f.orden} de ${f.nombre} (${pesos(f.monto)})?`, () => pagoDesdeTienda(f.id, true))}>Marcar como abonado</button>}
          {vivo && f.pago === "pagado" && f.medio === "Transferencia" && <button type="button" role="menuitem" className={item} onClick={() => correr(`¿Volver a "Pendiente" el pago del pedido #${f.orden}?`, () => pagoDesdeTienda(f.id, false))}>Volver a pendiente de pago</button>}
          {vivo && <button type="button" role="menuitem" className={`${item} font-semibold text-rojo-700`} onClick={() => correr(`¿Cancelar el pedido #${f.orden} de ${f.nombre}? Sale de la hoja de ruta y no cuenta en la facturación.`, () => cancelarDesdeTienda(f.id))}>Cancelar pedido</button>}
        </div>
      )}
    </div>
  );
}

export function PedidosDelDia({ filas }: { filas: FilaDia[] }) {
  const celda = "px-3 py-2 text-center tabular-nums";
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-stone-300 bg-crema-100 text-[11.5px] uppercase tracking-wide text-stone-600">
            <th className={celda}>Orden</th>
            <th className={`${celda} !text-left`}>Cliente</th>
            <th className={celda}>Fecha y hora</th>
            <th className={celda}>Pago</th>
            <th className={celda}>Monto</th>
            <th className="w-12 px-2 py-2" aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id} className={`border-b border-stone-200 ${f.cancelado ? "text-stone-400 line-through" : ""}`}
              style={f.grupo === undefined ? undefined : { background: TONOS[f.grupo % TONOS.length].fondo, boxShadow: `inset 4px 0 0 ${TONOS[f.grupo % TONOS.length].barra}` }}>
              <td className={`${celda} font-semibold`}><Link href={`/pedidos/${f.id}`} className="text-[#1d3fbf] underline-offset-2 hover:underline">#{f.orden}</Link></td>
              <td className={`${celda} !text-left font-medium`}>
                {f.nombre}
                {f.grupo !== undefined && <span title={`Este cliente hizo ${f.veces} pedidos hoy (mismo nombre, email o teléfono)`} className="ml-2 rounded px-1.5 py-0.5 align-middle text-[10.5px] font-bold uppercase no-underline" style={{ color: TONOS[f.grupo % TONOS.length].texto, border: `1px solid ${TONOS[f.grupo % TONOS.length].barra}` }}>{f.veces} pedidos</span>}
              </td>
              <td className={celda}>{f.fechaHora}</td>
              <td className={`${celda} no-underline`}>
                {f.cancelado ? <span className="text-[12px] font-bold uppercase">Cancelado</span>
                  : f.pago === "pagado" ? <span className="rounded-full bg-verde-50 px-2.5 py-0.5 text-[12px] font-bold text-verde-700">Pagado · {f.medio}</span>
                  : f.pago === "sincargo" ? <span className="text-[12px] font-semibold text-stone-500">Sin cargo</span>
                  : <span className="rounded-full bg-rojo-50 px-2.5 py-0.5 text-[12px] font-bold text-rojo-700">Pendiente · {f.medio}</span>}
              </td>
              <td className={`${celda} font-semibold`}>{pesos(f.monto)}</td>
              <td className="px-2 py-1 text-center">{!f.cancelado && <Menu f={f} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
