import type { CondicionPago, Prisma } from "@prisma/client";
import { importeVigente } from "@/lib/cuenta";
import { aFecha, deFecha, sumarDias } from "@/lib/fechas";
import { formatoRemito } from "@/lib/remito";

const DIAS: Record<CondicionPago, number> = { CONTADO: 0, DIAS_7: 7, DIAS_15: 15, DIAS_30: 30, DIAS_45: 45 };

type PedidoCobranza = Prisma.PedidoGetPayload<{ include: { items: true } }>;

/** Una "partida" de la cuenta: un comprobante (factura o remito) con su monto y su vencimiento. */
export type Partida = {
  id: string;
  fecha: string; // día de entrega "AAAA-MM-DD"
  vence: string;
  tipo: "FACTURA" | "REMITO";
  numero: string | null; // N° de factura o de remito (null si todavía no se cargó / emitió)
  monto: number;
  pagada: boolean;
  medio: string | null;
};

export function partidaDe(p: PedidoCobranza, condicion: CondicionPago): Partida {
  const fecha = p.fechaEntrega ? deFecha(p.fechaEntrega) : deFecha(p.creadoEn);
  return {
    id: p.id,
    fecha,
    vence: sumarDias(fecha, DIAS[condicion]),
    tipo: p.conFactura ? "FACTURA" : "REMITO",
    numero: p.conFactura ? p.numeroFactura : p.remitoNumero ? formatoRemito(p.remitoNumero) : null,
    monto: importeVigente(p.items, Number(p.ivaPct), "ENTREGADO", p.webTotal),
    pagada: p.pagado && p.cobro === "COBRADO",
    medio: p.medioCobro,
  };
}

/** Días de atraso (positivo = vencida) respecto de hoy. */
export const diasDeAtraso = (vence: string, hoy: string) => Math.round((aFecha(hoy).getTime() - aFecha(vence).getTime()) / 86_400_000);
