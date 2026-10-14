import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { vendedoresDesbloqueado } from "@/lib/claveVendedores";
import { db } from "@/lib/db";
import { esFechaValida, hoy } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";
import { filasDelPeriodo, mesAnterior, mesSiguiente, nombreMes, resumenDe } from "@/lib/vendedores";
import { num } from "@/lib/ruta";
import { BarrasH, Panel } from "../estadisticas/Graficos";
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
              <Link href="/comercial/vendedores/nuevo" className="ml-2 flex h-10 items-center rounded-lg bg-stone-900 px-5 text-sm font-semibold text-white hover:bg-stone-700">+ Nuevo vendedor</Link>
            </>
          }
        />

        {[...grupos.values()].map((g) => <BotonImportar key={g.nombre} comisionista={g.nombre} clientes={g.clientes} pct={g.pct ? String(g.pct).replace(".", ",") : ""} />)}

        {filas.length > 0 && (
          <section aria-label={`Resumen de ${nombreMes(mes)}`} className="flex flex-wrap items-center gap-x-8 gap-y-1 rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-[13px] text-stone-500">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">{nombreMes(mes)}</span>
            {[
              ["Facturaron", formatoPesos(tot.neto)], ["Comisiones", formatoPesos(tot.comision)], ["Unidades", num(tot.unidades)], ["Pedidos", String(tot.pedidos)], ["Por cobrar", formatoPesos(tot.porCobrar)],
            ].map(([t, v]) => <span key={t}>{t} <b className="ml-1 text-[14px] tabular-nums text-stone-800">{v}</b></span>)}
            {variacion !== null && <span className={`ml-auto font-semibold ${variacion >= 0 ? "text-verde-700" : "text-rojo-700"}`}>{variacion >= 0 ? "▲" : "▼"} {Math.abs(variacion)}% vs mes anterior</span>}
          </section>
        )}

        {filas.length > 0 ? (
          <section className="overflow-hidden rounded-xl border border-stone-300 bg-white">
            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                <div className="grid grid-cols-[minmax(220px,1.6fr)_minmax(220px,1.4fr)_1fr_1fr_0.8fr_1fr_0.7fr_1.5rem] items-center gap-x-4 bg-stone-100 px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-stone-600">
                  <span>Vendedor</span><span className="text-center">Facturó</span><span className="text-center">Comisión</span><span className="text-center">Unidades</span><span className="text-center">Pedidos</span><span className="text-center">Por cobrar</span><span className="text-center">Vs mes ant.</span><span />
                </div>
                {filas.map(({ v, pct, r, antes }) => {
                  const dv = antes.neto > 0 ? Math.round(((r.neto - antes.neto) / antes.neto) * 100) : null;
                  return (
                    <Link key={v.id} href={`/comercial/vendedores/${v.id}?mes=${mes}`}
                      className={`group grid grid-cols-[minmax(220px,1.6fr)_minmax(220px,1.4fr)_1fr_1fr_0.8fr_1fr_0.7fr_1.5rem] items-center gap-x-4 border-t border-stone-200 px-5 py-3.5 transition hover:bg-stone-50 ${v.activo ? "" : "opacity-55"}`}>
                      <div className="min-w-0">
                        <p className="truncate text-[17px] font-semibold leading-tight">{v.nombre}{!v.activo && <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 align-middle text-[11px] font-medium text-stone-600">de baja</span>}</p>
                        <p className="mt-0.5 text-[12.5px] text-stone-500">{v._count.clientes} {v._count.clientes === 1 ? "cliente" : "clientes"}{pct ? ` · ${String(pct).replace(".", ",")}%` : " · sin % cargado"}</p>
                      </div>
                      <div className="px-2"><p className="text-center text-[18px] font-bold tabular-nums">{formatoPesos(r.neto)}</p><div className="mt-1.5 h-1.5 rounded-full bg-stone-100"><div className="h-1.5 rounded-full bg-verde-700" style={{ width: `${r.neto > 0 ? Math.max(3, (r.neto / maxNeto) * 100) : 0}%` }} /></div></div>
                      <p className="text-center text-[18px] font-bold tabular-nums">{formatoPesos(r.comision)}</p>
                      <p className="text-center text-[16px] font-semibold tabular-nums text-stone-700">{num(r.unidades)}</p>
                      <p className="text-center text-[15px] tabular-nums text-stone-600">{r.pedidos}</p>
                      <p className={`text-center text-[14px] font-semibold tabular-nums ${r.porCobrar > 0 ? "text-rojo-700" : "text-stone-300"}`}>{r.porCobrar > 0 ? formatoPesos(r.porCobrar) : "—"}</p>
                      <p className={`text-center text-[13px] font-semibold ${dv === null ? "text-stone-300" : dv >= 0 ? "text-verde-700" : "text-rojo-700"}`}>{dv === null ? "—" : `${dv >= 0 ? "▲" : "▼"} ${Math.abs(dv)}%`}</p>
                      <span className="text-stone-300 transition group-hover:text-stone-700">›</span>
                    </Link>
                  );
                })}
                <div className="grid grid-cols-[minmax(220px,1.6fr)_minmax(220px,1.4fr)_1fr_1fr_0.8fr_1fr_0.7fr_1.5rem] items-center gap-x-4 border-t-2 border-stone-300 bg-stone-50 px-5 py-2.5 text-[13px] font-bold">
                  <span className="text-[11px] uppercase tracking-wide text-stone-600">Total</span>
                  <span className="text-center tabular-nums">{formatoPesos(tot.neto)}</span><span className="text-center tabular-nums">{formatoPesos(tot.comision)}</span><span className="text-center tabular-nums">{num(tot.unidades)}</span><span className="text-center tabular-nums">{tot.pedidos}</span><span className="text-center tabular-nums">{formatoPesos(tot.porCobrar)}</span><span /><span />
                </div>
              </div>
            </div>
          </section>
        ) : (
          <p className="rounded-xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center text-stone-500">Todavía no hay vendedores. Con “+ Nuevo vendedor” cargás el primero.</p>
        )}

        {filas.length > 0 && (
          <Panel titulo="Vendido por cada vendedor" nota={`${nombreMes(mes)} · sin IVA`}>
            {tot.neto > 0
              ? <BarrasH filas={[...filas].sort((a, b) => b.r.neto - a.r.neto).filter((f) => f.r.neto > 0).map((f) => ({ nombre: f.v.nombre, valor: f.r.neto, extra: `${num(f.r.unidades)} un. · comisión ${formatoPesos(f.r.comision)}` }))} formato={(n) => formatoPesos(Math.round(n))} />
              : <p className="py-8 text-center text-sm text-stone-400">Todavía no hay ventas entregadas este mes.</p>}
          </Panel>
        )}

        <div className="flex flex-wrap items-center justify-end gap-6 border-t border-stone-200 pt-4"><CambiarClave /><BotonSalir /></div>
      </main>
    </>
  );
}
