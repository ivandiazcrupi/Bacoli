import { notFound } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { aFecha, deFecha, diaMes, esFechaValida, diasDeSemana, finDeSemana, hoy, inicioSemana, nombreDia, sumarDias } from "@/lib/fechas";
import { titulo } from "@/lib/mayusculas";
import { porReparto } from "@/lib/ruta";
import { estadoDelDia } from "@/lib/dias";
import { exigirOficina } from "@/lib/session";
import { aFila, clientesConDeuda, incluirPedido } from "../../filas";
import { CONTENEDOR_PEDIDOS, EncabezadoPedidos } from "../../Encabezado";
import { DiasSemana } from "./DiasSemana";
import { HojaDia } from "./HojaDia";

// Hoja de ruta de un día: qué vehículos salen, qué lleva cada uno y en qué orden (con las entregas y cobros de cada pedido).
export default async function HojaDelDia({ params }: { params: Promise<{ fecha: string }> }) {
  const usuario = await exigirOficina();
  const { fecha } = await params;
  if (!esFechaValida(fecha)) notFound();

  const [pedidos, salidas, vehiculos, repartidores, cerrado, intentos] = await Promise.all([
    db.pedido.findMany({ where: { fechaEntrega: aFecha(fecha), estado: { not: "CANCELADO" } }, include: { ...incluirPedido, salida: true } }),
    db.salida.findMany({ where: { fecha: aFecha(fecha) }, include: { vehiculo: true }, orderBy: { orden: "asc" } }),
    db.vehiculo.findMany({ where: { activo: true }, orderBy: { orden: "asc" } }),
    db.usuario.findMany({ where: { rol: "REPARTIDOR", activo: true }, orderBy: { nombre: "asc" } }),
    db.diaCerrado.findUnique({ where: { fecha: aFecha(fecha) } }),
    db.intentoEntrega.findMany({ where: { fecha: aFecha(fecha) }, include: { pedido: { select: { estado: true, fechaEntrega: true } } }, orderBy: [{ orden: "asc" }, { creadoEn: "asc" }] }),
  ]);
  pedidos.sort(porReparto);
  const est = await estadoDelDia(fecha);
  const quien = est.por ? (await db.usuario.findUnique({ where: { id: est.por }, select: { nombre: true } }))?.nombre ?? "" : "";
  const cuando = est.cuando ? new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "numeric", timeZone: "America/Argentina/Buenos_Aires" }).format(est.cuando).replace(",", " ·") : "";

  // Qué pasó después con cada pedido que no se entregó este día.
  const destinoDe = (p: { estado: string; fechaEntrega: Date | null }) => {
    const f = p.fechaEntrega ? deFecha(p.fechaEntrega) : null;
    if (p.estado === "ENTREGADO" && f) return `Se entregó el ${diaMes(f)}`;
    if (p.estado === "CANCELADO") return "Cancelado";
    if (f) return `Reprogramado: ${nombreDia(f).slice(0, 3)} ${diaMes(f)}`;
    return "En Pedidos, esperando día";
  };
  const siluetas = intentos.map((i) => {
    const r = i.resumen as { barrio?: string; cliente?: string; direccion?: string; items?: { nombre: string; cantidad: number }[] };
    return { id: i.id, pedidoId: i.pedidoId, salidaId: i.salidaId, vehiculo: i.vehiculo, orden: i.orden, motivo: i.motivo, barrio: r.barrio ?? "", cliente: r.cliente ?? "", direccion: r.direccion ?? "", items: r.items ?? [], destino: destinoDe(i.pedido) };
  });
  const debe = await clientesConDeuda(pedidos.flatMap((p) => (p.clienteId ? [p.clienteId] : [])));
  const filas = pedidos.map((p) => aFila(p, debe));
  const salen = new Set(salidas.map((s) => s.vehiculoId));

  const inicio = inicioSemana(fecha);
  const fin = finDeSemana(inicio);
  const [cuentaPedidos, cuentaSalidas, cerradosSemana] = await Promise.all([
    db.pedido.groupBy({ by: ["fechaEntrega"], where: { estado: { not: "CANCELADO" }, origen: { not: "COBRANZA" }, fechaEntrega: { gte: aFecha(inicio), lte: aFecha(fin) } }, _count: true }),
    db.salida.groupBy({ by: ["fecha"], where: { fecha: { gte: aFecha(inicio), lte: aFecha(fin) } }, _count: true }),
    db.diaCerrado.findMany({ where: { fecha: { gte: aFecha(inicio), lte: aFecha(fin) } } }),
  ]);
  const cerradosSet = new Set(cerradosSemana.map((d) => deFecha(d.fecha)));
  const nPedidos = new Map(cuentaPedidos.map((c) => [c.fechaEntrega ? deFecha(c.fechaEntrega) : "", c._count]));
  const nSalidas = new Map(cuentaSalidas.map((c) => [deFecha(c.fecha), c._count]));
  const fechasSemana = diasDeSemana(inicio);
  const diasSemana = fechasSemana.map((f) => ({ fecha: f, corta: `${nombreDia(f).slice(0, 3)} ${diaMes(f)}` }));
  const mismoDia = (semana: number) => sumarDias(fecha, 7 * semana);

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoPedidos activa="ruta" fechaRuta={fecha} />

        {/* Para ir día por día: la semana y sus seis días  */}
        <DiasSemana
          fecha={fecha}
          inicioTexto={diaMes(inicio)}
          hrefAnterior={`/pedidos/dia/${mismoDia(-1)}`}
          hrefSiguiente={`/pedidos/dia/${mismoDia(1)}`}
          hrefSemana={`/pedidos/semana?semana=${inicio}`}
          dias={fechasSemana.map((f) => ({ fecha: f, texto: `${nombreDia(f).slice(0, 3)} ${Number(f.slice(8))}`, pedidos: nPedidos.get(f) ?? 0, vehiculos: nSalidas.get(f) ?? 0, cerrado: cerradosSet.has(f) }))}
        />

        <HojaDia
          estadoDia={{ estado: est.estado, por: quien, cuando }}
          hoy={hoy()}
          siluetas={siluetas}
          titulo={`Hoja de ruta · ${nombreDia(fecha)} ${diaMes(fecha)}`}
          fecha={fecha}
          filasIniciales={filas}
          salidas={salidas.map((s) => ({ id: s.id, nombre: titulo(s.vehiculo.nombre), patente: s.vehiculo.patente ?? "", capacidad: s.vehiculo.capacidad, repartidorId: s.repartidorId ?? "", horaInicio: s.horaInicio ?? "", horaFin: s.horaFin ?? "" }))}
          vehiculosLibres={vehiculos.filter((v) => !salen.has(v.id)).map((v) => ({ id: v.id, nombre: titulo(v.nombre) }))}
          repartidores={repartidores.map((r) => ({ id: r.id, nombre: r.nombre }))}
          diasSemana={diasSemana}
          cerrado={!!cerrado}
          esDueno={usuario.rol === "DUENO"}
        />
      </main>
    </>
  );
}
