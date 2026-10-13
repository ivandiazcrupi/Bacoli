"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ABIERTOS, ESTADOS, nombreEstado, nombreTipo } from "@/lib/leads";
import { FiltroLista, SEP } from "../../cuentas/FiltroLista";

export type FilaLead = {
  id: string; nombre: string; contacto: string | null; telefono: string | null; wa: string | null;
  barrio: string | null; origen: string | null; estado: string; vendedor: string | null;
  proximo: string | null; ingreso: string; ultimo: string | null; ultimoTipo: string | null;
};

const corta = (s: string | null) => (s ? `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(2, 4)}` : "—");
const PASTILLA: Record<string, string> = {
  NUEVO: "bg-sky-50 text-sky-800", CONTACTADO: "bg-stone-100 text-stone-700", MUESTRA: "bg-amber-50 text-amber-800",
  NEGOCIANDO: "bg-violet-50 text-violet-800", GANADO: "bg-verde-50 text-verde-800", PERDIDO: "bg-rojo-50 text-rojo-700",
};
const entrada = "h-7 w-full min-w-0 rounded border border-stone-300 bg-white px-1.5 text-center text-[12px] font-normal normal-case tracking-normal text-stone-800 placeholder:text-stone-300 focus:border-verde-700 focus:outline-none";
type Col = "nombre" | "ingreso" | "ultimo" | "proximo";

