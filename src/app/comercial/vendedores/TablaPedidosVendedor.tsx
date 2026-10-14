"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { coincideNumero } from "@/lib/filtroNumero";
import { formatoPesos } from "@/lib/numeros";
import type { FilaVendedor } from "@/lib/vendedores";
import { FiltroLista, SEP } from "../../cuentas/FiltroLista";
import { avisarPago, quitarAvisoPago } from "../../vendedor/actions";

// Los pedidos de un vendedor como una cuenta corriente: filtro arriba de cada columna, orden al tocar el título,
// vistas Todos / Sin pagar / Pagados y total abajo. El vendedor puede avisar que un pedido se pagó; la oficina lo confirma en Cuenta corriente.

const ESTADOS = { PENDIENTE: "Pendiente", ENTREGADO: "Entregado", NO_ENTREGADO: "No entregado" } as const;
const PASTILLA_ESTADO = { PENDIENTE: "bg-[#fdf8e3] text-[#8a6a05]", ENTREGADO: "bg-verde-50 text-verde-700", NO_ENTREGADO: "bg-rojo-50 text-rojo-700" } as const;
const MEDIOS: Record<string, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", CHEQUE: "Cheque", MERCADO_PAGO: "Mercado Pago", OTRO: "Otro" };
const pastilla = "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12.5px] font-bold";
const fecha = (s: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(2, 4)}` : "");
const entrada = "h-7 w-full min-w-0 rounded border border-stone-300 bg-white px-1.5 text-center text-[12px] font-normal normal-case tracking-normal text-stone-800 placeholder:text-stone-300 focus:border-verde-700 focus:outline-none";

type Pago = "Pagado" | "Sin pagar" | "Cuenta corriente" | "Avisó pago" | "Sin entregar";
const pagoDe = (x: FilaVendedor): Pago => (x.pagado ? "Pagado" : x.estado === "ENTREGADO" ? (x.avisadoPor ? "Avisó pago" : x.aCuenta ? "Cuenta corriente" : "Sin pagar") : "Sin entregar");
type Col = "cargado" | "entregado" | "cliente" | "pedido" | "comprobante" | "monto" | "comision" | "estado" | "pago";
type Vista = "todos" | "sinpagar" | "pagados";

export function TablaPedidosVendedor({ filas, pct, comision = true, modo }: { filas: FilaVendedor[]; pct: number; comision?: boolean; modo: "oficina" | "vendedor" }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [vista, setVista] = useState<Vista>("todos");
  const [filtros, setFiltros] = useState<Partial<Record<Col, string>>>({});
  const [orden, setOrden] = useState<{ col: Col; dir: 1 | -1 }>({ col: "cargado", dir: -1 });
  const [error, setError] = useState("");

  const com = (x: FilaVendedor) => (x.estado === "ENTREGADO" ? (x.neto * pct) / 100 : null);
  const valor = (x: FilaVendedor, c: Col): string | number => {
    switch (c) {
      case "cargado": return x.cargado;
      case "entregado": return x.estado === "ENTREGADO" ? x.entrega ?? "" : "";
      case "cliente": return x.cliente;
      case "pedido": return x.items.map((i) => `${i.cantidad} ${i.nombre}`).join(" ");
      case "comprobante": return x.comprobante ?? "";
      case "monto": return x.total;
      case "comision": return com(x) ?? -1;
      case "estado": return ESTADOS[x.estado];
      case "pago": return pagoDe(x);
    }
  };
  const nombres = useMemo(() => [...new Set(filas.map((f) => f.cliente))].sort((a, b) => a.localeCompare(b, "es")), [filas]);
  const sinPagar = (x: FilaVendedor) => x.estado === "ENTREGADO" && !x.pagado;

  const visibles = useMemo(() => {
    const lista = filas.filter((x) => {
      if (vista === "sinpagar" && !sinPagar(x)) return false;
      if (vista === "pagados" && !x.pagado) return false;
      for (const [c, f] of Object.entries(filtros) as [Col, string][]) {
        const t = f.trim();
        if (!t) continue;
        if (c === "cliente" || c === "estado" || c === "pago") { if (!t.split(SEP).includes(String(valor(x, c)))) return false; continue; }
        if (c === "monto") { if (!coincideNumero(x.total, t)) return false; continue; }
        if (c === "comision") { if (!coincideNumero(com(x), t)) return false; continue; }
        const v = c === "cargado" || c === "entregado" ? fecha(String(valor(x, c))) : String(valor(x, c));
        if (!v.toLowerCase().includes(t.toLowerCase())) return false;
      }
      return true;
    });
    const { col, dir } = orden;
    return lista.sort((a, b) => {
      const va = valor(a, col), vb = valor(b, col);
      const r = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "es");
      return r * dir || a.cliente.localeCompare(b.cliente, "es");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, vista, filtros, orden, pct]);

  const entregadas = visibles.filter((x) => x.estado === "ENTREGADO");
  const totalMonto = entregadas.reduce((t, x) => t + x.total, 0);
  const totalCom = entregadas.reduce((t, x) => t + (x.neto * pct) / 100, 0);
  const hayFiltros = Object.values(filtros).some((v) => v?.trim());

  const ejecutar = (f: () => Promise<{ ok: boolean; error?: string }>) => empezar(async () => { const r = await f(); setError(r.ok ? "" : r.error ?? "No se pudo."); router.refresh(); });
  const avisar = (x: FilaVendedor) => { if (window.confirm(`¿Avisás que ${x.cliente} pagó este pedido?\n\nEsto no registra el pago: la oficina lo ve en Cuenta corriente y lo confirma ella.`)) ejecutar(() => avisarPago(x.id)); };

  const titulo = (c: Col, texto: string, izq = false) => (
    <th key={c} className={`px-2 pb-1 pt-2 font-semibold ${izq ? "text-left" : ""}`}>
      <button type="button" onClick={() => setOrden(orden.col === c ? { col: c, dir: orden.dir === 1 ? -1 : 1 } : { col: c, dir: 1 })} className="uppercase tracking-wide hover:text-stone-900">
        {texto}{orden.col === c ? (orden.dir === 1 ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );
  const texto = (c: Col, ph = "Filtrar…") => <td key={c} className="px-1.5 pb-2"><input value={filtros[c] ?? ""} onChange={(e) => setFiltros({ ...filtros, [c]: e.target.value })} placeholder={ph} className={entrada} /></td>;
  const lista = (c: Col, t: string, opciones: string[]) => <td key={c} className="px-1.5 pb-2"><FiltroLista varios titulo={t} opciones={opciones} valor={filtros[c] ?? ""} onCambio={(v) => setFiltros({ ...filtros, [c]: v })} /></td>;

  const vistaBoton = (v: Vista, t: string, n: number) => (
    <button key={v} type="button" onClick={() => setVista(v)} className={`rounded-md px-4 py-1.5 text-sm font-semibold ${vista === v ? "bg-stone-800 text-white" : "border border-stone-300 bg-white text-stone-700 hover:border-stone-500"}`}>{t} <span className="opacity-70">{n}</span></button>
  );

  return (
    <section className="overflow-hidden rounded-xl border border-stone-300 bg-white">
      <header className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-4 py-3">
        {vistaBoton("todos", "Todos", filas.length)}
        {vistaBoton("sinpagar", "Sin pagar", filas.filter(sinPagar).length)}
        {vistaBoton("pagados", "Pagados", filas.filter((x) => x.pagado).length)}
        <span className="ml-3 text-[12.5px] text-stone-500">{visibles.length} de {filas.length} pedidos</span>
        {hayFiltros && <button type="button" onClick={() => setFiltros({})} className="text-[12.5px] font-semibold text-stone-600 underline decoration-stone-300 underline-offset-4 hover:text-stone-900">Quitar filtros ✕</button>}
        {error && <span className="ml-auto text-sm font-medium text-rojo-700">{error}</span>}
      </header>
      <div className="overflow-x-auto">
        <table className={`w-full min-w-[1150px] text-center text-[13px] ${pendiente ? "opacity-70" : ""}`}>
          <thead className="bg-stone-100 text-[11px] text-stone-600">
            <tr className="align-bottom">
              {titulo("cargado", "Cargado")}{titulo("entregado", "Entregado")}{titulo("cliente", "Cliente", true)}{titulo("pedido", "Pedido", true)}{titulo("comprobante", "Comprobante")}{titulo("monto", "Monto")}
              {comision && titulo("comision", "Comisión")}{titulo("estado", "Estado")}{titulo("pago", "Pago")}
            </tr>
            <tr>
              {texto("cargado")}{texto("entregado")}{lista("cliente", "Cliente", nombres)}{texto("pedido")}{texto("comprobante")}{texto("monto", ">1000")}
              {comision && texto("comision", ">1000")}{lista("estado", "Estado", Object.values(ESTADOS))}{lista("pago", "Pago", ["Pagado", "Sin pagar", "Cuenta corriente", "Avisó pago", "Sin entregar"])}
            </tr>
          </thead>
          <tbody>
            {visibles.map((x) => {
              const p = pagoDe(x);
              return (
                <tr key={x.id} className="border-t border-stone-200">
                  <td className="px-2 py-2.5 tabular-nums">{fecha(x.cargado)}</td>
                  <td className="px-2 py-2.5 tabular-nums">{x.estado === "ENTREGADO" && x.entrega ? fecha(x.entrega) : <span className="text-stone-300">—</span>}</td>
                  <td className="px-2 py-2.5 text-left"><div className="font-semibold">{x.cliente}</div>{x.barrio && <div className="text-[12px] text-stone-500">{x.barrio}</div>}</td>
                  <td className="px-2 py-2.5 text-left">{x.items.map((i, k) => <div key={k}><b>{i.cantidad}</b> {i.nombre}</div>)}</td>
                  <td className="px-2 py-2.5 font-medium tabular-nums">{x.comprobante ?? <span className="text-stone-300">—</span>}</td>
                  <td className="px-2 py-2.5 font-bold tabular-nums">{formatoPesos(x.total)}</td>
                  {comision && <td className="px-2 py-2.5 tabular-nums">{com(x) !== null ? formatoPesos(com(x)!) : <span className="text-stone-300">—</span>}</td>}
                  <td className="px-2 py-2.5"><span className={`${pastilla} ${PASTILLA_ESTADO[x.estado]}`}>{ESTADOS[x.estado]}</span></td>
                  <td className="px-2 py-2.5">
                    {p === "Pagado" ? <span className={`${pastilla} bg-verde-50 text-verde-700`}>Pagado{x.medio ? <span className="text-[11.5px] font-medium"> · {MEDIOS[x.medio] ?? ""}</span> : null}</span>
                      : p === "Avisó pago" ? (
                        <span className={`${pastilla} bg-[#fdf8e3] text-[#8a6a05]`} title="Falta la confirmación de la oficina, que lo registra en Cuenta corriente">
                          {modo === "vendedor" ? "Avisaste el pago" : `${x.avisadoPor?.split(" ")[0]} avisó pago`}
                          {modo === "vendedor"
                            ? <button type="button" disabled={pendiente} title="Quitar el aviso" aria-label="Quitar el aviso" onClick={() => ejecutar(() => quitarAvisoPago(x.id))} className="text-[11px] opacity-60 hover:opacity-100">✕</button>
                            : <Link href={`/cuentas/${x.clienteId}`} className="text-[11.5px] font-semibold underline underline-offset-2">Confirmar ›</Link>}
                        </span>
                      )
                      : p === "Sin pagar" || p === "Cuenta corriente" ? (
                        <span className="inline-flex items-center gap-2">
                          <span className={`${pastilla} bg-rojo-50 text-rojo-700`}>{p}</span>
                          {modo === "vendedor" && <button type="button" disabled={pendiente} onClick={() => avisar(x)} className="h-7 whitespace-nowrap rounded-md border border-stone-300 bg-white px-2.5 text-[12px] font-semibold text-stone-700 hover:border-stone-700 hover:bg-stone-800 hover:text-white disabled:opacity-50">Avisar que pagó</button>}
                        </span>
                      )
                      : <span className="text-stone-400">{x.estado === "NO_ENTREGADO" ? "—" : "Sin entregar"}</span>}
                  </td>
                </tr>
              );
            })}
            {visibles.length === 0 && <tr><td colSpan={comision ? 9 : 8} className="px-4 py-12 text-stone-500">{filas.length === 0 ? "No hay pedidos en este mes." : "No hay pedidos con ese filtro."}</td></tr>}
          </tbody>
          {visibles.length > 0 && (
            <tfoot className="border-t-2 border-stone-300 bg-stone-50 text-[13px] font-bold">
              <tr>
                <td colSpan={5} className="px-3 py-2.5 text-right text-[11px] uppercase tracking-wide text-stone-600">Total entregado{hayFiltros || vista !== "todos" ? " (con el filtro)" : ""}</td>
                <td className="px-2 py-2.5 tabular-nums">{formatoPesos(totalMonto)}</td>
                {comision && <td className="px-2 py-2.5 tabular-nums">{formatoPesos(totalCom)}</td>}
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}
