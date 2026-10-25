import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { cabeceraTabla } from "@/components/campos";
import { importeVigente } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { aFecha, deFecha, diaMes, esFechaValida, diasDeSemana, finDeSemana, hoy, inicioSemana, nombreDia, sumarDias, semanaDeTrabajo } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { bultosDe, focacciasPorTipo, num, TOPE_COSTO_POR_PIZZA, totalUnidades, unidadesPorSabor } from "@/lib/ruta";
import { exigirOficina } from "@/lib/session";
import { vendedoresDesbloqueado } from "@/lib/claveVendedores";
import { DesbloquearTotales, OcultarTotales } from "./TotalFacturacion";
import { CONTENEDOR_PEDIDOS, EncabezadoPedidos } from "../Encabezado";

// SEMANA: cada día con lo que tiene asignado. Al entrar a un día se arma su hoja de ruta (qué vehículos salen y qué lleva cada uno).
export default async function Semana({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const usuario = await exigirOficina();
  const { semana } = await searchParams;
  const inicio = semana && esFechaValida(semana) ? inicioSemana(semana) : semanaDeTrabajo();
  const fin = finDeSemana(inicio);
  const esta = semanaDeTrabajo();
  const verTotales = await vendedoresDesbloqueado();

  const [pedidos, salidas, cerrados, empresa] = await Promise.all([
    db.pedido.findMany({ where: { estado: { not: "CANCELADO" }, origen: { not: "COBRANZA" }, fechaEntrega: { gte: aFecha(inicio), lte: aFecha(fin) } }, include: { items: true } }),
    db.salida.findMany({ where: { fecha: { gte: aFecha(inicio), lte: aFecha(fin) } }, include: { vehiculo: true }, orderBy: { orden: "asc" } }),
    db.diaCerrado.findMany({ where: { fecha: { gte: aFecha(inicio), lte: aFecha(fin) } } }),
    db.empresa.findUnique({ where: { id: "principal" }, select: { costoLogisticoUnidad: true } }),
  ]);
  const tope = Number(empresa?.costoLogisticoUnidad ?? TOPE_COSTO_POR_PIZZA);
  // Costo logístico por unidad: lo que cuestan las camionetas con pedidos ÷ las unidades que llevan (pizzas, prepizzas y focaccias). Null si falta cargar algún costo o no hay camionetas.
  const unidadesCosto = (ps: typeof pedidos) => ps.reduce((t, p) => { const a = unidadesPorSabor(p.items); const x = focacciasPorTipo(p.items); return t + a.tomate + a.cebolla + a.pizzas + x.oliva + x.cherry; }, 0);
  const costoDe = (fs: string[]) => {
    const sas = salidas.filter((sa) => fs.includes(deFecha(sa.fecha)) && pedidos.some((p) => p.salidaId === sa.id));
    const u = unidadesCosto(pedidos.filter((p) => p.salidaId && p.fechaEntrega && fs.includes(deFecha(p.fechaEntrega))));
    const costo = sas.reduce((t, sa) => t + Number(sa.costoLogistica ?? 0), 0);
    return { costo, porUnidad: sas.length > 0 && u > 0 && sas.every((sa) => sa.costoLogistica !== null) ? costo / u : null };
  };
  const cerradosSet = new Set(cerrados.map((d) => deFecha(d.fecha)));
  const fechas = diasDeSemana(inicio); // MAR a SÁB y LUN: el domingo no se reparte

  // Totales de la semana (los mismos cálculos que cada día, sumados).
  const todos = pedidos.filter((p) => p.fechaEntrega && fechas.includes(deFecha(p.fechaEntrega)));
  const total = {
    pedidos: todos.length,
    paquetes: todos.reduce((s, p) => s + bultosDe(p.items), 0),
    unidades: todos.reduce((s, p) => s + totalUnidades(unidadesPorSabor(p.items)), 0),
    monto: todos.reduce((s, p) => s + importeVigente(p.items, Number(p.ivaPct), p.estado === "ENTREGADO" ? "ENTREGADO" : "PENDIENTE", p.webTotal), 0),
    entregados: todos.filter((p) => p.estado === "ENTREGADO").length,
    vehiculos: fechas.reduce((s, f) => s + salidas.filter((x) => deFecha(x.fecha) === f).length, 0),
  };

  const costoSemana = costoDe(fechas);
  const COLUMNAS = "lg:grid-cols-[12rem_1fr_1fr_1fr_1fr_1fr_1fr_1fr_7rem]";

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoPedidos activa="semana" fechaRuta={esta === inicio ? undefined : inicio} />

        <nav className="flex flex-wrap items-center justify-center gap-2 text-sm" aria-label="Semana">
          <Link href={`/pedidos/semana?semana=${sumarDias(inicio, -7)}`} className="rounded-md border border-stone-400 bg-white px-3 py-2 shadow-sm hover:border-verde-700" aria-label="Semana anterior">←</Link>
          <span className="min-w-40 rounded-md border border-stone-300 bg-white px-5 py-2 text-center text-sm font-bold uppercase tracking-wide text-stone-800">Semana {diaMes(inicio)}</span>
          <Link href={`/pedidos/semana?semana=${sumarDias(inicio, 7)}`} className="rounded-md border border-stone-400 bg-white px-3 py-2 shadow-sm hover:border-verde-700" aria-label="Semana siguiente">→</Link>
          {inicio !== esta && <Link href="/pedidos/semana" className="rounded-md border border-stone-400 bg-white px-3 py-2 shadow-sm hover:border-verde-700">Esta semana</Link>}
        </nav>

        <div className="overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm">
          <div className={`hidden gap-x-4 px-5 py-3 text-center lg:grid ${cabeceraTabla} ${COLUMNAS}`}>
            <span>Día</span><span>Pedidos</span><span>Paquetes</span><span>Unidades</span><span>Facturación</span><span>Costo logístico</span><span>Entregas</span><span>Vehículos</span><span />
          </div>
          {fechas.map((f) => {
            const delDia = pedidos.filter((p) => p.fechaEntrega && deFecha(p.fechaEntrega) === f);
            const vehiculos = salidas.filter((s) => deFecha(s.fecha) === f).length;
            const paquetes = delDia.reduce((s, p) => s + bultosDe(p.items), 0);
            const unidades = delDia.reduce((s, p) => s + totalUnidades(unidadesPorSabor(p.items)), 0);
            const monto = delDia.reduce((s, p) => s + importeVigente(p.items, Number(p.ivaPct), p.estado === "ENTREGADO" ? "ENTREGADO" : "PENDIENTE", p.webTotal), 0);
            const entregados = delDia.filter((p) => p.estado === "ENTREGADO").length;
            const costoD = costoDe([f]).porUnidad;
            const esHoy = f === hoy();
            const vacio = delDia.length === 0;
            return (
              <Link
                key={f}
                href={`/pedidos/dia/${f}`}
                className={`grid items-center gap-x-4 gap-y-1 border-t border-stone-300 px-5 py-5 text-center text-[15px] first:border-t-0 hover:bg-crema-100 ${COLUMNAS} ${esHoy ? "bg-crema-50 shadow-[inset_4px_0_0_0_#026433]" : "bg-white"}`}
              >
                <span className="text-base font-bold">{nombreDia(f)} <span className="font-medium text-stone-600">{diaMes(f)}</span>{esHoy && <span className="ml-1 text-xs font-semibold text-verde-800">hoy</span>}</span>
                <span className="tabular-nums"><span className="text-xs text-stone-500 lg:hidden">Pedidos: </span>{delDia.length}</span>
                <span className="tabular-nums"><span className="text-xs text-stone-500 lg:hidden">Paquetes: </span>{num(paquetes)}</span>
                <span className="tabular-nums"><span className="text-xs text-stone-500 lg:hidden">Unidades: </span>{unidades}</span>
                <span className="font-semibold tabular-nums"><span className="text-xs font-normal text-stone-500 lg:hidden">Facturación: </span>{vacio ? "—" : formatoPesos(monto)}</span>
                <span className={`font-semibold tabular-nums ${costoD === null ? "text-stone-400" : costoD > tope ? "text-rojo-700" : "text-verde-700"}`}><span className="text-xs font-normal text-stone-500 lg:hidden">Costo logístico: </span>{costoD === null ? "—" : <>{formatoPesos(costoD)}<span className="ml-1 text-[11px] font-normal text-stone-500">/ un.</span></>}</span>
                <span className="tabular-nums"><span className="text-xs text-stone-500 lg:hidden">Entregas: </span>{vacio ? "—" : `${entregados} de ${delDia.length}`}</span>
                <span className="tabular-nums"><span className="text-xs text-stone-500 lg:hidden">Vehículos: </span>{vehiculos}</span>
                <span className="flex items-center justify-center gap-1.5 text-sm font-semibold text-verde-800">
                  {cerradosSet.has(f) && <span className="rounded bg-stone-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">Cerrado</span>}
                  Abrir ›
                </span>
              </Link>
            );
          })}
          <div className={`grid items-center gap-x-4 gap-y-1 border-t-2 border-stone-400 bg-crema-100 px-5 py-5 text-center text-[15px] ${COLUMNAS}`}>
            <span className="text-base font-bold uppercase tracking-wide">Total semana</span>
            {verTotales ? (
              <>
                <span className="font-bold tabular-nums"><span className="text-xs font-normal text-stone-500 lg:hidden">Pedidos: </span>{total.pedidos}</span>
                <span className="font-bold tabular-nums"><span className="text-xs font-normal text-stone-500 lg:hidden">Paquetes: </span>{num(total.paquetes)}</span>
                <span className="font-bold tabular-nums"><span className="text-xs font-normal text-stone-500 lg:hidden">Unidades: </span>{total.unidades}</span>
                <span className="font-bold tabular-nums"><span className="text-xs font-normal text-stone-500 lg:hidden">Facturación: </span>{total.pedidos === 0 ? "—" : formatoPesos(total.monto)}</span>
                <span className={`font-bold tabular-nums ${costoSemana.porUnidad === null ? "text-stone-400" : costoSemana.porUnidad > tope ? "text-rojo-700" : "text-verde-700"}`}><span className="text-xs font-normal text-stone-500 lg:hidden">Costo logístico: </span>{costoSemana.porUnidad === null ? "—" : <>{formatoPesos(costoSemana.porUnidad)}<span className="ml-1 text-[11px] font-normal text-stone-500">/ un.</span></>}</span>
                <span className="font-bold tabular-nums"><span className="text-xs font-normal text-stone-500 lg:hidden">Entregas: </span>{total.pedidos === 0 ? "—" : `${total.entregados} de ${total.pedidos}`}</span>
                <span className="font-bold tabular-nums"><span className="text-xs font-normal text-stone-500 lg:hidden">Vehículos: </span>{total.vehiculos}</span>
                <OcultarTotales />
              </>
            ) : (
              <span className="lg:col-span-8"><DesbloquearTotales /></span>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
