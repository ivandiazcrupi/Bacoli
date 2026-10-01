import { notFound } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { aFecha, deFecha, diaMes, esFechaValida, lunesDe, nombreDia, sumarDias } from "@/lib/fechas";
import { titulo } from "@/lib/mayusculas";
import { porReparto } from "@/lib/ruta";
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

  const [pedidos, salidas, vehiculos, repartidores, cerrado] = await Promise.all([
    db.pedido.findMany({ where: { fechaEntrega: aFecha(fecha), estado: { not: "CANCELADO" } }, include: { ...incluirPedido, salida: true } }),
    db.salida.findMany({ where: { fecha: aFecha(fecha) }, include: { vehiculo: true }, orderBy: { orden: "asc" } }),
    db.vehiculo.findMany({ where: { activo: true }, orderBy: { orden: "asc" } }),
    db.usuario.findMany({ where: { rol: "REPARTIDOR", activo: true }, orderBy: { nombre: "asc" } }),
    db.diaCerrado.findUnique({ where: { fecha: aFecha(fecha) } }),
  ]);
  pedidos.sort(porReparto);
  const debe = await clientesConDeuda(pedidos.map((p) => p.clienteId));
  const filas = pedidos.map((p) => aFila(p, debe));
  const salen = new Set(salidas.map((s) => s.vehiculoId));

  const lunes = lunesDe(fecha);
  const domingo = sumarDias(lunes, 6);
  const [cuentaPedidos, cuentaSalidas, cerradosSemana] = await Promise.all([
    db.pedido.groupBy({ by: ["fechaEntrega"], where: { estado: { not: "CANCELADO" }, fechaEntrega: { gte: aFecha(lunes), lte: aFecha(domingo) } }, _count: true }),
    db.salida.groupBy({ by: ["fecha"], where: { fecha: { gte: aFecha(lunes), lte: aFecha(domingo) } }, _count: true }),
    db.diaCerrado.findMany({ where: { fecha: { gte: aFecha(lunes), lte: aFecha(domingo) } } }),
  ]);
  const cerradosSet = new Set(cerradosSemana.map((d) => deFecha(d.fecha)));
  const nPedidos = new Map(cuentaPedidos.map((c) => [c.fechaEntrega ? deFecha(c.fechaEntrega) : "", c._count]));
  const nSalidas = new Map(cuentaSalidas.map((c) => [deFecha(c.fecha), c._count]));
  const fechasSemana = Array.from({ length: 6 }, (_, n) => sumarDias(lunes, n));
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
          lunesTexto={diaMes(lunes)}
          hrefAnterior={`/pedidos/dia/${mismoDia(-1)}`}
          hrefSiguiente={`/pedidos/dia/${mismoDia(1)}`}
          hrefSemana={`/pedidos/semana?semana=${lunes}`}
          dias={fechasSemana.map((f) => ({ fecha: f, texto: `${nombreDia(f).slice(0, 3)} ${Number(f.slice(8))}`, pedidos: nPedidos.get(f) ?? 0, vehiculos: nSalidas.get(f) ?? 0, cerrado: cerradosSet.has(f) }))}
        />

        <h2 className="text-center text-lg font-bold uppercase tracking-wide">Hoja de ruta · {nombreDia(fecha)} {diaMes(fecha)}</h2>

        <HojaDia
          fecha={fecha}
          filasIniciales={filas}
          salidas={salidas.map((s) => ({ id: s.id, nombre: titulo(s.vehiculo.nombre), patente: s.vehiculo.patente ?? "", capacidad: s.vehiculo.capacidad, repartidorId: s.repartidorId ?? "" }))}
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
