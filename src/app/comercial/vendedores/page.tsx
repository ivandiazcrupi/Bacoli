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
          <section aria-label={`Resumen de ${nombreMes(mes)}`} className="grid grid-cols-2 divide-x divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-300 bg-white lg:grid-cols-5 lg:divide-y-0">
            {[
              { t: "Vendieron", v: formatoPesos(tot.neto), d: variacion === null ? "mes anterior sin ventas" : `${variacion >= 0 ? "▲" : "▼"} ${Math.abs(variacion)}% vs mes anterior`, c: variacion === null ? "" : variacion >= 0 ? "text-verde-700" : "text-rojo-700", g: true },
              { t: "Comisiones", v: formatoPesos(tot.comision), d: "a pagar este mes", c: "", g: true },
              { t: "Unidades", v: num(tot.unidades), d: "entregadas", c: "", g: false },
              { t: "Pedidos", v: String(tot.pedidos), d: "de sus clientes", c: "", g: false },
              { t: "Por cobrar", v: formatoPesos(tot.porCobrar), d: "entregado y sin pagar", c: "", g: false },
            ].map((x) => (
              <div key={x.t} className="px-4 py-4 text-center">
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">{x.t}</div>
                <div className={`mt-1 font-bold tabular-nums ${x.g ? "text-3xl" : "text-2xl"} ${x.t === "Por cobrar" && tot.porCobrar > 0 ? "text-rojo-700" : "text-stone-900"}`}>{x.v}</div>
                <div className={`mt-0.5 text-[12px] ${x.c || "text-stone-500"} ${x.c ? "font-semibold" : ""}`}>{x.d}</div>
              </div>
            ))}
          </section>
        )}

        <div className="grid items-start gap-4 lg:grid-cols-3">
          <section className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
            {filas.map(({ v, pct, r, antes }) => {
              const dv = antes.neto > 0 ? Math.round(((r.neto - antes.neto) / antes.neto) * 100) : null;
              return (
                <Link key={v.id} href={`/comercial/vendedores/${v.id}?mes=${mes}`}
                  className={`group block rounded-xl border border-stone-300 bg-white p-5 transition hover:border-stone-600 ${v.activo ? "" : "opacity-55"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xl font-semibold leading-tight">{v.nombre}{!v.activo && <span className="ml-2 rounded-full bg-stone-200 px-2.5 py-0.5 align-middle text-xs font-medium text-stone-600">de baja</span>}</p>
                      <p className="mt-0.5 text-sm text-stone-500">{v._count.clientes} {v._count.clientes === 1 ? "cliente" : "clientes"}{pct ? ` · ${String(pct).replace(".", ",")}%` : " · sin % cargado"}</p>
                    </div>
                    <span className="text-stone-300 transition group-hover:text-stone-700">›</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div><p className="text-[11px] font-bold uppercase tracking-wide text-stone-500">Vendió</p><p className="text-2xl font-bold tabular-nums">{formatoPesos(r.neto)}</p></div>
                    <div><p className="text-[11px] font-bold uppercase tracking-wide text-stone-500">Comisión</p><p className="text-2xl font-bold tabular-nums">{formatoPesos(r.comision)}</p></div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-stone-100"><div className="h-2 rounded-full bg-verde-700" style={{ width: `${r.neto > 0 ? Math.max(3, (r.neto / maxNeto) * 100) : 0}%` }} /></div>
                  <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-stone-500">
                    <span><b className="text-stone-700">{num(r.unidades)}</b> unidades</span>
                    <span><b className="text-stone-700">{r.pedidos}</b> {r.pedidos === 1 ? "pedido" : "pedidos"}</span>
                    {r.porCobrar > 0 && <span className="font-semibold text-rojo-700">por cobrar {formatoPesos(r.porCobrar)}</span>}
                    {dv !== null && <span className={`ml-auto font-semibold ${dv >= 0 ? "text-verde-700" : "text-rojo-700"}`}>{dv >= 0 ? "▲" : "▼"} {Math.abs(dv)}%</span>}
                  </p>
                </Link>
              );
            })}
            {filas.length === 0 && <p className="rounded-xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center text-stone-500 sm:col-span-2">Todavía no hay vendedores. Con “+ Nuevo vendedor” cargás el primero.</p>}
          </section>

          {filas.length > 0 && (
            <Panel titulo="Vendido por vendedor" nota={nombreMes(mes)}>
              {tot.neto > 0
                ? <BarrasH filas={[...filas].sort((a, b) => b.r.neto - a.r.neto).filter((f) => f.r.neto > 0).map((f) => ({ nombre: f.v.nombre, valor: f.r.neto, extra: `${num(f.r.unidades)} un.` }))} formato={(n) => formatoPesos(Math.round(n))} />
                : <p className="py-10 text-center text-sm text-stone-400">Todavía no hay ventas entregadas este mes.</p>}
            </Panel>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-6 border-t border-stone-200 pt-4"><CambiarClave /><BotonSalir /></div>
      </main>
    </>
  );
}
