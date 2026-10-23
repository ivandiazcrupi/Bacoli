import { EncabezadoComercial } from "../EncabezadoComercial";
import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { importeVigente } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { esFechaValida, hoy, nombreDia, sumarDias } from "@/lib/fechas";
import { bultosDe, focacciasPorTipo, totalUnidades, unidadesPorSabor } from "@/lib/ruta";
import { exigirOficina } from "@/lib/session";
import { vendedoresDesbloqueado } from "@/lib/claveVendedores";
import { ventasEntregadas } from "@/lib/vendedores";
import { CONTENEDOR_PEDIDOS } from "../../pedidos/Encabezado";
import { PantallaBloqueada } from "../vendedores/Bloqueo";
import { Barras, BarrasH, Donut, Leyenda, PALETA, Panel, SinDatos } from "./Graficos";
import { TopClientes } from "./TopClientes";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreMes = (m: string) => `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const mesDe = (f: string) => f.slice(0, 7);
const mesSiguiente = (m: string) => sumarDias(`${m}-01`, 32).slice(0, 7);
const mesAnterior = (m: string) => sumarDias(`${m}-01`, -1).slice(0, 7);
const fechaAR = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
const pesos = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const paq = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 1 });
const corto = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M` : n >= 1000 ? `${Math.round(n / 1000)} mil` : String(Math.round(n)));

