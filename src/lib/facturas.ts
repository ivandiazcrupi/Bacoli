import { importeVigente } from "@/lib/cuenta";
import { db } from "@/lib/db";

// Las facturas y notas de crédito vienen de ARCA (ComprobanteArca). Acá se arma lo que se muestra en CUENTA CORRIENTE → FACTURAS:
// a qué pedido corresponde cada una (por NÚMERO EXACTO), si está cobrada, qué notas de crédito la bajan y qué controles saltan.

export const soloDigitos = (t: string | null | undefined) => (t ?? "").replace(/\D/g, "");
const redondear2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** El número que se escribe en la hoja de ruta (F-4525, o 0001-00000012 en los viejos) → el número de factura. */
export function numeroDeFactura(t: string | null | undefined): number | null {
  const s = (t ?? "").replace(/^F-/i, "").trim();
  const n = parseInt((s.includes("-") ? s.split("-").pop()! : s).replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

export type FilaFactura = {
  id: string;
  esNc: boolean;
  tipo: number;
  puntoVenta: number;
  numero: number;
  fecha: string; // AAAA-MM-DD
  cuit: string | null;
  razonSocial: string | null;
  clienteId: string | null;
  cliente: string | null; // nombre del cliente en el sistema (buscado por CUIT)
  total: number;
  puntoId: string | null;
  sucursal: string | null; // barrio de la sucursal (del pedido, o la que se eligió a mano)
  observacion: string | null;
  pedidoId: string | null;
  pedidoEntregado: boolean;
  pagada: boolean;
  medio: string | null;
  obsCobro: string | null;
  creditos: { id: string; ncId: string; ncNumero: number; monto: number; motivo: string | null }[]; // notas que bajan esta factura
  aplicado: number; // factura: suma de notas aplicadas · nota: cuánto de la nota ya se aplicó
  aplicaciones: { id: string; facturaId: string; facturaNumero: number; monto: number; motivo: string | null }[]; // nota: a qué facturas se aplicó
  saldo: number; // factura: lo que falta cobrar · nota: lo que queda por aplicar
  problemas: string[];
};

export type PuntoCliente = { id: string; barrio: string; direccion: string };

export async function cargarFacturas() {
  const [arca, pedidos, clientes] = await Promise.all([
    db.comprobanteArca.findMany({ include: { notasAplicadas: true, creditosRecibidos: true }, orderBy: [{ fecha: "asc" }, { numero: "asc" }] }),
    db.pedido.findMany({ where: { conFactura: true, numeroFactura: { not: null }, clienteId: { not: null } }, include: { items: true, cliente: true, punto: true } }),
    db.cliente.findMany({ where: { cuit: { not: null } }, select: { id: true, nombre: true, cuit: true, puntos: { where: { activo: true }, select: { id: true, barrio: true, direccion: true }, orderBy: { barrio: "asc" } } } }),
  ]);
  const porCuit = new Map(clientes.map((c) => [soloDigitos(c.cuit), c]));
  const puntosPorId = new Map(clientes.flatMap((c) => c.puntos.map((p) => [p.id, p] as const)));
  const idNumero = new Map(arca.map((a) => [a.id, a.numero]));

  const facturas = arca.filter((a) => !a.esNotaCredito);
  const porNumero = new Map<number, (typeof facturas)[number]>();
  for (const f of facturas) if (!porNumero.has(f.numero)) porNumero.set(f.numero, f);

  // Cruce EXACTO por número: pedido ↔ factura de ARCA.
  const pedidoDe = new Map<string, (typeof pedidos)[number]>();
  const sinArca: typeof pedidos = [];
  const minNum = facturas.length ? Math.min(...facturas.map((f) => f.numero)) : 0;
  const maxNum = facturas.length ? Math.max(...facturas.map((f) => f.numero)) : 0;
  for (const p of pedidos) {
    const n = numeroDeFactura(p.numeroFactura);
    if (n === null) continue;
    const f = porNumero.get(n);
    if (f) pedidoDe.set(f.id, p);
    else if (facturas.length && n >= minNum && n <= maxNum) sinArca.push(p);
  }

  const filas: FilaFactura[] = arca.map((a) => {
    const total = Number(a.total);
    const cuit = a.cuitReceptor;
    const cli = cuit ? porCuit.get(cuit) : undefined;
    const pedido = a.esNotaCredito ? undefined : pedidoDe.get(a.id);
    const aplicado = redondear2(a.esNotaCredito ? a.notasAplicadas.reduce((t, x) => t + Number(x.monto), 0) : a.creditosRecibidos.reduce((t, x) => t + Number(x.monto), 0));
    const pagada = !a.esNotaCredito && (a.pagado || pedido?.cobro === "COBRADO");
    const problemas: string[] = [];
    if (pedido) {
      const totalPedido = importeVigente(pedido.items, Number(pedido.ivaPct), pedido.estado === "ENTREGADO" ? "ENTREGADO" : "PENDIENTE", pedido.webTotal);
      const cuitPedido = soloDigitos(pedido.cliente?.cuit);
      if (!cuitPedido) problemas.push("El cliente del pedido no tiene CUIT cargado");
      else if (cuit && cuitPedido !== cuit) problemas.push(`CUIT distinto: el cliente tiene ${pedido.cliente?.cuit} y ARCA ${cuit}`);
      if (Math.abs(totalPedido - total) > 1) problemas.push(`Importe distinto: el pedido dice ${totalPedido.toLocaleString("es-AR", { minimumFractionDigits: 2 })} y ARCA ${total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`);
      if (pedido.estado === "CANCELADO") problemas.push("El pedido está cancelado pero la factura existe en ARCA");
    }
    // Lo que se eligió a mano manda ("-" = ninguna sucursal); si no se eligió nada, la del pedido.
    const punto = a.puntoId === "-" ? undefined : a.puntoId ? puntosPorId.get(a.puntoId) ?? pedido?.punto : pedido?.punto;
    return {
      id: a.id, esNc: a.esNotaCredito, tipo: a.tipo, puntoVenta: a.puntoVenta, numero: a.numero, fecha: a.fecha.toISOString().slice(0, 10), cuit, razonSocial: a.razonSocial,
      clienteId: cli?.id ?? null, cliente: cli?.nombre ?? null, total, puntoId: a.puntoId, sucursal: punto?.barrio ?? null, observacion: a.observacion,
      pedidoId: pedido?.id ?? null, pedidoEntregado: pedido?.estado === "ENTREGADO", pagada, medio: a.medioCobro ?? (pedido?.cobro === "COBRADO" ? pedido.medioCobro : null), obsCobro: a.obsCobro,
      creditos: a.creditosRecibidos.map((x) => ({ id: x.id, ncId: x.ncId, ncNumero: idNumero.get(x.ncId) ?? 0, monto: Number(x.monto), motivo: x.motivo })),
      aplicado,
      aplicaciones: a.notasAplicadas.map((x) => ({ id: x.id, facturaId: x.facturaId, facturaNumero: idNumero.get(x.facturaId) ?? 0, monto: Number(x.monto), motivo: x.motivo })),
      saldo: redondear2(total - aplicado),
      problemas,
    };
  });

  const controles = {
    sinPedido: filas.filter((f) => !f.esNc && !f.pedidoId),
    sinArca,
    conDiferencias: filas.filter((f) => f.problemas.length > 0),
    ncSinAplicar: filas.filter((f) => f.esNc && f.saldo > 0.01),
  };
  return { filas, controles, clientes: new Map(clientes.map((c) => [c.id, c])), puntosDeCuit: (cuit: string | null): PuntoCliente[] => (cuit ? porCuit.get(cuit)?.puntos ?? [] : []) };
}
