"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ABIERTOS, ESTADOS, nombreEstado, nombreTipo } from "@/lib/leads";
import { cambiarEstadoLead } from "./actions";

export type FilaLead = {
  id: string; nombre: string; telefono: string | null; wa: string | null; barrio: string | null; contacto: string | null;
  estado: string; nota: string | null; proximo: string | null; ingreso: string; ultimo: string | null; ultimoTipo: string | null;
};

const corta = (s: string | null) => (s ? `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(2, 4)}` : "—");
const PASTILLA: Record<string, string> = {
  NUEVO: "border-sky-300 bg-sky-50 text-sky-800", CONTACTADO: "border-stone-300 bg-stone-100 text-stone-700", MUESTRA: "border-amber-300 bg-amber-50 text-amber-800",
  NEGOCIANDO: "border-violet-300 bg-violet-50 text-violet-800", GANADO: "border-verde-700/40 bg-verde-50 text-verde-800", PERDIDO: "border-rojo-600/40 bg-rojo-50 text-rojo-700",
};
type Vista = "abiertos" | "hoy" | "todos" | string;

export function ListaLeads({ filas, hoy }: { filas: FilaLead[]; hoy: string }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [vista, setVista] = useState<Vista>("abiertos");
  const [buscar, setBuscar] = useState("");
  const [cambiados, setCambiados] = useState<Record<string, string>>({}); // estado recién cambiado (se ve al instante)
  const estadoDe = (f: FilaLead) => cambiados[f.id] ?? f.estado;
  const abierto = (f: FilaLead) => ABIERTOS.includes(estadoDe(f) as never);
  const vence = (f: FilaLead) => abierto(f) && f.proximo !== null && f.proximo <= hoy; // hay que escribirle hoy o ya se pasó

  const cambiarEstado = (f: FilaLead, nuevo: string) => {
    let motivo = "";
    if (nuevo === "PERDIDO") {
      const r = window.prompt(`¿Por qué se perdió ${f.nombre}? (motivo)`);
      if (r === null) return;
      motivo = r.trim();
    }
    setCambiados((x) => ({ ...x, [f.id]: nuevo }));
    const datos = new FormData();
    datos.set("estado", nuevo); datos.set("motivo", motivo);
    empezar(async () => { await cambiarEstadoLead(f.id, datos); router.refresh(); });
  };

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    const r = filas.filter((f) => {
      const e = estadoDe(f);
      if (vista === "abiertos" ? !ABIERTOS.includes(e as never) : vista === "hoy" ? !vence(f) : vista !== "todos" && e !== vista) return false;
      return !q || `${f.nombre} ${f.contacto ?? ""} ${f.telefono ?? ""} ${f.barrio ?? ""} ${f.nota ?? ""}`.toLowerCase().includes(q);
    });
    // Primero los que hay que escribir hoy, después los nuevos sin tocar, después el resto (lo último que entró, arriba).
    const peso = (f: FilaLead) => (vence(f) ? 0 : estadoDe(f) === "NUEVO" ? 1 : abierto(f) ? 2 : 3);
    return [...r].sort((a, b) => peso(a) - peso(b) || b.ingreso.localeCompare(a.ingreso));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, vista, buscar, cambiados, hoy]);

  const nAbiertos = filas.filter(abierto).length;
  const nHoy = filas.filter(vence).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por nombre, teléfono, barrio o nota…" className="h-10 min-w-0 flex-1 rounded-md border border-stone-400 bg-white px-3 text-sm placeholder:text-stone-400 focus:border-verde-700 focus:outline-none" />
        <select value={vista} onChange={(e) => setVista(e.target.value)} aria-label="Qué leads ver" className="h-10 w-full rounded-md border border-stone-400 bg-white px-3 text-sm sm:w-64">
          <option value="abiertos">En seguimiento ({nAbiertos})</option>
          <option value="hoy">Para escribir hoy ({nHoy})</option>
          <option value="todos">Todos ({filas.length})</option>
          {ESTADOS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select>
      </div>

      <div className={`overflow-hidden rounded-lg border border-stone-300 bg-white ${pendiente ? "opacity-80" : ""}`}>
        <div className="border-b border-stone-200 px-3 py-2 text-sm text-stone-600">{visibles.length} {visibles.length === 1 ? "lead" : "leads"}{vista === "abiertos" ? " en seguimiento" : ""}</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead className="bg-stone-100 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-600">
              <tr><th className="px-3 py-2">Lead</th><th className="px-3 py-2">Teléfono</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2">Nota</th><th className="px-3 py-2 text-center">Escribirle</th><th className="w-20 px-3 py-2" /></tr>
            </thead>
            <tbody>
              {visibles.map((f) => {
                const e = estadoDe(f);
                return (
                  <tr key={f.id} className="h-14 border-t border-stone-200 align-middle hover:bg-stone-50">
                    <td className="px-3">
                      <Link href={`/comercial/leads/${f.id}`} className="font-semibold text-stone-900 hover:underline">{f.nombre}</Link>
                      <div className="text-[12px] text-stone-500">{[f.contacto, f.barrio].filter(Boolean).join(" · ") || "—"}</div>
                    </td>
                    <td className="px-3 tabular-nums">
                      {f.telefono ? (f.wa ? <a href={f.wa} target="_blank" rel="noreferrer" title="Escribirle por WhatsApp" className="font-medium text-verde-800 underline decoration-verde-700/40 underline-offset-2 hover:decoration-verde-700">{f.telefono}</a> : <span>{f.telefono}</span>) : <span className="text-stone-400">—</span>}
                    </td>
                    <td className="px-3">
                      <select value={e} onChange={(ev) => cambiarEstado(f, ev.target.value)} aria-label={`Estado de ${f.nombre}`} className={`h-8 rounded border px-1.5 text-[12px] font-bold ${PASTILLA[e]}`}>
                        {ESTADOS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                      </select>
                    </td>
                    <td className="max-w-[320px] px-3">
                      {f.nota && <div className="line-clamp-2 text-stone-800">{f.nota}</div>}
                      {f.ultimo && <div className="text-[11.5px] text-stone-500">Último contacto {corta(f.ultimo)} · {nombreTipo(f.ultimoTipo ?? "")}</div>}
                      {!f.nota && !f.ultimo && <span className="text-stone-400">—</span>}
                    </td>
                    <td className="px-3 text-center tabular-nums">
                      {f.proximo && abierto(f) ? <span className={vence(f) ? "rounded bg-rojo-50 px-2 py-0.5 font-bold text-rojo-700" : ""}>{f.proximo === hoy ? "Hoy" : corta(f.proximo)}</span> : <span className="text-stone-300">—</span>}
                    </td>
                    <td className="px-3 text-right"><Link href={`/comercial/leads/${f.id}`} className="rounded border border-stone-300 bg-white px-2.5 py-1 text-[12px] font-semibold hover:border-stone-500">Abrir ›</Link></td>
                  </tr>
                );
              })}
              {visibles.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-stone-500">{filas.length === 0 ? "Todavía no hay leads. Cargá el primero arriba." : "No hay leads para mostrar con ese filtro."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
