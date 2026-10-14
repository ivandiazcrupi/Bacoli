import { desgloseIva } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { sumarDias } from "@/lib/fechas";
import { bultosDe } from "@/lib/ruta";

const fechaAR = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

export type Venta = { pedidoId: string; f: string; clienteId: string; cliente: string; vendedorId: string | null; paq: number; neto: number };

/**
 * Ventas de pedidos ENTREGADOS de clientes mayoristas entre dos fechas (desde incluida, hasta excluida), sin IVA, cada una con el
 * vendedor que tenía el cliente EN ESA FECHA (por el historial de cambios aprobados: un cambio de vendedor no mueve las ventas viejas).
 * Cada pedido cuenta en el día de entrega (o, si no tiene, el de carga), igual que en Gráficos.
 */
export async function ventasEntregadas(desde: string, hasta: string): Promise<Venta[]> {
  const d0 = new Date(`${desde}T00:00:00Z`), d1 = new Date(`${hasta}T00:00:00Z`);
  const c0 = new Date(`${desde}T03:00:00Z`), c1 = new Date(`${hasta}T03:00:00Z`); // creadoEn es un instante: el día argentino empieza a las 03:00 UTC
  const pedidos = await db.pedido.findMany({
    where: {
      estado: "ENTREGADO", origen: "MAYORISTA", clienteId: { not: null },
      OR: [{ fechaEntrega: { gte: d0, lt: d1 } }, { fechaEntrega: null, creadoEn: { gte: c0, lt: c1 } }],
    },
    include: { items: true, cliente: { select: { id: true, nombre: true, vendedorId: true } } },
  });
  const ids = [...new Set(pedidos.map((p) => p.clienteId!))];
  const cambios = await db.asignacionVendedor.findMany({ where: { clienteId: { in: ids }, estado: "APROBADA" }, orderBy: { resueltoEn: "asc" } });
  const porCliente = new Map<string, typeof cambios>();
  for (const c of cambios) porCliente.set(c.clienteId, [...(porCliente.get(c.clienteId) ?? []), c]);

  return pedidos.map((p) => {
    const f = p.fechaEntrega ? p.fechaEntrega.toISOString().slice(0, 10) : fechaAR(p.creadoEn);
    const base = desgloseIva(p.items, Number(p.ivaPct), p.estado).base;
    const fijo = p.webTotal != null ? Number(p.webTotal) : null; // comprobantes cargados directo valen su total
    const neto = fijo != null ? (Number(p.ivaPct) > 0 ? fijo / (1 + Number(p.ivaPct) / 100) : fijo) : base;
    return { pedidoId: p.id, f, clienteId: p.clienteId!, cliente: p.cliente!.nombre, vendedorId: vendedorEn(porCliente.get(p.clienteId!) ?? [], f, p.cliente!.vendedorId), paq: bultosDe(p.items), neto };
  });
}

type Cambio = { vendedorId: string | null; anteriorId: string | null; resueltoEn: Date | null; desde?: string | null };

/** Vendedor que tenía un cliente en una fecha, según sus cambios aprobados (el vendedor actual si no hubo cambios). */
export function vendedorEn(cambios: Cambio[], f: string, actual: string | null): string | null {
  if (cambios.length === 0) return actual;
  const dia = (c: Cambio) => c.desde ?? fechaAR(c.resueltoEn!); // el día desde el que vale (si no se eligió, el de la aprobación)
  let vigente: string | null | undefined;
  for (const c of [...cambios].sort((a, b) => dia(a).localeCompare(dia(b)))) if (dia(c) <= f) vigente = c.vendedorId;
  return vigente !== undefined ? vigente : cambios[0].anteriorId; // antes del primer cambio: el que tenía entonces
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const nombreMes = (m: string) => `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
export const mesSiguiente = (m: string) => sumarDias(`${m}-01`, 32).slice(0, 7);
export const mesAnterior = (m: string) => sumarDias(`${m}-01`, -1).slice(0, 7);
export const etiquetaMes = (m: string) => MESES[Number(m.slice(5)) - 1].slice(0, 3);
