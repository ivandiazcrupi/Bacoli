import { diasDeAtraso, partidaDe } from "@/lib/cobranza";
import type { FilaFactura, PuntoCliente } from "@/lib/facturas";
import type { FilaComprobante } from "./ListaComprobantes";

// Las filas de la hoja de comprobantes (la misma en Facturas, Remitos y en la cuenta de cada cliente).

/** Factura o nota de crédito que viene de ARCA. */
export function filaDeArca(f: FilaFactura, puntos: PuntoCliente[]): FilaComprobante {
  const cubierta = !f.esNc && f.aplicado > 0 && f.saldo <= 0.01;
  return {
    id: f.id, clienteId: f.clienteId ?? "", cliente: f.cliente ?? f.razonSocial ?? "—", tipo: "FACTURA", numero: f.esNc ? `NC ${f.numero}` : `F-${f.numero}`, cargado: f.fecha, fecha: f.fecha,
    entregado: true, bruto: f.total, nc: f.aplicado, cubierta, anulado: null, ncTexto: f.creditos.map((c) => `NC ${c.ncNumero}`).join(" · "), monto: f.esNc ? 0 : f.saldo, vence: "", atraso: 0, pagada: f.pagada, medio: f.medio, obs: f.observacion ?? "",
    arca: true, esNc: f.esNc, cuit: f.cuit, saldo: f.saldo, sucursal: f.sucursal, puntoId: f.puntoId, puntos,
    aviso: f.problemas.join(" · "), sinPedido: !f.esNc && !f.pedidoId, pedidoId: f.pedidoId, aplicaciones: f.aplicaciones.map((a) => ({ id: a.id, facturaNumero: a.facturaNumero, monto: a.monto })),
  };
}

type PedidoConPartida = Parameters<typeof partidaDe>[0] & { id: string; estado: string; obsCobro: string | null };

/** Remito de un pedido (pendiente, entregado, anulado o no entregado). */
export function filaDeRemito(p: PedidoConPartida, cliente: { id: string; nombre: string; condicionPago: Parameters<typeof partidaDe>[1] }, hoyStr: string): FilaComprobante {
  const x = partidaDe(p, cliente.condicionPago);
  return {
    id: p.id, clienteId: cliente.id, cliente: cliente.nombre, tipo: "REMITO", numero: x.numero, cargado: x.cargado, fecha: x.fecha,
    entregado: x.entregado, bruto: x.bruto, nc: x.nc, cubierta: x.cubierta, anulado: p.estado === "CANCELADO" ? "Anulado" : p.estado === "NO_ENTREGADO" ? "No entregado" : null, ncTexto: x.ncNumeros.map((n) => `NC ${n}`).join(" · "), monto: x.monto, vence: x.vence, atraso: x.entregado ? diasDeAtraso(x.vence, hoyStr) : 0, pagada: x.pagada, medio: x.medio, obs: p.obsCobro ?? "",
  };
}
