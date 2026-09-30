import type { Prisma } from "@prisma/client";
import { importeVigente } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { titulo } from "@/lib/mayusculas";
import { formatoRemito } from "@/lib/remito";
import type { Fila } from "./dia/[fecha]/HojaDia";

// Cómo se leen los pedidos en las hojas (Sin asignar y cada día). Se comparte entre la página de Pedidos y la del día.
export const incluirPedido = { cliente: true, punto: true, items: { orderBy: { producto: { orden: "asc" } } } } satisfies Prisma.PedidoInclude;
export type PedidoCompleto = Prisma.PedidoGetPayload<{ include: typeof incluirPedido }>;

export type FilaBandeja = {
  id: string;
  barrio: string;
  cliente: string;
  direccion: string;
  telefono: string;
  items: { nombre: string; cantidad: number }[];
  monto: number;
  conFactura: boolean;
};

const nombreCliente = (p: PedidoCompleto) => (p.punto.alias && !p.cliente.nombre.includes(p.punto.alias) ? `${p.cliente.nombre} · ${p.punto.alias}` : p.cliente.nombre);

/** Marca de deuda: clientes con saldo a favor de la empresa (el monto se ve en su cuenta corriente). */
export async function clientesConDeuda(clienteIds: string[]) {
  if (clienteIds.length === 0) return new Set<string>();
  const saldos = await db.movimientoCuenta.groupBy({ by: ["clienteId"], where: { clienteId: { in: [...new Set(clienteIds)] } }, _sum: { monto: true } });
  return new Set(saldos.filter((s) => Number(s._sum.monto ?? 0) > 0.005).map((s) => s.clienteId));
}

export function aFila(p: PedidoCompleto, debe: Set<string>): Fila {
  return {
    id: p.id,
    clienteId: p.clienteId,
    barrio: p.punto.barrio,
    cliente: nombreCliente(p),
    direccion: titulo(p.punto.direccion),
    telefono: p.punto.telefono ?? "",
    items: p.items.map((i) => ({ nombre: i.nombre, cantidad: p.estado === "ENTREGADO" ? (i.cantidadEntregada ?? i.cantidad) : i.cantidad })),
    monto: importeVigente(p.items, Number(p.ivaPct), p.estado === "ENTREGADO" ? "ENTREGADO" : "PENDIENTE"),
    conFactura: p.conFactura,
    numeroFactura: p.numeroFactura ?? "",
    estado: p.estado as Fila["estado"],
    cobro: p.cobro,
    medioCobro: p.medioCobro,
    tieneDeuda: debe.has(p.clienteId),
    remito: p.remitoNumero ? formatoRemito(p.remitoNumero) : null,
  };
}

export function aFilaBandeja(p: PedidoCompleto): FilaBandeja {
  return {
    id: p.id,
    barrio: p.punto.barrio,
    cliente: nombreCliente(p),
    direccion: titulo(p.punto.direccion),
    telefono: p.punto.telefono ?? "",
    items: p.items.map((i) => ({ nombre: i.nombre, cantidad: i.cantidad })),
    monto: importeVigente(p.items, Number(p.ivaPct), "PENDIENTE"),
    conFactura: p.conFactura,
  };
}
