import { db } from "@/lib/db";
import { aFecha } from "@/lib/fechas";
import { focacciasPorTipo, TOPE_COSTO_POR_PIZZA, unidadesPorSabor } from "@/lib/ruta";

/** Costo logístico GENERAL de un día: lo que cuestan las camionetas con pedidos ÷ las unidades que llevan (pizzas, prepizzas y focaccias). */
export async function costoLogisticoDelDia(fecha: string) {
  const f = aFecha(fecha);
  const [pedidos, salidas, empresa, aprobacion] = await Promise.all([
    db.pedido.findMany({ where: { fechaEntrega: f, estado: { not: "CANCELADO" }, salidaId: { not: null } }, include: { items: { include: { producto: { select: { orden: true } } } } } }),
    db.salida.findMany({ where: { fecha: f } }),
    db.empresa.findUnique({ where: { id: "principal" }, select: { costoLogisticoUnidad: true } }),
    db.aprobacionCosto.findUnique({ where: { fecha: f } }),
  ]);
  const tope = Number(empresa?.costoLogisticoUnidad ?? TOPE_COSTO_POR_PIZZA);
  const conPedidos = salidas.filter((sa) => pedidos.some((p) => p.salidaId === sa.id));
  const faltan = conPedidos.filter((sa) => sa.costoLogistica === null).length;
  const costo = conPedidos.reduce((t, sa) => t + Number(sa.costoLogistica ?? 0), 0);
  const unidades = pedidos.reduce((t, p) => { const a = unidadesPorSabor(p.items); const x = focacciasPorTipo(p.items); return t + a.tomate + a.cebolla + a.pizzas + x.oliva + x.cherry; }, 0);
  const porUnidad = faltan === 0 && unidades > 0 ? costo / unidades : null;
  const sePasa = porUnidad !== null && porUnidad > tope;
  // La aprobación solo vale si el costo y las unidades siguen siendo los que se aprobaron.
  const aprobado = !!aprobacion && Math.abs(Number(aprobacion.costoDia) - costo) < 0.005 && aprobacion.unidades === unidades;
  return { costo, unidades, porUnidad, tope, sePasa, faltan, aprobacion, aprobado, hayCamionetas: conPedidos.length > 0 };
}
