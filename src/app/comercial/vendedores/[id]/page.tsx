import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { esFechaValida, hoy } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";
import { etiquetaMes, mesAnterior, mesSiguiente, nombreMes, ventasEntregadas } from "@/lib/vendedores";
import { Barras, BarrasH, Panel, SinDatos } from "../../graficos/Graficos";
import { CONTENEDOR_PEDIDOS } from "../../../pedidos/Encabezado";
import { EncabezadoComercial } from "../../EncabezadoComercial";
import { FormComision } from "../Formularios";

const fechaCorta = (d: Date) => d.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "2-digit" });
const paq = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 1 });
const nav = "flex h-9 items-center rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold hover:border-stone-600";

// Un vendedor: su %, cuánto vendió el mes, a qué clientes, evolución y sus clientes con el historial de cambios.
export default async function FichaVendedor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mes?: string }> }) {
  const usuario = await exigirOficina();
  if (usuario.rol !== "DUENO") redirect("/comercial");
  const { id } = await params;
  const { mes: mesParam } = await searchParams;
  const actual = hoy().slice(0, 7);
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) && esFechaValida(`${mesParam}-01`) ? mesParam : actual;
  const vendedor = await db.usuario.findUnique({ where: { id }, select: { id: true, nombre: true, rol: true, activo: true, comisionPct: true } });
  if (!vendedor || vendedor.rol !== "VENDEDOR") notFound();
  const pct = Number(vendedor.comisionPct ?? 0);

  const meses6 = Array.from({ length: 6 }, (_, i) => { let m = mes; for (let k = 0; k < 5 - i; k++) m = mesAnterior(m); return m; });
  const [todas, clientes, cambios] = await Promise.all([
    ventasEntregadas(`${meses6[0]}-01`, `${mesSiguiente(mes)}-01`),
    db.cliente.findMany({ where: { vendedorId: id }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, activo: true } }),
    db.asignacionVendedor.findMany({ where: { OR: [{ vendedorId: id }, { anteriorId: id }], estado: "APROBADA" }, orderBy: { resueltoEn: "desc" }, take: 30, include: { cliente: { select: { nombre: true } } } }),
  ]);
  const mias = todas.filter((x) => x.vendedorId === id);
  const delMes = mias.filter((x) => x.f.slice(0, 7) === mes);
  const neto = delMes.reduce((t, x) => t + x.neto, 0), comision = (neto * pct) / 100;
  const antNeto = mias.filter((x) => x.f.slice(0, 7) === mesAnterior(mes)).reduce((t, x) => t + x.neto, 0);
  const vs = antNeto > 0 ? Math.round(((neto - antNeto) / antNeto) * 100) : null;

  const porCliente = new Map<string, { nombre: string; pedidos: number; paq: number; neto: number }>();
  for (const x of delMes) {
    const c = porCliente.get(x.clienteId) ?? { nombre: x.cliente, pedidos: 0, paq: 0, neto: 0 };
    c.pedidos += 1; c.paq += x.paq; c.neto += x.neto; porCliente.set(x.clienteId, c);
  }
  const filas = [...porCliente.entries()].map(([cid, c]) => ({ cid, ...c, comision: (c.neto * pct) / 100 })).sort((a, b) => b.neto - a.neto);
  const evo = meses6.map((m) => ({ m, neto: mias.filter((x) => x.f.slice(0, 7) === m).reduce((t, x) => t + x.neto, 0) }));
  const nombresUsuarios = new Map((await db.usuario.findMany({ select: { id: true, nombre: true } })).map((u) => [u.id, u.nombre]));
  const sinVentas = clientes.filter((c) => c.activo && !porCliente.has(c.id));

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={`${CONTENEDOR_PEDIDOS} space-y-4`}>
        <EncabezadoComercial
          activa="vendedores" esDueno
          derecha={
            <nav className="flex items-center gap-2" aria-label="Mes">
              <Link href={`/comercial/vendedores/${id}?mes=${mesAnterior(mes)}`} className={nav} aria-label="Mes anterior">←</Link>
              <span className="min-w-44 rounded-md border border-stone-800 bg-stone-800 px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-white">{nombreMes(mes)}</span>
              <Link href={`/comercial/vendedores/${id}?mes=${mesSiguiente(mes)}`} className={nav} aria-label="Mes siguiente">→</Link>
              {mes !== actual && <Link href={`/comercial/vendedores/${id}`} className={nav}>Este mes</Link>}
            </nav>
          }
        />

        <section className="rounded-lg border border-stone-300 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href={`/comercial/vendedores?mes=${mes}`} className="text-sm font-semibold text-stone-500 hover:underline">‹ Vendedores</Link>
              <h1 className="text-2xl font-semibold tracking-tight">{vendedor.nombre}</h1>
              {!vendedor.activo && <span className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-600">desactivado</span>}
            </div>
            <div className="flex items-center gap-2 text-sm text-stone-600">Comisión: <FormComision vendedorId={id} pct={pct ? String(pct).replace(".", ",") : ""} /></div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-stone-200 pt-4 md:grid-cols-5">
            {[
              ["Vendió (sin IVA)", formatoPesos(neto), vs === null ? "mes anterior sin datos" : `${vs >= 0 ? "▲" : "▼"} ${Math.abs(vs)}% vs mes anterior`],
              ["Comisión a pagar", formatoPesos(comision), `${String(pct).replace(".", ",")}% de lo vendido`],
              ["Pedidos entregados", String(delMes.length), "en el mes"],
              ["Clientes que compraron", String(filas.length), `de ${clientes.filter((c) => c.activo).length} activos`],
              ["Paquetes", paq(delMes.reduce((t, x) => t + x.paq, 0)), "en el mes"],
            ].map(([t, v, d]) => (
              <div key={t}><dt className="text-xs text-stone-500">{t}</dt><dd className="text-xl font-bold tabular-nums">{v}</dd><div className="text-[12px] text-stone-500">{d}</div></div>
            ))}
          </dl>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel titulo="Ventas por cliente" nota={`${nombreMes(mes)} · sin IVA`}>
            {filas.length === 0 ? <SinDatos /> : <BarrasH filas={filas.slice(0, 10).map((f) => ({ nombre: f.nombre, valor: f.neto, extra: `${f.pedidos} ped.` }))} formato={formatoPesos} />}
          </Panel>
          <Panel titulo="Ventas de los últimos 6 meses" nota="sin IVA">
            <Barras etiquetas={evo.map((e) => etiquetaMes(e.m))} series={[{ nombre: "Ventas", color: "#026433", valores: evo.map((e) => Math.round(e.neto)) }]} formato={(n) => formatoPesos(n)} alto={190} resaltar={5} />
          </Panel>
        </div>

        <section className="overflow-hidden rounded-lg border border-stone-300 bg-white">
          <h2 className="border-b border-stone-200 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-stone-600">Detalle por cliente · {nombreMes(mes)}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-center text-[13.5px]">
              <thead className="bg-stone-100 text-[11px] uppercase tracking-wide text-stone-600"><tr><th className="px-3 py-2 text-left font-semibold">Cliente</th><th className="px-3 py-2 font-semibold">Pedidos</th><th className="px-3 py-2 font-semibold">Paquetes</th><th className="px-3 py-2 font-semibold">Vendió (sin IVA)</th><th className="px-3 py-2 font-semibold">Comisión</th></tr></thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.cid} className="h-11 border-t border-stone-200">
                    <td className="px-3 text-left font-semibold"><Link href={`/clientes/${f.cid}/pedidos`} className="hover:underline">{f.nombre}</Link></td>
                    <td className="px-3 tabular-nums">{f.pedidos}</td><td className="px-3 tabular-nums">{paq(f.paq)}</td>
                    <td className="px-3 font-semibold tabular-nums">{formatoPesos(f.neto)}</td><td className="px-3 tabular-nums">{formatoPesos(f.comision)}</td>
                  </tr>
                ))}
                {filas.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-stone-500">Sin ventas entregadas en este mes.</td></tr>}
              </tbody>
              {filas.length > 0 && <tfoot><tr className="h-11 border-t-2 border-stone-300 bg-stone-50 font-bold"><td className="px-3 text-left">Total</td><td className="tabular-nums">{delMes.length}</td><td className="tabular-nums">{paq(delMes.reduce((t, x) => t + x.paq, 0))}</td><td className="tabular-nums">{formatoPesos(neto)}</td><td className="tabular-nums">{formatoPesos(comision)}</td></tr></tfoot>}
            </table>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-stone-300 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Sus clientes · {clientes.length}</h2>
            {sinVentas.length > 0 && <p className="mt-1 text-[12.5px] text-stone-500">{sinVentas.length} sin compras entregadas este mes.</p>}
            <ul className="mt-2 divide-y divide-stone-200 text-[13.5px]">
              {clientes.map((c) => <li key={c.id} className="flex items-center justify-between py-1.5"><Link href={`/clientes/${c.id}`} className={`hover:underline ${c.activo ? "" : "text-stone-400"}`}>{c.nombre}</Link>{!c.activo && <span className="text-[11px] text-stone-400">desactivado</span>}</li>)}
              {clientes.length === 0 && <li className="py-2 text-stone-500">Todavía no tiene clientes asignados.</li>}
            </ul>
          </section>
          <section className="rounded-lg border border-stone-300 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Historial de cambios</h2>
            <ul className="mt-2 divide-y divide-stone-200 text-[13px]">
              {cambios.map((c) => (
                <li key={c.id} className="py-2">
                  <b>{c.cliente.nombre}</b>: {c.vendedorId === id ? <span className="text-verde-700">pasó a este vendedor</span> : <span className="text-rojo-700">dejó de ser de este vendedor</span>}
                  <div className="text-[12px] text-stone-500">vale desde {c.desde ? `${c.desde.slice(8)}/${c.desde.slice(5, 7)}/${c.desde.slice(2, 4)}` : fechaCorta(c.resueltoEn!)} · propuso {nombresUsuarios.get(c.propuestoPor) ?? "—"} · aprobó {c.resueltoPor ? nombresUsuarios.get(c.resueltoPor) ?? "—" : "—"}</div>
                </li>
              ))}
              {cambios.length === 0 && <li className="py-2 text-stone-500">Sin cambios registrados.</li>}
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}
