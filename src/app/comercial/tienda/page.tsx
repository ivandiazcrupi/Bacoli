import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { vendedoresDesbloqueado } from "@/lib/claveVendedores";
import { db } from "@/lib/db";
import { esFechaValida, hoy, nombreDia, sumarDias } from "@/lib/fechas";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS } from "../../pedidos/Encabezado";
import { EncabezadoComercial } from "../EncabezadoComercial";
import { Panel, SinDatos } from "../estadisticas/Graficos";
import { PantallaBloqueada } from "../vendedores/Bloqueo";
import { PedidosDelDia, type FilaDia } from "./PedidosDelDia";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreMes = (m: string) => `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const mesSiguiente = (m: string) => sumarDias(`${m}-01`, 32).slice(0, 7);
const mesAnterior = (m: string) => sumarDias(`${m}-01`, -1).slice(0, 7);
const fechaAR = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
const inicioDia = (f: string) => new Date(`${f}T00:00:00-03:00`); // Argentina no cambia la hora: siempre -03:00
const pesos = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const fechaLarga = (f: string) => `${nombreDia(f)} ${Number(f.slice(8))} de ${MESES[Number(f.slice(5, 7)) - 1]}`;
const esFecha = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && esFechaValida(s);

type P = { f: string; en: Date; monto: number };
const suma = (l: P[]) => ({ pedidos: l.length, total: l.reduce((t, p) => t + p.monto, 0) });

// TIENDA ONLINE: cómo viene la venta minorista. Cada pedido cuenta el día en que se HIZO (no importa cuándo se entregue ni si ya pagó).
// La facturación es el total de todos los pedidos que entraron; los CANCELADOS no cuentan (si se cancela uno, se resta).
export default async function Tienda({ searchParams }: { searchParams: Promise<{ mes?: string; dia?: string; combos?: string; todos?: string; abrir?: string }> }) {
  const usuario = await exigirOficina();
  if (!(await vendedoresDesbloqueado())) return <PantallaBloqueada usuario={usuario} activa="tienda" titulo="Tienda online" volver="/comercial/tienda" />;

  const { mes: mesParam, dia: diaParam, combos: combosParam, todos: todosParam, abrir: abrirParam } = await searchParams;
  const desarmados = combosParam === "desarmados"; // cómo se cuentan los combos: "como se venden" (una línea por combo) o "desarmados" (lo que llevan adentro)
  const verTodos = todosParam === "1";
  const fechaHoy = hoy();
  const dia = esFecha(diaParam) && diaParam! <= fechaHoy ? diaParam! : fechaHoy; // se puede mirar cualquier día hasta hoy
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) && esFechaValida(`${mesParam}-01`) ? mesParam : dia.slice(0, 7);
  const esHoy = dia === fechaHoy;

  // Se trae el mes que se está mirando y, si el día elegido cae afuera de ese mes, también ese día.
  const iniMes = inicioDia(`${mes}-01`), finMes = inicioDia(`${mesSiguiente(mes)}-01`);
  const iniDia = inicioDia(dia), finDia = inicioDia(sumarDias(dia, 1));
  const filas = await db.pedido.findMany({
    where: { origen: "WEB", estado: { not: "CANCELADO" }, OR: [{ creadoEn: { gte: iniMes, lt: finMes } }, { creadoEn: { gte: iniDia, lt: finDia } }] },
    select: { creadoEn: true, webTotal: true },
  });
  // Pedidos del día elegido (como la lista de Empretienda): del más nuevo al más viejo, con los cancelados tachados.
  const delDiaFilas = await db.pedido.findMany({
    where: { origen: "WEB", creadoEn: { gte: iniDia, lt: finDia } },
    select: { id: true, webOrden: true, webNombre: true, webApellido: true, webEmail: true, webTelefono: true, creadoEn: true, webTotal: true, webPago: true, estado: true },
    orderBy: { creadoEn: "desc" },
  });
  const filasDia: FilaDia[] = delDiaFilas.map((p) => ({
    id: p.id, orden: p.webOrden ?? "—", nombre: [p.webNombre, p.webApellido].filter(Boolean).join(" ") || "Sin nombre",
    fechaHora: `${p.creadoEn.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "2-digit" })} ${p.creadoEn.toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "numeric", minute: "2-digit", hourCycle: "h23" })} hs`,
    monto: Number(p.webTotal ?? 0), cancelado: p.estado === "CANCELADO", entregado: p.estado === "ENTREGADO",
    pago: p.webPago === "SIN_COSTO" ? "sincargo" : p.webPago === "PAGO_MP" || p.webPago === "PAGO_TRANSFERENCIA" ? "pagado" : "pendiente",
    medio: p.webPago === "PAGO_MP" ? "Mercado Pago" : "Transferencia",
  }));
  // Mismo cliente en más de un pedido del día: mismo nombre (o uno contenido en el otro, con 2 palabras o más), mismo email o mismo teléfono. Los cancelados no cuentan.
  {
    const vivos = filasDia.map((f, i) => ({ f, i, p: delDiaFilas[i] })).filter((x) => !x.f.cancelado);
    const limpio = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
    const datos = vivos.map((x) => ({ pal: limpio(x.f.nombre), mail: (x.p.webEmail ?? "").trim().toLowerCase(), tel: (x.p.webTelefono ?? "").replace(/\D/g, "").slice(-8) }));
    const padre = vivos.map((_, k) => k);
    const raiz = (k: number): number => (padre[k] === k ? k : (padre[k] = raiz(padre[k])));
    const misma = (a: (typeof datos)[number], b: (typeof datos)[number]) => {
      if (a.mail && a.mail === b.mail) return true;
      if (a.tel.length === 8 && a.tel === b.tel) return true;
      const [c, l] = a.pal.length <= b.pal.length ? [a.pal, b.pal] : [b.pal, a.pal];
      return c.length >= 2 && c.every((w) => l.includes(w));
    };
    for (let a = 0; a < datos.length; a++) for (let b = a + 1; b < datos.length; b++) if (misma(datos[a], datos[b])) padre[raiz(b)] = raiz(a);
    const tam = new Map<number, number>();
    vivos.forEach((_, k) => tam.set(raiz(k), (tam.get(raiz(k)) ?? 0) + 1));
    const numero = new Map<number, number>();
    vivos.forEach((x, k) => {
      const r = raiz(k), n = tam.get(r) ?? 1;
      if (n < 2) return;
      if (!numero.has(r)) numero.set(r, numero.size);
      filasDia[x.i].grupo = numero.get(r)!; filasDia[x.i].veces = n;
    });
  }
  const todos: P[] = filas.map((p) => ({ f: fechaAR(p.creadoEn), en: p.creadoEn, monto: Number(p.webTotal ?? 0) }));

  // DÍA ELEGIDO: solo los valores (sin comparaciones).
  const delDia = suma(todos.filter((p) => p.f === dia));
  const ticket = delDia.pedidos ? delDia.total / delDia.pedidos : null;

  // DETALLE POR DÍA del mes que se está mirando
  const delMes = todos.filter((p) => p.f.startsWith(mes));
  const diasDelMes = Number(sumarDias(`${mesSiguiente(mes)}-01`, -1).slice(8));
  const dias = Array.from({ length: diasDelMes }, (_, i) => {
    const f = `${mes}-${String(i + 1).padStart(2, "0")}`;
    return { f, dia: i + 1, nombre: nombreDia(f), ...suma(delMes.filter((p) => p.f === f)) };
  });
  const tot = suma(delMes);

  // PRODUCTOS QUE MÁS SE VENDIERON en el mes (mismos pedidos que arriba: los de la tienda, por día de pedido, sin cancelados).
  const iniAnt = inicioDia(`${mesAnterior(mes)}-01`);
  const traerItems = (desde: Date, hasta: Date) => db.pedidoItem.findMany({
    where: { paquetesPor: { gt: 0 }, pedido: { origen: "WEB", estado: { not: "CANCELADO" }, creadoEn: { gte: desde, lt: hasta } } }, // paquetesPor 0 = el envío: no es un producto
    select: { pedidoId: true, nombre: true, cantidad: true, unidad: true, pedido: { select: { creadoEn: true } } },
  });
  const [items, itemsAnt] = await Promise.all([traerItems(iniMes, finMes), traerItems(iniAnt, iniMes)]);
  const sinTildes = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const etiquetaUnidad = (u: string) => (u === "paquete" ? "paquetes" : u === "combo" ? "combos" : "unidades");
  // Un mismo producto escrito distinto (la tienda y el catálogo) se junta: las focaccias de oliva y las de cherry.
  const nombreLimpio = (n: string) => {
    const base = n.replace(/\s*\(POR FUERA\)\s*$/i, "").replace(/\s+/g, " ").trim().toUpperCase();
    const t = sinTildes(base);
    if (!t.includes("COMBO") && t.includes("FOCACCIA")) return t.includes("CHERRY") ? "FOCACCIA CHERRY Y ROMERO" : t.includes("OLIVA") ? "FOCACCIA OLIVA" : base;
    return base;
  };
  type Fila = { nombre: string; unidad: string; cantidad: number; pedidos: Set<string>; ultima: Date | null };
  const agregar = (lista: typeof items) => {
    const m = new Map<string, Fila>();
    const sumar = (nombre: string, unidad: string, cantidad: number, pedidoId: string, en: Date) => {
      const f = m.get(nombre) ?? { nombre, unidad, cantidad: 0, pedidos: new Set<string>(), ultima: null };
      f.cantidad += cantidad; f.pedidos.add(pedidoId);
      if (!f.ultima || en > f.ultima) f.ultima = en;
      m.set(nombre, f);
    };
    for (const it of lista) {
      const nombre = nombreLimpio(it.nombre);
      const t = sinTildes(nombre);
      const en = it.pedido.creadoEn;
      if (desarmados && t.includes("COMBO")) {
        // Combo desarmado = lo que lleva adentro: 2 paquetes de prepizza tomate; el toscano suma además 1 focaccia de oliva y 1 de cherry; el "+ 2 FOCACCIA" suma 2 de oliva.
        sumar("PREPIZZA TOMATE", "paquete", 2 * it.cantidad, it.pedidoId, en);
        if (t.includes("TOSCANO")) { sumar("FOCACCIA OLIVA", "unidad", it.cantidad, it.pedidoId, en); sumar("FOCACCIA CHERRY Y ROMERO", "unidad", it.cantidad, it.pedidoId, en); }
        else if (t.includes("FOCACCIA")) sumar("FOCACCIA OLIVA", "unidad", 2 * it.cantidad, it.pedidoId, en);
      } else sumar(nombre, it.unidad, it.cantidad, it.pedidoId, en);
    }
    return m;
  };
  const porProducto = agregar(items);
  const anterior = agregar(itemsAnt);
  const ranking = [...porProducto.values()].sort((x, y) => y.cantidad - x.cantidad || x.nombre.localeCompare(y.nombre, "es"));
  const visibles = verTodos ? ranking : ranking.slice(0, 15);
  const sumaUnidad = (u: string) => ranking.filter((f) => f.unidad === u).reduce((t, f) => t + f.cantidad, 0);
  const abrirProductos = desarmados || verTodos || abrirParam === "1"; // la sección queda abierta si se vino de adentro de ella
  const variacion = (f: Fila): { texto: string; tono: string } => {
    const antes = anterior.get(f.nombre);
    if (!antes || antes.cantidad === 0) return { texto: "nuevo", tono: "text-stone-400" };
    const pct = Math.round(((f.cantidad - antes.cantidad) / antes.cantidad) * 100);
    return pct === 0 ? { texto: "= igual", tono: "text-stone-500" } : { texto: `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}%`, tono: pct > 0 ? "text-verde-700" : "text-rojo-700" };
  };
  const diasConVenta = dias.filter((d) => d.pedidos > 0).length;
  const nav = "flex h-9 items-center rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold hover:border-stone-600";
  const navOff = "flex h-9 items-center rounded-md border border-stone-200 bg-stone-100 px-3 text-sm font-semibold text-stone-300";
  const celda = "px-3 py-1.5 text-center tabular-nums";
  const href = (d: string, m?: string) => `/comercial/tienda?dia=${d}${m ? `&mes=${m}` : ""}`;
  const hrefProd = (c: boolean, todos: boolean) => `/comercial/tienda?dia=${dia}&mes=${mes}${c ? "&combos=desarmados" : ""}${todos ? "&todos=1" : ""}&abrir=1`;

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoComercial
          activa="tienda"
          derecha={
            <nav className="flex items-center gap-2" aria-label="Mes">
              <Link href={href(dia, mesAnterior(mes))} className={nav} aria-label="Mes anterior">←</Link>
              <span className="min-w-44 rounded-md border border-stone-800 bg-stone-800 px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-white">{nombreMes(mes)}</span>
              {mesSiguiente(mes) <= fechaHoy.slice(0, 7) ? <Link href={href(dia, mesSiguiente(mes))} className={nav} aria-label="Mes siguiente">→</Link> : <span className={navOff} aria-hidden>→</span>}
            </nav>
          }
        />

        {/* El día que se está mirando: ← día anterior · fecha · día siguiente → */}
        <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Día">
          <Link href={href(sumarDias(dia, -1))} className={nav} aria-label="Día anterior">← Día anterior</Link>
          <span className="min-w-64 rounded-md border border-stone-800 bg-stone-800 px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-white">{fechaLarga(dia)}{esHoy && " · hoy"}</span>
          {esHoy ? <span className={navOff} aria-hidden>Día siguiente →</span> : <Link href={href(sumarDias(dia, 1))} className={nav} aria-label="Día siguiente">Día siguiente →</Link>}
          {!esHoy && <Link href="/comercial/tienda" className={nav}>Ir a hoy</Link>}
        </nav>

        <section aria-label="Resumen del día" className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-stone-700 bg-stone-700 sm:grid-cols-3">
          {[
            { t: "Pedidos", v: String(delDia.pedidos) },
            { t: "Facturación", v: pesos(delDia.total) },
            { t: "Ticket promedio", v: ticket === null ? "—" : pesos(ticket) },
          ].map((x) => (
            <div key={x.t} className="bg-stone-900 px-4 py-5 text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">{x.t}</p>
              <p className="mt-1 truncate text-[28px] font-extrabold leading-tight tabular-nums text-white">{x.v}</p>
            </div>
          ))}
        </section>
        <p className="-mt-2 text-center text-[12px] text-stone-500">Cuenta todo lo que entró ese día (esté pago o no); los cancelados no cuentan.</p>

        <Panel titulo="Detalle por día" nota={`${nombreMes(mes)} · tocá un día para verlo arriba`}>
          {tot.pedidos === 0 ? <SinDatos /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-stone-300 bg-crema-100 text-[11.5px] uppercase tracking-wide text-stone-600">
                    <th className={`${celda} !text-left`}>Día</th>
                    <th className={celda}>Pedidos</th>
                    <th className={celda}>Facturación</th>
                    <th className={celda}>Ticket promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {dias.map((d) => {
                    const futuro = d.f > fechaHoy, elegido = d.f === dia, esDeHoy = d.f === fechaHoy;
                    const tk = d.pedidos ? d.total / d.pedidos : null;
                    return (
                      <tr key={d.f} className={`border-b border-stone-200 ${elegido ? "bg-crema-100 font-semibold" : ""} ${futuro ? "text-stone-300" : ""}`}>
                        <td className={`${celda} !text-left`}>
                          {futuro ? <span>{d.nombre.slice(0, 3)} {d.dia}</span> : <Link href={href(d.f, mes)} className="underline-offset-2 hover:underline">{d.nombre.slice(0, 3)} {d.dia}</Link>}
                          {esDeHoy && <span className="ml-2 rounded bg-stone-800 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">hoy</span>}
                        </td>
                        <td className={celda}>{d.pedidos || "—"}</td>
                        <td className={celda}>{d.pedidos ? pesos(d.total) : "—"}</td>
                        <td className={celda}>{tk === null ? "—" : pesos(tk)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-stone-400 bg-crema-100 font-bold">
                    <td className={`${celda} !text-left`}>Total del mes</td>
                    <td className={celda}>{tot.pedidos}</td>
                    <td className={celda}>{pesos(tot.total)}</td>
                    <td className={celda}>{tot.pedidos ? pesos(tot.total / tot.pedidos) : "—"}</td>
                  </tr>
                  {diasConVenta > 0 && (
                    <tr className="bg-crema-50 text-stone-600">
                      <td className={`${celda} !text-left`}>Promedio por día con ventas</td>
                      <td className={celda}>{(tot.pedidos / diasConVenta).toLocaleString("es-AR", { maximumFractionDigits: 1 })}</td>
                      <td className={celda}>{pesos(tot.total / diasConVenta)}</td>
                      <td className={celda}>—</td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          )}
        </Panel>

        <Panel titulo="Pedidos del día" nota={`${fechaLarga(dia)} · ${filasDia.filter((f) => !f.cancelado).length} pedidos`}>
          {filasDia.length === 0 ? <SinDatos /> : <PedidosDelDia filas={filasDia} />}
        </Panel>

        {/* Apartado aparte, cerrado de entrada: se abre con un toque */}
        <details open={abrirProductos} className="group rounded-xl border border-stone-300 bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-crema-50">
            <span className="flex items-center gap-3">
              <span className="text-stone-500 transition group-open:rotate-90" aria-hidden>▶</span>
              <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-stone-700">Productos que más se vendieron</span>
            </span>
            <span className="text-[11.5px] text-stone-400">{nombreMes(mes)} · {ranking.length} productos · tocá para {abrirProductos ? "cerrar" : "abrir"}</span>
          </summary>
          <div className="border-t border-stone-200 p-4">
            {ranking.length === 0 ? <SinDatos /> : (
              <>
                <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-stone-300 bg-stone-300 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    { t: "Pedidos del mes", v: tot.pedidos.toLocaleString("es-AR") },
                    { t: "Productos distintos", v: ranking.length.toLocaleString("es-AR") },
                    { t: "Paquetes vendidos", v: sumaUnidad("paquete").toLocaleString("es-AR") },
                    { t: "Unidades vendidas", v: sumaUnidad("unidad").toLocaleString("es-AR") },
                    { t: "Combos vendidos", v: sumaUnidad("combo").toLocaleString("es-AR") },
                    { t: "Productos por pedido", v: tot.pedidos ? (items.length / tot.pedidos).toLocaleString("es-AR", { maximumFractionDigits: 1 }) : "—" },
                  ].map((x) => (
                    <div key={x.t} className="bg-crema-50 px-3 py-3 text-center">
                      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-stone-500">{x.t}</p>
                      <p className="mt-0.5 text-[18px] font-bold tabular-nums text-stone-900">{x.v}</p>
                    </div>
                  ))}
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
                  <span className="text-stone-500">Los combos se cuentan:</span>
                  <Link href={hrefProd(false, verTodos)} className={`rounded-md border px-3 py-1 font-semibold ${!desarmados ? "border-stone-800 bg-stone-800 text-white" : "border-stone-300 bg-white hover:border-stone-600"}`}>Como se venden</Link>
                  <Link href={hrefProd(true, verTodos)} className={`rounded-md border px-3 py-1 font-semibold ${desarmados ? "border-stone-800 bg-stone-800 text-white" : "border-stone-300 bg-white hover:border-stone-600"}`}>Desarmados</Link>
                </div>
                <p className="mb-3 text-[12px] text-stone-500">
                  {desarmados
                    ? "Cada combo se abre y suma lo que lleva adentro: 2 paquetes de prepizza tomate (el toscano suma además 1 focaccia de oliva y 1 de cherry; el combo con focaccias, 2 de oliva). Sirve para saber cuánto hay que fabricar."
                    : "Cada producto tal cual lo compra el cliente: los combos van en su propia línea y no se mezclan con las prepizzas. Los paquetes y las unidades no se suman entre sí."}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-stone-300 bg-crema-100 text-[11.5px] uppercase tracking-wide text-stone-600">
                        <th className={`${celda} w-12`}>#</th>
                        <th className={`${celda} !text-left`}>Producto</th>
                        <th className={celda}>Vendidos</th>
                        <th className={celda} title="En cuántos pedidos del mes aparece">En cuántos pedidos</th>
                        <th className={celda} title="De todos los pedidos del mes, cuántos lo llevan">% de los pedidos</th>
                        <th className={celda} title="Cuánto compra cada cliente cuando lo lleva">Promedio por pedido</th>
                        <th className={celda} title="Comparado con el mes anterior (la misma forma de contar los combos)">vs mes anterior</th>
                        <th className={celda}>Última venta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibles.map((f, i) => {
                        const v = variacion(f);
                        const pct = tot.pedidos ? (f.pedidos.size / tot.pedidos) * 100 : 0;
                        return (
                          <tr key={f.nombre} className="border-b border-stone-200">
                            <td className={`${celda} text-stone-400`}>{i + 1}</td>
                            <td className={`${celda} !text-left font-medium`}>{f.nombre}</td>
                            <td className={`${celda} font-bold`}>{f.cantidad.toLocaleString("es-AR")} <span className="text-[11.5px] font-normal text-stone-500">{etiquetaUnidad(f.unidad)}</span></td>
                            <td className={celda}>{f.pedidos.size}</td>
                            <td className={celda}>
                              <span className="font-semibold">{pct.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%</span>
                              <span className="mx-auto mt-1 block h-1 w-20 overflow-hidden rounded bg-stone-200"><span className="block h-full bg-stone-600" style={{ width: `${Math.min(100, pct)}%` }} /></span>
                            </td>
                            <td className={celda}>{(f.cantidad / f.pedidos.size).toLocaleString("es-AR", { maximumFractionDigits: 1 })}</td>
                            <td className={`${celda} font-semibold ${v.tono}`}>{v.texto}</td>
                            <td className={`${celda} text-stone-600`}>{f.ultima ? fechaAR(f.ultima).slice(8) + "/" + fechaAR(f.ultima).slice(5, 7) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {ranking.length > 15 && (
                  <p className="mt-3 text-center">
                    <Link href={hrefProd(desarmados, !verTodos)} className="text-[13px] font-semibold text-stone-700 underline-offset-2 hover:underline">{verTodos ? "Mostrar solo los 15 primeros ▴" : `Ver los ${ranking.length} productos ▾`}</Link>
                  </p>
                )}
              </>
            )}
          </div>
        </details>
      </main>
    </>
  );
}