function Tarjeta({ titulo, valor, rojo, activa, ayuda, onClick, onQuitar }: { titulo: string; valor: number; rojo?: boolean; activa: boolean; ayuda: string; onClick: () => void; onQuitar: () => void }) {
  return (
    <div className="relative">
      <button type="button" onClick={onClick} title={ayuda} aria-pressed={activa}
        className={`flex h-[84px] w-full flex-col items-center justify-between rounded-lg border px-4 pb-2 pt-2 text-center ${activa ? "border-stone-800 bg-stone-800" : "border-stone-300 bg-white hover:border-stone-500"}`}>
        <span className={`flex h-7 w-full items-center justify-center whitespace-normal text-[11px] font-semibold uppercase leading-tight tracking-wide ${activa ? "text-stone-300" : "text-stone-500"}`}>{titulo}</span>
        <span className={`flex flex-1 items-center text-3xl font-bold tabular-nums leading-none ${activa ? "text-white" : valor === 0 ? "text-stone-300" : rojo ? "text-rojo-600" : "text-stone-900"}`}>{valor}</span>
      </button>
      {activa && <button type="button" onClick={onQuitar} aria-label="Salir de este filtro" title="Salir de este filtro" className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded text-[15px] font-bold leading-none text-stone-300 hover:bg-stone-600 hover:text-white">✕</button>}
    </div>
  );
}

export function ListaLeads({ filas, hoy }: { filas: FilaLead[]; hoy: string }) {
  const [grupo, setGrupo] = useState<string>("todos"); // "todos" | "hoy" | estado
  const [buscar, setBuscar] = useState("");
  const [fEstado, setFEstado] = useState(""); const [fOrigen, setFOrigen] = useState(""); const [fVendedor, setFVendedor] = useState("");
  const [fIngreso, setFIngreso] = useState(""); const [fUltimo, setFUltimo] = useState(""); const [fProximo, setFProximo] = useState("");
  const [orden, setOrden] = useState<{ col: Col; asc: boolean } | null>(null);

  const abierto = (f: FilaLead) => ABIERTOS.includes(f.estado as never);
  const vence = (f: FilaLead) => abierto(f) && f.proximo !== null && f.proximo <= hoy; // hay que escribirle hoy o ya se pasó
  const cuenta = (e: string) => filas.filter((f) => f.estado === e).length;
  const aVencer = filas.filter(vence).length;

  const lista = (v: string) => (v ? v.split(SEP) : []);
  const opciones = (k: "origen" | "vendedor") => [...new Set(filas.map((f) => f[k]).filter(Boolean) as string[])].sort();
  const hayFiltros = !!(buscar || fEstado || fOrigen || fVendedor || fIngreso || fUltimo || fProximo);
  const quitar = () => { setBuscar(""); setFEstado(""); setFOrigen(""); setFVendedor(""); setFIngreso(""); setFUltimo(""); setFProximo(""); };
  const tiene = (txt: string, q: string) => txt.toLowerCase().includes(q.trim().toLowerCase());

  const visibles = useMemo(() => {
    const r = filas.filter((f) => {
      if (grupo === "hoy" ? !vence(f) : grupo !== "todos" && f.estado !== grupo) return false;
      if (buscar && !tiene(`${f.nombre} ${f.contacto ?? ""} ${f.telefono ?? ""} ${f.barrio ?? ""}`, buscar)) return false;
      if (fEstado && !lista(fEstado).includes(nombreEstado(f.estado))) return false;
      if (fOrigen && !lista(fOrigen).includes(f.origen ?? "—")) return false;
      if (fVendedor && !lista(fVendedor).includes(f.vendedor ?? "—")) return false;
      if (fIngreso && !tiene(corta(f.ingreso), fIngreso)) return false;
      if (fUltimo && !tiene(`${corta(f.ultimo)} ${f.ultimoTipo ? nombreTipo(f.ultimoTipo) : ""}`, fUltimo)) return false;
      if (fProximo && !tiene(f.proximo ? corta(f.proximo) : "sin fecha", fProximo)) return false;
      return true;
    });
    // Orden por defecto: primero los que hay que escribir hoy, después los nuevos sin tocar, después el resto por ingreso.
    const peso = (f: FilaLead) => (vence(f) ? 0 : f.estado === "NUEVO" ? 1 : abierto(f) ? 2 : 3);
    return [...r].sort((a, b) => {
      if (orden) {
        const x = a[orden.col] ?? "", y = b[orden.col] ?? "";
        if (!x && y) return 1; if (x && !y) return -1;
        return (orden.asc ? 1 : -1) * (x < y ? -1 : x > y ? 1 : 0);
      }
      return peso(a) - peso(b) || (a.proximo ?? "9") .localeCompare(b.proximo ?? "9") || b.ingreso.localeCompare(a.ingreso);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, grupo, buscar, fEstado, fOrigen, fVendedor, fIngreso, fUltimo, fProximo, orden, hoy]);

  const titulo = (col: Col, texto: string) => (
    <button type="button" onClick={() => setOrden((o) => (o?.col === col ? { col, asc: !o.asc } : { col, asc: true }))} className="font-semibold uppercase tracking-wide">
      {texto}{orden?.col === col ? (orden.asc ? " ▲" : " ▼") : ""}
    </button>
  );

  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Tarjeta titulo="Escribir hoy" valor={aVencer} rojo ayuda="Seguimientos para hoy o que ya se pasaron." activa={grupo === "hoy"} onClick={() => setGrupo("hoy")} onQuitar={() => setGrupo("todos")} />
        <Tarjeta titulo="Todos" valor={filas.length} ayuda="Todos los leads." activa={grupo === "todos"} onClick={() => setGrupo("todos")} onQuitar={() => setGrupo("todos")} />
        {ESTADOS.map(([k, n, a]) => <Tarjeta key={k} titulo={n} valor={cuenta(k)} ayuda={a} activa={grupo === k} onClick={() => setGrupo(k)} onQuitar={() => setGrupo("todos")} />)}
      </div>

      <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por nombre, persona, teléfono o barrio…" className="h-10 w-full rounded-md border border-stone-400 bg-white px-3 text-sm placeholder:text-stone-400 focus:border-verde-700 focus:outline-none" />

      <div className="overflow-hidden rounded-lg border border-stone-300 bg-white">
        <div className="flex items-center gap-3 border-b border-stone-200 px-3 py-2 text-sm text-stone-600">
          <span>{visibles.length} {visibles.length === 1 ? "lead" : "leads"}{visibles.length !== filas.length && ` de ${filas.length}`}</span>
          {hayFiltros && <button type="button" onClick={quitar} className="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs font-semibold text-stone-700 hover:border-stone-500">Quitar filtros ✕</button>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-center text-[13px]">
            <thead className="bg-stone-100 text-[11px] text-stone-600">
              <tr className="align-bottom">
                <th className="px-2 pb-1 pt-2">{titulo("nombre", "Lead")}</th>
                <th className="px-2 pb-1 pt-2 font-semibold uppercase tracking-wide">Estado</th>
                <th className="px-2 pb-1 pt-2 font-semibold uppercase tracking-wide">Origen</th>
                <th className="px-2 pb-1 pt-2">{titulo("ingreso", "Ingresó")}</th>
                <th className="px-2 pb-1 pt-2">{titulo("ultimo", "Último contacto")}</th>
                <th className="px-2 pb-1 pt-2">{titulo("proximo", "Próximo contacto")}</th>
                <th className="px-2 pb-1 pt-2 font-semibold uppercase tracking-wide">Vendedor</th>
                <th className="px-2 pb-1 pt-2 font-semibold uppercase tracking-wide">WhatsApp</th>
                <th className="w-24 px-2 pb-1 pt-2" />
              </tr>
              <tr className="font-normal">
                <th className="px-2 pb-2" />
                <th className="px-2 pb-2"><FiltroLista varios titulo="Estado" opciones={ESTADOS.map(([, n]) => n)} valor={fEstado} onCambio={setFEstado} /></th>
                <th className="px-2 pb-2"><FiltroLista varios titulo="Origen" opciones={[...opciones("origen"), "—"]} valor={fOrigen} onCambio={setFOrigen} /></th>
                <th className="px-2 pb-2"><input value={fIngreso} onChange={(e) => setFIngreso(e.target.value)} placeholder="Ej: 12/10" className={entrada} /></th>
                <th className="px-2 pb-2"><input value={fUltimo} onChange={(e) => setFUltimo(e.target.value)} placeholder="Ej: llamé" className={entrada} /></th>
                <th className="px-2 pb-2"><input value={fProximo} onChange={(e) => setFProximo(e.target.value)} placeholder="Ej: 15/10" className={entrada} /></th>
                <th className="px-2 pb-2"><FiltroLista varios titulo="Vendedor" opciones={[...opciones("vendedor"), "—"]} valor={fVendedor} onCambio={setFVendedor} /></th>
                <th className="px-2 pb-2" /><th className="px-2 pb-2" />
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={f.id} className="h-14 border-t border-stone-200 hover:bg-stone-50">
                  <td className="px-2 text-left">
                    <Link href={`/comercial/leads/${f.id}`} className="font-semibold text-stone-900 hover:underline">{f.nombre}</Link>
                    <div className="text-[12px] text-stone-500">{[f.contacto, f.barrio].filter(Boolean).join(" · ") || "—"}</div>
                  </td>
                  <td className="px-2"><span className={`inline-block rounded px-2 py-0.5 text-[12px] font-bold ${PASTILLA[f.estado]}`}>{nombreEstado(f.estado)}</span></td>
                  <td className="px-2 text-stone-700">{f.origen ?? "—"}</td>
                  <td className="px-2 tabular-nums">{corta(f.ingreso)}</td>
                  <td className="px-2">{f.ultimo ? <><span className="tabular-nums">{corta(f.ultimo)}</span><div className="text-[11px] text-stone-500">{nombreTipo(f.ultimoTipo ?? "")}</div></> : <span className="text-stone-400">Sin contacto</span>}</td>
                  <td className="px-2 tabular-nums">
                    {f.proximo && abierto(f) ? <span className={vence(f) ? "rounded bg-rojo-50 px-2 py-0.5 font-bold text-rojo-700" : ""}>{f.proximo === hoy ? "Hoy" : corta(f.proximo)}</span> : <span className="text-stone-400">—</span>}
                  </td>
                  <td className="px-2 text-stone-700">{f.vendedor ?? "—"}</td>
                  <td className="px-2">{f.wa ? <a href={f.wa} target="_blank" rel="noreferrer" className="rounded border border-verde-700 px-2 py-1 text-[12px] font-semibold text-verde-800 hover:bg-verde-50">WhatsApp</a> : <span className="text-[12px] text-stone-400">{f.telefono ? "Teléfono no válido" : "Sin teléfono"}</span>}</td>
                  <td className="px-2"><Link href={`/comercial/leads/${f.id}`} className="rounded border border-stone-300 bg-white px-2.5 py-1 text-[12px] font-semibold hover:border-stone-500">Abrir ›</Link></td>
                </tr>
              ))}
              {visibles.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-stone-500">{filas.length === 0 ? "Todavía no hay leads. Con “+ Cargar lead” sumás el primero." : "No hay leads con esos filtros."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
