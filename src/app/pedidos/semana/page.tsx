import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { cabeceraTabla } from "@/components/campos";
import { importeVigente } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { aFecha, deFecha, diaMes, esFechaValida, hoy, lunesDe, nombreDia, sumarDias } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { bultosDe } from "@/lib/ruta";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS, EncabezadoPedidos } from "../Encabezado";

// SEMANA: cada día con lo que tiene asignado. Al entrar a un día se arma su hoja de ruta (qué vehículos salen y qué lleva cada uno).
export default async function Semana({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const usuario = await exigirOficina();
  const { semana } = await searchParams;
  const lunes = lunesDe(semana && esFechaValida(semana) ? semana : hoy());
  const domingo = sumarDias(lunes, 6);
  const esta = lunesDe(hoy());

  const [pedidos, salidas, cerrados] = await Promise.all([
    db.pedido.findMany({ where: { estado: { not: "CANCELADO" }, fechaEntrega: { gte: aFecha(lunes), lte: aFecha(domingo) } }, include: { items: true } }),
    db.salida.findMany({ where: { fecha: { gte: aFecha(lunes), lte: aFecha(domingo) } }, include: { vehiculo: true }, orderBy: { orden: "asc" } }),
    db.diaCerrado.findMany({ where: { fecha: { gte: aFecha(lunes), lte: aFecha(domingo) } } }),
  ]);
  const cerradosSet = new Set(cerrados.map((d) => deFecha(d.fecha)));
  const hayDomingo = pedidos.some((p) => p.fechaEntrega && deFecha(p.fechaEntrega) === domingo);
  const fechas = Array.from({ length: hayDomingo ? 7 : 6 }, (_, n) => sumarDias(lunes, n));

  const COLUMNAS = "lg:grid-cols-[8rem_1fr_6rem_6.5rem_9rem_7rem_6rem]";

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoPedidos activa="semana" fechaRuta={esta === lunes ? undefined : lunes} />

        <nav className="flex flex-wrap items-center justify-center gap-2 text-sm" aria-label="Semana">
          <Link href={`/pedidos/semana?semana=${sumarDias(lunes, -7)}`} className="rounded-md border border-stone-400 bg-white px-3 py-2 shadow-sm hover:border-verde-700" aria-label="Semana anterior">←</Link>
          <span className="min-w-40 rounded-md bg-verde-800 px-5 py-2 text-center text-sm font-bold uppercase tracking-wide text-white">Semana {diaMes(lunes)}</span>
          <Link href={`/pedidos/semana?semana=${sumarDias(lunes, 7)}`} className="rounded-md border border-stone-400 bg-white px-3 py-2 shadow-sm hover:border-verde-700" aria-label="Semana siguiente">→</Link>
          {lunes !== esta && <Link href="/pedidos/semana" className="rounded-md border border-stone-400 bg-white px-3 py-2 shadow-sm hover:border-verde-700">Esta semana</Link>}
        </nav>

        <div className="overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm">
          <div className={`hidden gap-x-4 px-5 py-3 text-center lg:grid ${cabeceraTabla} ${COLUMNAS}`}>
            <span>Día</span><span>Vehículos (paquetes cargados)</span><span>Pedidos</span><span>Paquetes</span><span>Monto</span><span>Entregas</span><span />
          </div>
          {fechas.map((f) => {
            const delDia = pedidos.filter((p) => p.fechaEntrega && deFecha(p.fechaEntrega) === f);
            const sus = salidas.filter((s) => deFecha(s.fecha) === f);
            const sinVehiculo = delDia.filter((p) => p.salidaId === null).length;
            const paquetes = delDia.reduce((s, p) => s + bultosDe(p.items), 0);
            const monto = delDia.reduce((s, p) => s + importeVigente(p.items, Number(p.ivaPct), p.estado === "ENTREGADO" ? "ENTREGADO" : "PENDIENTE"), 0);
            const entregados = delDia.filter((p) => p.estado === "ENTREGADO").length;
            const esHoy = f === hoy();
            return (
              <Link
                key={f}
                href={`/pedidos/dia/${f}`}
                className={`grid items-center gap-x-4 gap-y-1 border-t border-stone-300 px-5 py-3 text-center first:border-t-0 hover:bg-crema-100 lg:grid-cols-[8rem_1fr_6rem_6.5rem_9rem_7rem_6rem] ${esHoy ? "bg-crema-50 shadow-[inset_4px_0_0_0_#026433]" : "bg-white"}`}
              >
                <span className="text-sm font-bold">{nombreDia(f)} <span className="font-medium text-stone-600">{diaMes(f)}</span>{esHoy && <span className="ml-1 text-xs font-semibold text-verde-800">hoy</span>}</span>
                <span className="flex flex-wrap items-center justify-center gap-1.5">
                  {sus.length === 0 && sinVehiculo === 0 && <span className="text-sm text-stone-400">—</span>}
                  {sus.map((s) => {
                    const carga = delDia.filter((p) => p.salidaId === s.id).reduce((t, p) => t + bultosDe(p.items), 0);
                    const pasado = s.vehiculo.capacidad !== null && carga > s.vehiculo.capacidad;
                    return (
                      <span key={s.id} className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ${pasado ? "bg-rojo-100 text-rojo-800" : "bg-crema-200 text-verde-900"}`}>
                        {s.vehiculo.nombre} · {carga}{s.vehiculo.capacidad !== null && ` / ${s.vehiculo.capacidad}`}
                      </span>
                    );
                  })}
                  {sinVehiculo > 0 && <span className="rounded-full bg-rojo-100 px-2.5 py-0.5 text-[11px] font-semibold text-rojo-800">{sinVehiculo} sin vehículo</span>}
                </span>
                <span className="text-sm tabular-nums">{delDia.length}</span>
                <span className="text-sm tabular-nums">{paquetes}</span>
                <span className="text-sm font-semibold tabular-nums">{delDia.length ? formatoPesos(monto) : "—"}</span>
                <span className="text-sm tabular-nums">{delDia.length ? `${entregados} de ${delDia.length}` : "—"}</span>
                <span className="flex items-center justify-center gap-1.5 text-sm font-semibold text-verde-800">
                  {cerradosSet.has(f) && <span className="rounded bg-stone-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">Cerrado</span>}
                  Abrir ›
                </span>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}
