import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { vendedoresDesbloqueado } from "@/lib/claveVendedores";
import { db } from "@/lib/db";
import { esFechaValida, hoy } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";
import { filasDelPeriodo, mesAnterior, mesSiguiente, nombreMes, resumenDe } from "@/lib/vendedores";
import { num } from "@/lib/ruta";
import { CONTENEDOR_PEDIDOS } from "../../pedidos/Encabezado";
import { EncabezadoComercial } from "../EncabezadoComercial";
import { PantallaBloqueada } from "./Bloqueo";
import { BotonImportar, BotonSalir, CambiarClave } from "./Formularios";

const nav = "flex h-9 items-center rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold hover:border-stone-600";

// VENDEDORES: quién comisiona, cuánto vendió y cuánto le toca este mes. Se entra con la contraseña del apartado.
export default async function Vendedores({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const usuario = await exigirOficina();
  if (!(await vendedoresDesbloqueado())) return <PantallaBloqueada usuario={usuario} />;
  const { mes: mesParam } = await searchParams;
  const actual = hoy().slice(0, 7);
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) && esFechaValida(`${mesParam}-01`) ? mesParam : actual;

  const [vendedores, filasMes, filasAnt, conComisionista] = await Promise.all([
    db.vendedor.findMany({ orderBy: [{ activo: "desc" }, { nombre: "asc" }], include: { _count: { select: { clientes: true } } } }),
    filasDelPeriodo(`${mes}-01`, `${mesSiguiente(mes)}-01`),
    filasDelPeriodo(`${mesAnterior(mes)}-01`, `${mes}-01`),
    db.cliente.findMany({ where: { comisionista: { not: null }, vendedorId: null }, select: { comisionista: true, comisionPct: true } }),
  ]);

  // Comisionistas que estaban escritos en las fichas de los clientes y todavía no son vendedores.
  const yaVendedor = new Set(vendedores.map((v) => v.nombre.trim().toLowerCase()));
  const grupos = new Map<string, { nombre: string; clientes: number; pct: number }>();
  for (const c of conComisionista) {
    const nombre = (c.comisionista ?? "").trim();
    if (!nombre || yaVendedor.has(nombre.toLowerCase())) continue;
    const g = grupos.get(nombre.toLowerCase()) ?? { nombre, clientes: 0, pct: 0 };
    g.clientes += 1; g.pct = Math.max(g.pct, Number(c.comisionPct ?? 0));
    grupos.set(nombre.toLowerCase(), g);
  }

  const filas = vendedores.map((v) => {
    const pct = Number(v.comisionPct ?? 0);
    const r = resumenDe(filasMes.filter((x) => x.vendedorId === v.id), pct);
    const antes = resumenDe(filasAnt.filter((x) => x.vendedorId === v.id), pct);
    return { v, pct, r, antes };
  });
  const tot = {
    neto: filas.reduce((t, f) => t + f.r.neto, 0), comision: filas.reduce((t, f) => t + f.r.comision, 0),
    unidades: filas.reduce((t, f) => t + f.r.unidades, 0), pedidos: filas.reduce((t, f) => t + f.r.pedidos, 0), porCobrar: filas.reduce((t, f) => t + f.r.porCobrar, 0),
    netoAntes: filas.reduce((t, f) => t + f.antes.neto, 0),
  };
  const COLS = "grid grid-cols-[minmax(200px,1.6fr)_1fr_1fr_0.8fr_0.7fr_1fr_0.8fr_1.5rem] items-center gap-x-4 px-5";
  const maxNeto = Math.max(...filas.map((f) => f.r.neto), 1);
  const variacion = tot.netoAntes > 0 ? Math.round(((tot.neto - tot.netoAntes) / tot.netoAntes) * 100) : null;

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={`${CONTENEDOR_PEDIDOS} space-y-6`}>
        <EncabezadoComercial
          activa="vendedores"
          derecha={
            <>
              <nav className="flex items-center gap-2" aria-label="Mes">
                <Link href={`/comercial/vendedores?mes=${mesAnterior(mes)}`} className={nav} aria-label="Mes anterior">←</Link>
                <span className="min-w-40 text-center text-sm font-semibold capitalize text-stone-700">{nombreMes(mes)}</span>
                <Link href={`/comercial/vendedores?mes=${mesSiguiente(mes)}`} className={nav} aria-label="Mes siguiente">→</Link>
              </nav>
              <Link href="/comercial/vendedores/nuevo" className="ml-2 whitespace-nowrap rounded-lg bg-verde-700 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-verde-800 sm:px-10">+ Nuevo vendedor</Link>
            </>
          }
        />

        {[...grupos.values()].map((g) => <BotonImportar key={g.nombre} comisionista={g.nombre} clientes={g.clientes} pct={g.pct ? String(g.pct).replace(".", ",") : ""} />)}

        {filas.length > 0 && (
          <section aria-label={`Resumen de ${nombreMes(mes)}`} className="flex flex-wrap items-center gap-x-8 gap-y-1 rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-[13px] text-stone-500">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">{nombreMes(mes)}</span>
            {[
              ["Facturaron", formatoPesos(tot.neto)], ["Comisiones", formatoPesos(tot.comision)], ["Unidades", num(tot.unidades)], ["Pedidos", String(tot.pedidos)], ["Por cobrar", formatoPesos(tot.porCobrar)],
            ].map(([t, v]) => <span key={t}>{t} <b className="ml-1 font-semibold tabular-nums text-stone-800">{v}</b></span>)}
            {variacion !== null && <span className={`ml-auto font-semibold ${variacion >= 0 ? "text-verde-700" : "text-rojo-700"}`}>{variacion >= 0 ? "▲" : "▼"} {Math.abs(variacion)}% vs mes anterior</span>}
          </section>
        )}

        {filas.length > 0 ? (
          <section className="overflow-hidden rounded-xl border border-stone-300 bg-white">
            <div className="overflow-x-auto">
              <div className="min-w-[860px] text-[13px]">
                <div className={`${COLS} bg-stone-100 py-2 text-[11px] font-semibold uppercase tracking-wide text-stone-600`}>
                  <span>Vendedor</span><span className="text-center">Facturó</span><span className="text-center">Comisión</span><span className="text-center">Unidades</span><span className="text-center">Pedidos</span><span className="text-center">Por cobrar</span><span className="text-center">Vs mes ant.</span><span />
                </div>
                {filas.map(({ v, pct, r, antes }) => {
                  const dv = antes.neto > 0 ? Math.round(((r.neto - antes.neto) / antes.neto) * 100) : null;
                  return (
                    <Link key={v.id} href={`/comercial/vendedores/${v.id}?mes=${mes}`} className={`group ${COLS} border-t border-stone-200 py-3 transition hover:bg-stone-50 ${v.activo ? "" : "opacity-55"}`}>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-stone-900">{v.nombre}{!v.activo && <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-medium text-stone-600">de baja</span>}</p>
                        <p className="mt-0.5 text-[12px] text-stone-500">{v._count.clientes} {v._count.clientes === 1 ? "cliente" : "clientes"}{pct ? ` · ${String(pct).replace(".", ",")}%` : " · sin % cargado"}</p>
                      </div>
                      <span className="text-center tabular-nums text-stone-800">{formatoPesos(r.neto)}</span>
                      <span className="text-center tabular-nums text-stone-800">{formatoPesos(r.comision)}</span>
                      <span className="text-center tabular-nums text-stone-800">{num(r.unidades)}</span>
                      <span className="text-center tabular-nums text-stone-800">{r.pedidos}</span>
                      <span className={`text-center tabular-nums ${r.porCobrar > 0 ? "text-rojo-700" : "text-stone-300"}`}>{r.porCobrar > 0 ? formatoPesos(r.porCobrar) : "—"}</span>
                      <span className={`text-center text-[12px] font-semibold ${dv === null ? "text-stone-300" : dv >= 0 ? "text-verde-700" : "text-rojo-700"}`}>{dv === null ? "—" : `${dv >= 0 ? "▲" : "▼"} ${Math.abs(dv)}%`}</span>
                      <span className="text-stone-300 transition group-hover:text-stone-700">›</span>
                    </Link>
                  );
                })}
                <div className={`${COLS} border-t border-stone-300 bg-stone-50 py-3`}>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-600">Total</span>
                  <span className="text-center tabular-nums text-stone-800">{formatoPesos(tot.neto)}</span><span className="text-center tabular-nums text-stone-800">{formatoPesos(tot.comision)}</span><span className="text-center tabular-nums text-stone-800">{num(tot.unidades)}</span><span className="text-center tabular-nums text-stone-800">{tot.pedidos}</span><span className="text-center tabular-nums text-stone-800">{formatoPesos(tot.porCobrar)}</span><span /><span />
                </div>
              </div>
            </div>
          </section>
        ) : (
          <p className="rounded-xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center text-stone-500">Todavía no hay vendedores. Con “+ Nuevo vendedor” cargás el primero.</p>
        )}

        {filas.length > 0 && tot.neto > 0 && (
          <section className="rounded-xl border border-stone-300 bg-white">
            <header className="flex items-baseline justify-between border-b border-stone-200 px-5 py-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-stone-600">Vendido por cada vendedor</h2>
              <span className="text-[12px] text-stone-400">{nombreMes(mes)} · sin IVA</span>
            </header>
            <ul className="divide-y divide-stone-100 text-[13px]">
              {[...filas].sort((a, b) => b.r.neto - a.r.neto).filter((f) => f.r.neto > 0).map((f) => (
                <li key={f.v.id} className="grid grid-cols-[minmax(110px,160px)_1fr_130px] items-center gap-x-5 px-5 py-2.5">
                  <span className="truncate font-semibold text-stone-900">{f.v.nombre}</span>
                  <div className="h-2 rounded-full bg-stone-100"><div className="h-2 rounded-full bg-verde-700" style={{ width: `${Math.max(2, (f.r.neto / maxNeto) * 100)}%` }} /></div>
                  <span className="text-right tabular-nums text-stone-800">{formatoPesos(f.r.neto)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-wrap items-center justify-end gap-6 border-t border-stone-200 pt-4"><CambiarClave /><BotonSalir /></div>
      </main>
    </>
  );
}
