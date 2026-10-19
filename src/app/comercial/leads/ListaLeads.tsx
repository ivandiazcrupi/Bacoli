"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ABIERTOS, ESTADOS, nombreEstado } from "@/lib/leads";
import { FiltroLista, SEP } from "../../cuentas/FiltroLista";
import { cambiarEstadoLead } from "./actions";

export type FilaLead = {
  id: string; nombre: string; telefono: string | null; wa: string | null; barrio: string | null; tipo: string | null; contacto: string | null;
  estado: string; nota: string | null; proximo: string | null; ingreso: string; ultimo: string | null; ultimoTipo: string | null;
};

const corta = (s: string | null) => (s ? `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(2, 4)}` : "—");
const PASTILLA: Record<string, string> = {
  NUEVO: "border-sky-300 bg-sky-50 text-sky-800", CONTACTADO: "border-stone-300 bg-stone-100 text-stone-700", MUESTRA: "border-amber-300 bg-amber-50 text-amber-800",
  NEGOCIANDO: "border-violet-300 bg-violet-50 text-violet-800", GANADO: "border-verde-700/40 bg-verde-50 text-verde-800", PERDIDO: "border-rojo-600/40 bg-rojo-50 text-rojo-700",
};
type Col = "nombre" | "telefono" | "barrio" | "tipo" | "estado" | "nota" | "proximo";
const entrada = "h-7 w-full rounded border border-stone-400 bg-white px-1.5 text-[12px] font-normal normal-case tracking-normal text-stone-800 placeholder:text-stone-400 focus:border-verde-700 focus:outline-none";

