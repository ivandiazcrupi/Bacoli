import type { Prisma } from "@prisma/client";
import { importeVigente } from "@/lib/cuenta";
import { bultosDe } from "@/lib/ruta";
import { db } from "@/lib/db";
import { oracion, titulo } from "@/lib/mayusculas";
import { formatoRemito } from "@/lib/remito";
import type { Fila } from "./dia/[fecha]/HojaDia";

// Cómo se leen los pedidos en las hojas (Sin asignar y cada día). Se comparte entre la página de Pedidos y la del día.
export const incluirPedido = { cliente: true, punto: true, items: { include: { producto: { select: { orden: true } } } } } satisfies Prisma.PedidoInclude;
export type PedidoCompleto = Prisma.PedidoGetPayload<{ include: typeof incluirPedido }>;

/** Los renglones en el orden del catálogo; los que no son del catálogo (combo, otros de la tienda) van al final. */
export const ordenarItems = <T extends { producto?: { orden: number } | null }>(items: T[]) => [...items].sort((a, b) => (a.producto?.orden ?? 999) - (b.producto?.orden ?? 999));

/** Quién recibe el pedido: un cliente con su sucursal (mayorista) o los datos escritos en el mismo pedido (tienda online). */
export function datosEntrega(p: { cliente: { nombre: string } | null; punto: { alias: string | null; barrio: string; direccion: string; comentario: string | null; telefono: string | null } | null; webNombre: string | null; webBarrio: string | null; webDireccion: string | null; webTelefono: string | null }) {
  if (p.cliente && p.punto) {
    // Solo el nombre del cliente: el barrio ya tiene su propia columna (el alias de la sucursal no se muestra).
    return { nombre: p.cliente.nombre, barrio: p.punto.barrio, direccion: titulo(p.punto.direccion), comentario: p.punto.comentario ?? "", telefono: p.punto.telefono ?? "" };
  }
  return { nombre: p.webNombre ?? "", barrio: p.webBarrio ?? "", direccion: titulo(p.webDireccion), comentario: "", telefono: p.webTelefono ?? "" };
}

/** Lo que se ve en rojo debajo de la dirección: el comentario de la sucursal y la nota importante del pedido ("Entregar en el vecino"). */
const avisos = (comentario: string, nota: string | null) => [comentario, oracion(nota)].filter(Boolean).join(" · ");

/** Un renglón para las hojas: cantidad a entregar (cobrada + sin cargo) y, si hay, cuántos van sin cargo. */
const renglonHoja = (i: { nombre: string; cantidad: number; sinCargo: number }, cantidad: number) => ({
  nombre: i.sinCargo > 0 ? `${i.nombre} (${i.sinCargo} sin cargo)` : i.nombre,
  cantidad: cantidad + i.sinCargo,
});

export type FilaBandeja = {
  id: string;
  barrio: string;
  cliente: string;
  direccion: string;
  comentario: string;
  telefono: string;
  items: { nombre: string; cantidad: number }[];
  monto: number;
  conFactura: boolean;
  webOrden: string | null; // N° de orden de Empretienda (solo pedidos de la tienda)
  pagoMp: boolean; // pedido de la tienda ya pagado con Mercado Pago
  intento?: string; // "No se entregó el 1/10 · Local cerrado": el último intento que falló, si lo hubo
};

/** Marca de deuda: clientes con saldo a favor de la empresa (el monto se ve en su cuenta corriente). */
export async function clientesConDeuda(clienteIds: string[]) {
  if (clienteIds.length === 0) return new Set<string>();
  const saldos = await db.movimientoCuenta.groupBy({ by: ["clienteId"], where: { clienteId: { in: [...new Set(clienteIds)] } }, _sum: { monto: true } });
  return new Set(saldos.filter((s) => Number(s._sum.monto ?? 0) > 0.005).map((s) => s.clienteId));
}

export function aFila(p: PedidoCompleto, debe: Set<string>): Fila {
  const d = datosEntrega(p);
  const items = ordenarItems(p.items);
  return {
    id: p.id,
    clienteId: p.clienteId,
    barrio: d.barrio,
    cliente: d.nombre,
    direccion: d.direccion,
    comentario: avisos(d.comentario, p.nota),
    telefono: d.telefono,
    items: items.map((i) => renglonHoja(i, p.estado === "ENTREGADO" ? (i.cantidadEntregada ?? i.cantidad) : i.cantidad)),
    monto: importeVigente(p.items, Number(p.ivaPct), p.estado === "ENTREGADO" ? "ENTREGADO" : "PENDIENTE", p.webTotal),
    conFactura: p.conFactura,
    numeroFactura: p.numeroFactura ?? "",
    estado: p.estado as Fila["estado"],
    cobro: p.cobro,
    medioCobro: p.medioCobro,
    tieneDeuda: p.clienteId ? debe.has(p.clienteId) : false,
    remito: p.remitoNumero ? formatoRemito(p.remitoNumero) : null,
    salidaId: p.salidaId,
    bultos: bultosDe(p.items),
    webOrden: p.webOrden,
    pagoMp: p.webPago === "PAGO_MP",
  };
}

export function aFilaBandeja(p: PedidoCompleto, intento = ""): FilaBandeja {
  const d = datosEntrega(p);
  return {
    id: p.id,
    barrio: d.barrio,
    cliente: d.nombre,
    direccion: d.direccion,
    comentario: avisos(d.comentario, p.nota),
    telefono: d.telefono,
    items: ordenarItems(p.items).map((i) => renglonHoja(i, i.cantidad)),
    monto: importeVigente(p.items, Number(p.ivaPct), "PENDIENTE", p.webTotal),
    conFactura: p.conFactura,
    webOrden: p.webOrden,
    pagoMp: p.webPago === "PAGO_MP",
    intento,
  };
}