// ESTADÍSTICAS: tablero general del mes (como una cabina). Solo cuenta lo ENTREGADO (lo realmente vendido); no cambia nada.
export default async function Graficos({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const usuario = await exigirOficina();
  const desbloqueado = await vendedoresDesbloqueado();
  if (!desbloqueado) return <PantallaBloqueada usuario={usuario} activa="estadisticas" titulo="Estadísticas" volver="/comercial/estadisticas" />;
  const { mes: mesParam } = await searchParams;
  const actual = hoy().slice(0, 7);
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) && esFechaValida(`${mesParam}-01`) ? mesParam : actual;
  const meses6 = Array.from({ length: 6 }, (_, i) => { let m = mes; for (let k = 0; k < 5 - i; k++) m = mesAnterior(m); return m; });
  const desde = new Date(`${meses6[0]}-01T00:00:00Z`);

  const pedidos = await db.pedido.findMany({
    where: { estado: "ENTREGADO", origen: { in: ["MAYORISTA", "WEB"] }, OR: [{ creadoEn: { gte: desde } }, { fechaEntrega: { gte: desde } }] },
    include: { items: true, cliente: { select: { id: true, nombre: true } }, punto: { select: { zona: { select: { nombre: true } } } } },
  });

  // Cada pedido entregado cuenta en el mes de su día de entrega.
  type P = { f: string; web: boolean; clienteId: string | null; cliente: string; zona: string; tipo: string; paq: number; neto: number; entregado: boolean; sabores: ReturnType<typeof unidadesPorSabor>; foc: number; focOliva: number; focCherry: number };
  const filas: P[] = pedidos.map((p) => {
    const web = p.origen === "WEB";
    // Facturación = el importe FINAL del pedido tal cual quedó (con IVA en los de factura, sin IVA en los de remito; la tienda, lo que pagó).
    const neto = importeVigente(p.items, Number(p.ivaPct), p.estado === "ENTREGADO" ? "ENTREGADO" : "PENDIENTE", p.webTotal);
    return {
      f: p.fechaEntrega ? p.fechaEntrega.toISOString().slice(0, 10) : fechaAR(p.creadoEn), web, clienteId: p.clienteId, cliente: p.cliente?.nombre ?? "", zona: p.punto?.zona.nombre ?? "",
      tipo: web ? "Tienda online" : p.conFactura ? "Con factura" : "Con remito", paq: bultosDe(p.items), neto, entregado: p.estado === "ENTREGADO",
      sabores: unidadesPorSabor(p.items), foc: focacciasPorTipo(p.items).oliva + focacciasPorTipo(p.items).cherry, focOliva: focacciasPorTipo(p.items).oliva, focCherry: focacciasPorTipo(p.items).cherry,
    };
  });
  const delMes = filas.filter((p) => mesDe(p.f) === mes);
  const mayoristas = delMes.filter((p) => !p.web);

  // Resumen (instrumentos de arriba)
  const total = { pedidos: delMes.length, paq: delMes.reduce((t, p) => t + p.paq, 0), neto: delMes.reduce((t, p) => t + p.neto, 0) };
  const ant = filas.filter((p) => mesDe(p.f) === mesAnterior(mes));
  const antPaq = ant.reduce((t, p) => t + p.paq, 0), antNeto = ant.reduce((t, p) => t + p.neto, 0);
  // Unidades vendidas = pizzas que fabricamos (prepizzas ×2 por paquete, pizzas por unidad) + focaccias; los productos de la tienda que no fabricamos no cuentan.
  const unidadesDe = (x: P) => totalUnidades(x.sabores) + x.foc;
  const unidades = delMes.reduce((t, p) => t + unidadesDe(p), 0), antUnidades = ant.reduce((t, p) => t + unidadesDe(p), 0);
  const clientesQuePidieron = new Set(mayoristas.map((p) => p.clienteId)).size;

  // Pedidos por día
  const diasDelMes = Number(sumarDias(`${mesSiguiente(mes)}-01`, -1).slice(8));
  const porDia = Array.from({ length: diasDelMes }, (_, i) => { const f = `${mes}-${String(i + 1).padStart(2, "0")}`; const d = delMes.filter((p) => p.f === f); return { may: d.filter((p) => !p.web).length, web: d.filter((p) => p.web).length }; });
  const diaTop = porDia.reduce((m, d, i) => (d.may + d.web > porDia[m].may + porDia[m].web ? i : m), 0);

  // Resumen diario: todos los días del mes; los domingos no se vende (quedan anulados).
  const resumenDia = Array.from({ length: diasDelMes }, (_, i) => {
    const f = `${mes}-${String(i + 1).padStart(2, "0")}`;
    const d = delMes.filter((p) => p.f === f);
    const suma = (fn: (p: P) => number) => d.reduce((t, p) => t + fn(p), 0);
    return { f, dia: i + 1, nombre: nombreDia(f), domingo: nombreDia(f) === "Domingo", pedidos: d.length, paq: suma((p) => p.paq), uni: suma(unidadesDe), tomate: suma((p) => p.sabores.tomate), cebolla: suma((p) => p.sabores.cebolla), pizzas: suma((p) => p.sabores.pizzas), foc: suma((p) => p.foc), neto: suma((p) => p.neto) };
  });
  // En el lugar de cada domingo (no se reparte) va el mini resumen de la semana que termina (los días de arriba); si el mes termina a mitad de semana, uno al final.
  type Dia = (typeof resumenDia)[number];
  const CERO = { pedidos: 0, paq: 0, uni: 0, tomate: 0, cebolla: 0, pizzas: 0, foc: 0, neto: 0 };
  const sumar = (a: typeof CERO, x: Dia) => ({ pedidos: a.pedidos + x.pedidos, paq: a.paq + x.paq, uni: a.uni + x.uni, tomate: a.tomate + x.tomate, cebolla: a.cebolla + x.cebolla, pizzas: a.pizzas + x.pizzas, foc: a.foc + x.foc, neto: a.neto + x.neto });
  type FilaDia = { tipo: "dia"; x: Dia } | { tipo: "semana"; desde: number; hasta: number; t: typeof CERO };
  const filasDia: FilaDia[] = [];
  { let acc = CERO, desde = 0, hasta = 0;
    for (const x of resumenDia) {
      if (desde === 0 && !x.domingo) desde = x.dia;
      acc = sumar(acc, x);
      if (x.domingo) { if (desde > 0) filasDia.push({ tipo: "semana", desde, hasta, t: acc }); acc = CERO; desde = 0; continue; }
      hasta = x.dia;
      filasDia.push({ tipo: "dia", x });
    }
    if (desde > 0) filasDia.push({ tipo: "semana", desde, hasta, t: acc }); }
  const totalDia = resumenDia.reduce((t, x) => ({ pedidos: t.pedidos + x.pedidos, paq: t.paq + x.paq, uni: t.uni + x.uni, tomate: t.tomate + x.tomate, cebolla: t.cebolla + x.cebolla, pizzas: t.pizzas + x.pizzas, foc: t.foc + x.foc, neto: t.neto + x.neto }), { pedidos: 0, paq: 0, uni: 0, tomate: 0, cebolla: 0, pizzas: 0, foc: 0, neto: 0 });
  const COLS_DIA = "grid-cols-[minmax(0,1.3fr)_repeat(7,minmax(0,1fr))_minmax(0,1.4fr)]";

  // Zonas y tipo de comprobante
  const cuenta = (xs: string[]) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].map(([nombre, valor]) => ({ nombre, valor })).sort((a, b) => b.valor - a.valor);
  const porZona = cuenta(mayoristas.map((p) => p.zona || "Sin zona"));
  const porTipo = cuenta(delMes.map((p) => p.tipo));

  // Clientes (cada cliente junto, sumando todas sus sucursales)
  const porCliente = new Map<string, { nombre: string; paquetes: number; neto: number; pedidos: number }>();
  for (const p of mayoristas) {
    const c = porCliente.get(p.clienteId ?? "") ?? { nombre: p.cliente, paquetes: 0, neto: 0, pedidos: 0 };
    c.paquetes += p.paq; c.neto += p.neto; c.pedidos += 1;
    porCliente.set(p.clienteId ?? "", c);
  }

  // Comisiones por vendedor (los de Comercial → Vendedores): ventas sin IVA de pedidos ENTREGADOS del mes × el % de cada vendedor.
  // Cada venta cuenta para el vendedor que tenía el cliente ese día (ver src/lib/vendedores.ts).
  const verComisiones = desbloqueado; // las comisiones se ven solo con la contraseña del apartado Vendedores
  const [listaVendedores, ventasMes] = verComisiones ? await Promise.all([
    db.vendedor.findMany({ where: { comisionPct: { not: null } }, select: { id: true, nombre: true, comisionPct: true } }),
    ventasEntregadas(`${mes}-01`, `${mesSiguiente(mes)}-01`),
  ]) : [[], []];
  const comisiones = listaVendedores.map((v) => {
    const mias = ventasMes.filter((x) => x.vendedorId === v.id);
    const pct = Number(v.comisionPct ?? 0), ventas = mias.reduce((t, x) => t + x.neto, 0);
    return { nombre: v.nombre, pct, clientes: new Set(mias.map((x) => x.clienteId)), ventas, comision: (ventas * pct) / 100 };
  }).filter((c) => c.ventas > 0).sort((x, y) => y.comision - x.comision);
  const totalComision = comisiones.reduce((t, c) => t + c.comision, 0);

  // Evolución de 6 meses
  const evo = meses6.map((m) => { const d = filas.filter((p) => mesDe(p.f) === m); return { m, paq: d.reduce((t, p) => t + p.paq, 0), neto: d.reduce((t, p) => t + p.neto, 0) }; });
  const etiqMes = (m: string) => MESES[Number(m.slice(5)) - 1].slice(0, 3);

  // Mix de productos (en pizzas) del mes
  const mix = [
    { nombre: "Prepizza tomate", valor: delMes.reduce((t, p) => t + p.sabores.tomate, 0) },
    { nombre: "Prepizza cebolla", valor: delMes.reduce((t, p) => t + p.sabores.cebolla, 0) },
    { nombre: "Pizzas por unidad", valor: delMes.reduce((t, p) => t + p.sabores.pizzas, 0) },
    { nombre: "Focaccia oliva", valor: delMes.reduce((t, p) => t + p.focOliva, 0) },
    { nombre: "Focaccia cherry", valor: delMes.reduce((t, p) => t + p.focCherry, 0) },
  ].filter((x) => x.valor > 0);

  const variacion = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);
  const vUni = variacion(unidades, antUnidades), vPaq = variacion(total.paq, antPaq), vNeto = variacion(total.neto, antNeto);
  const nav = "flex h-9 items-center rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold hover:border-stone-600";

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoComercial
          activa="estadisticas"
          derecha={
            <nav className="flex items-center gap-2" aria-label="Mes">
              <Link href={`/comercial/estadisticas?mes=${mesAnterior(mes)}`} className={nav} aria-label="Mes anterior">←</Link>
              <span className="min-w-44 rounded-md border border-stone-800 bg-stone-800 px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-white">{nombreMes(mes)}</span>
              <Link href={`/comercial/estadisticas?mes=${mesSiguiente(mes)}`} className={nav} aria-label="Mes siguiente">→</Link>
              {mes !== actual && <Link href="/comercial/estadisticas" className={nav}>Este mes</Link>}
            </nav>
          }
        />

        {/* Instrumentos: lo principal del mes de un vistazo */}
        <section aria-label="Resumen del mes" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-stone-700 bg-stone-700 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { t: "Pedidos", v: String(total.pedidos), d: "entregados en el mes" },
            { t: "Paquetes", v: paq(total.paq), d: vPaq === null ? "mes anterior sin datos" : `${vPaq >= 0 ? "▲" : "▼"} ${Math.abs(vPaq)}% vs mes anterior`, c: vPaq === null ? "" : vPaq >= 0 ? "text-emerald-400" : "text-red-400" },
            { t: "Unidades vendidas", v: unidades.toLocaleString("es-AR"), d: vUni === null ? "pizzas + focaccias" : `${vUni >= 0 ? "▲" : "▼"} ${Math.abs(vUni)}% vs mes anterior`, c: vUni === null ? "" : vUni >= 0 ? "text-emerald-400" : "text-red-400" },
            { t: "Facturación", v: pesos(total.neto), d: vNeto === null ? "mes anterior sin datos" : `${vNeto >= 0 ? "▲" : "▼"} ${Math.abs(vNeto)}% vs mes anterior`, c: vNeto === null ? "" : vNeto >= 0 ? "text-emerald-400" : "text-red-400" },
            { t: "Clientes que pidieron", v: String(clientesQuePidieron), d: "mayoristas, sumando sucursales" },
            { t: "Ticket promedio", v: mayoristas.length ? pesos(mayoristas.reduce((t, p) => t + p.neto, 0) / mayoristas.length) : "—", d: "por pedido mayorista" },
          ].map((x) => (
            <div key={x.t} className="bg-stone-900 px-4 py-4 text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">{x.t}</p>
              <p className="mt-1 truncate text-[26px] font-extrabold leading-tight tabular-nums text-white">{x.v}</p>
              <p className={`mt-0.5 text-[12px] ${x.c || "text-stone-400"}`}>{x.d}</p>
            </div>
          ))}
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <Panel titulo="Pedidos por día" nota={total.pedidos ? `el día más cargado: ${diaTop + 1}` : undefined} className="lg:col-span-2">
            {total.pedidos === 0 ? <SinDatos /> : <Barras etiquetas={porDia.map((_, i) => String(i + 1))} resaltar={diaTop} series={[{ nombre: "Mayoristas", color: PALETA[0], valores: porDia.map((d) => d.may) }, { nombre: "Tienda online", color: PALETA[1], valores: porDia.map((d) => d.web) }]} />}
          </Panel>
          <Panel titulo="Pedidos por zona" nota="mayoristas"><Donut partes={porZona} /></Panel>

          <Panel titulo="Resumen por día" nota="solo pedidos entregados · en el lugar del domingo, el resumen de la semana" className="lg:col-span-3">
            {total.pedidos === 0 ? <SinDatos /> : (
              <div className="overflow-x-auto">
                <div className="min-w-[760px] overflow-hidden rounded-md border border-stone-200">
                  <div className={`grid ${COLS_DIA} gap-x-3 bg-crema-100 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-stone-500`}>
                    <span className="text-left">Día</span><span>Pedidos</span><span>Paquetes</span><span>Unidades</span><span>Tomate</span><span>Cebolla</span><span>Pizzas</span><span>Focaccias</span><span>Facturación</span>
                  </div>
                  {filasDia.map((fila) => {
                    if (fila.tipo === "semana") {
                      const t = fila.t, vacio = t.pedidos === 0;
                      const n = (v: number) => (vacio || v === 0 ? <span className="text-stone-300">—</span> : v.toLocaleString("es-AR", { maximumFractionDigits: 1 }));
                      return (
                        <div key={`sem-${fila.desde}`} className={`grid ${COLS_DIA} items-center gap-x-3 border-t border-stone-200 bg-stone-100/70 px-3 py-1.5 text-center text-[12.5px] font-medium tabular-nums text-stone-500`}>
                          <span className="text-left">Semana {fila.desde} al {fila.hasta}</span>
                          <span>{n(t.pedidos)}</span><span>{n(t.paq)}</span><span>{n(t.uni)}</span><span>{n(t.tomate)}</span><span>{n(t.cebolla)}</span><span>{n(t.pizzas)}</span><span>{n(t.foc)}</span>
                          <span>{vacio ? <span className="text-stone-300">—</span> : pesos(t.neto)}</span>
                        </div>
                      );
                    }
                    const x = fila.x;
                    const vacio = x.pedidos === 0;
                    const num = (n: number) => (vacio || n === 0 ? <span className="text-stone-300">—</span> : n.toLocaleString("es-AR", { maximumFractionDigits: 1 }));
                    return (
                      <div key={x.f} className={`grid ${COLS_DIA} items-center gap-x-3 border-t border-stone-200 px-3 py-2 text-center text-[13.5px] tabular-nums ${x.f === hoy() ? "bg-crema-50" : ""}`}>
                        <span className="text-left font-semibold text-stone-800">{x.nombre.slice(0, 3)} {x.dia}</span>
                        <span>{num(x.pedidos)}</span><span>{num(x.paq)}</span><span>{num(x.uni)}</span><span>{num(x.tomate)}</span><span>{num(x.cebolla)}</span><span>{num(x.pizzas)}</span><span>{num(x.foc)}</span>
                        <span className="font-bold text-stone-900">{vacio ? <span className="text-stone-300">—</span> : pesos(x.neto)}</span>
                      </div>
                    );
                  })}
                  <div className={`grid ${COLS_DIA} gap-x-3 border-t-2 border-stone-300 bg-crema-50 px-3 py-2.5 text-center text-[13.5px] font-bold tabular-nums`}>
                    <span className="text-left">Total del mes</span>
                    <span>{totalDia.pedidos}</span><span>{paq(totalDia.paq)}</span><span>{totalDia.uni.toLocaleString("es-AR")}</span><span>{totalDia.tomate.toLocaleString("es-AR")}</span><span>{totalDia.cebolla.toLocaleString("es-AR")}</span><span>{totalDia.pizzas.toLocaleString("es-AR")}</span><span>{totalDia.foc.toLocaleString("es-AR")}</span><span>{pesos(totalDia.neto)}</span>
                  </div>
                </div>
              </div>
            )}
          </Panel>

          <Panel titulo="Clientes que más piden" nota="cada cliente, todas sus sucursales juntas" className="lg:col-span-2"><TopClientes filas={[...porCliente.values()]} /></Panel>
          <Panel titulo="Tipo de comprobante"><Donut partes={porTipo} /></Panel>

          <Panel titulo="Comisiones de vendedores" nota={`facturación sin IVA de pedidos entregados · ${nombreMes(mes)}`} className="lg:col-span-2">
            {!verComisiones ? <SinDatos texto="Las comisiones se ven entrando a Comercial → Vendedores con su contraseña." /> : comisiones.length === 0 ? <SinDatos texto="Ningún pedido entregado este mes de un cliente con vendedor y % de comisión (se cargan en Comercial → Vendedores)." /> : (
              <div className="overflow-hidden rounded-md border border-stone-200">
                <div className="grid grid-cols-[minmax(0,1.4fr)_70px_80px_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 bg-crema-100 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                  <span className="text-left">Vendedor</span><span>%</span><span>Clientes</span><span>Ventas sin IVA</span><span>Comisión</span>
                </div>
                {comisiones.map((c) => (
                  <div key={c.nombre} className="grid grid-cols-[minmax(0,1.4fr)_70px_80px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 border-t border-stone-200 px-3 py-2.5 text-center text-[13.5px]">
                    <span className="truncate text-left font-bold text-stone-800">{c.nombre}</span>
                    <span className="tabular-nums text-stone-600">{c.pct.toLocaleString("es-AR")}%</span>
                    <span className="tabular-nums">{c.clientes.size}</span>
                    <span className="tabular-nums text-stone-700">{pesos(c.ventas)}</span>
                    <span className="font-extrabold tabular-nums text-verde-700">{pesos(c.comision)}</span>
                  </div>
                ))}
                <div className="grid grid-cols-[minmax(0,1.4fr)_70px_80px_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 border-t-2 border-stone-300 bg-crema-50 px-3 py-2.5 text-center text-[13.5px] font-bold">
                  <span className="text-left">Total</span><span /><span /><span className="tabular-nums">{pesos(comisiones.reduce((t, c) => t + c.ventas, 0))}</span><span className="tabular-nums text-verde-700">{pesos(totalComision)}</span>
                </div>
              </div>
            )}
          </Panel>
          <Panel titulo="Qué se vende" nota="pizzas del mes">
            {mix.length === 0 ? <SinDatos /> : <><BarrasH filas={mix} formato={(n) => n.toLocaleString("es-AR")} color="#c08a1e" /><p className="mt-3 text-[12px] text-stone-500">Prepizzas y pizzas se cuentan en unidades de pizza; las focaccias, por unidad.</p></>}
          </Panel>

          <Panel titulo="Paquetes por mes" nota="últimos 6 meses"><Barras etiquetas={evo.map((e) => etiqMes(e.m))} resaltar={5} formato={paq} series={[{ nombre: "Paquetes", color: PALETA[0], valores: evo.map((e) => e.paq) }]} alto={170} ancho={340} /></Panel>
          <Panel titulo="Facturación por mes" nota="últimos 6 meses" className="lg:col-span-2"><Barras etiquetas={evo.map((e) => etiqMes(e.m))} resaltar={5} formato={corto} series={[{ nombre: "Facturación", color: PALETA[1], valores: evo.map((e) => e.neto) }]} alto={170} /></Panel>
        </div>
        <p className="text-[12px] text-stone-500">Solo se cuentan los pedidos entregados, en el mes de su día de entrega. Las comisiones se calculan con el porcentaje cargado en cada cliente.</p>
      </main>
    </>
  );
}