// Todos los leads siempre a la vista; los filtros van en los títulos de cada columna, como en Excel.
export function ListaLeads({ filas, hoy }: { filas: FilaLead[]; hoy: string }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [filtros, setFiltros] = useState<Partial<Record<Col, string>>>({});
  const [cambiados, setCambiados] = useState<Record<string, string>>({});
  const estadoDe = (f: FilaLead) => cambiados[f.id] ?? f.estado;
  const abierto = (f: FilaLead) => ABIERTOS.includes(estadoDe(f) as never);
  const vence = (f: FilaLead) => abierto(f) && f.proximo !== null && f.proximo <= hoy;

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

  const opciones = (g: (f: FilaLead) => string | null) => [...new Set(filas.map(g).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "es"));
  const barrios = useMemo(() => opciones((f) => f.barrio), [filas]); // eslint-disable-line react-hooks/exhaustive-deps
  const tipos = useMemo(() => opciones((f) => f.tipo), [filas]); // eslint-disable-line react-hooks/exhaustive-deps
  const nombresEstado = ESTADOS.map(([, n]) => n);

  const visibles = useMemo(() => {
    const txt = (v: string | null | undefined, c: Col) => { const q = (filtros[c] ?? "").trim().toLowerCase(); return !q || (v ?? "").toLowerCase().includes(q); };
    const lista = (v: string | null, c: Col) => { const q = filtros[c]; return !q || q.split(SEP).includes(v ?? ""); };
    const r = filas.filter((f) => {
      const prox = f.proximo && abierto(f) ? (f.proximo === hoy ? `hoy ${corta(f.proximo)}` : corta(f.proximo)) : "";
      return txt(f.nombre, "nombre") && txt(f.telefono, "telefono") && lista(f.barrio, "barrio") && lista(f.tipo, "tipo")
        && lista(nombreEstado(estadoDe(f)), "estado") && txt(f.nota, "nota") && txt(prox, "proximo");
    });
    const peso = (f: FilaLead) => (vence(f) ? 0 : estadoDe(f) === "NUEVO" ? 1 : abierto(f) ? 2 : 3);
    return [...r].sort((a, b) => peso(a) - peso(b) || b.ingreso.localeCompare(a.ingreso));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, filtros, cambiados, hoy]);

  const hayFiltros = Object.values(filtros).some(Boolean);
  const t = (c: Col, ph: string) => <input value={filtros[c] ?? ""} onChange={(e) => setFiltros({ ...filtros, [c]: e.target.value })} placeholder={ph} aria-label={`Filtrar ${ph}`} className={entrada} />;
  const l = (c: Col, titulo: string, ops: string[]) => <FiltroLista varios titulo={titulo} opciones={ops} valor={filtros[c] ?? ""} onCambio={(v) => setFiltros({ ...filtros, [c]: v })} />;

  return (
    <div className={`overflow-hidden rounded-lg border border-stone-300 bg-white ${pendiente ? "opacity-80" : ""}`}>
      <div className="flex items-center justify-between border-b border-stone-200 px-3 py-2 text-sm text-stone-600">
        <span>{visibles.length === filas.length ? `${filas.length} leads` : `${visibles.length} de ${filas.length} leads`}</span>
        {hayFiltros && <button onClick={() => setFiltros({})} className="text-[12px] font-semibold text-stone-700 underline">Quitar filtros ✕</button>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-[13px]">
          <thead className="bg-stone-100 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-600">
            <tr>
              <th className="px-3 pt-2">Nombre</th><th className="px-3 pt-2">Teléfono</th><th className="px-3 pt-2">Barrio</th><th className="px-3 pt-2">Tipo de comercio</th>
              <th className="px-3 pt-2">Estado</th><th className="px-3 pt-2">Nota</th><th className="px-3 pt-2 text-center">Escribirle</th><th className="w-20" />
            </tr>
            <tr className="align-top">
              <th className="px-3 pb-2 pt-1">{t("nombre", "Nombre")}</th><th className="px-3 pb-2 pt-1">{t("telefono", "Teléfono")}</th>
              <th className="px-3 pb-2 pt-1">{l("barrio", "Barrio", barrios)}</th><th className="px-3 pb-2 pt-1">{l("tipo", "Tipo", tipos)}</th>
              <th className="px-3 pb-2 pt-1">{l("estado", "Estado", nombresEstado)}</th><th className="px-3 pb-2 pt-1">{t("nota", "Nota")}</th>
              <th className="px-3 pb-2 pt-1">{t("proximo", "Fecha")}</th><th />
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => {
              const e = estadoDe(f);
              return (
                <tr key={f.id} className="h-12 border-t border-stone-200 align-middle hover:bg-stone-50">
                  <td className="px-3"><Link href={`/comercial/leads/${f.id}`} className="font-semibold text-stone-900 hover:underline">{f.nombre}</Link></td>
                  <td className="px-3 tabular-nums">
                    {f.telefono ? (f.wa ? <a href={f.wa} target="_blank" rel="noreferrer" title="Escribirle por WhatsApp" className="font-medium text-verde-800 underline decoration-verde-700/40 underline-offset-2">{f.telefono}</a> : f.telefono) : <span className="text-stone-400">—</span>}
                  </td>
                  <td className="px-3 font-medium">{f.barrio ?? <span className="text-stone-400">—</span>}</td>
                  <td className="px-3">{f.tipo ?? <span className="text-stone-400">—</span>}</td>
                  <td className="px-3">
                    <select value={e} onChange={(ev) => cambiarEstado(f, ev.target.value)} aria-label={`Estado de ${f.nombre}`} className={`h-8 rounded border px-1.5 text-[12px] font-bold ${PASTILLA[e]}`}>
                      {ESTADOS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                    </select>
                  </td>
                  <td className="max-w-[320px] px-3"><div className="line-clamp-2 text-stone-800">{f.nota ?? <span className="text-stone-400">—</span>}</div></td>
                  <td className="px-3 text-center tabular-nums">
                    {f.proximo && abierto(f) ? <span className={vence(f) ? "rounded bg-rojo-50 px-2 py-0.5 font-bold text-rojo-700" : ""}>{f.proximo === hoy ? "Hoy" : corta(f.proximo)}</span> : <span className="text-stone-300">—</span>}
                  </td>
                  <td className="px-3 text-right"><Link href={`/comercial/leads/${f.id}`} className="rounded border border-stone-300 bg-white px-2.5 py-1 text-[12px] font-semibold hover:border-stone-500">Abrir ›</Link></td>
                </tr>
              );
            })}
            {visibles.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-stone-500">{filas.length === 0 ? "Todavía no hay leads. Cargá el primero arriba." : "No hay leads con esos filtros."}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
