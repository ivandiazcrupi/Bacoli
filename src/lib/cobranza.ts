import type { CondicionPago, Prisma } from "@prisma/client";
import { importeVigente } from "@/lib/cuenta";
import { aFecha, deFecha, sumarDias } from "@/lib/fechas";
import { formatoRemito } from "@/lib/remito";

const DIAS: Record<CondicionPago, number> = { CONTADO: 0, DIAS_7: 7, DIAS_15: 15, DIAS_30: 30, DIAS_45: 45 };

type PedidoCobranza = Prisma.PedidoGetPayload<{ include: { items: true; ncAplicaciones: true } }>;

/** Para traer junto con el pedido solo las notas de crédito vigentes (no anuladas). */
export const incluirNc = { ncAplicaciones: { where: { nota: { anuladaEn: null } } } } as const;

/** Una "partida" de la cuenta: un comprobante (factura o remito) con su monto y su vencimiento. */
export type Partida = {
  id: string;
  cargado: string; // día en que se cargó el pedido
  fecha: string; // día de entrega (previsto o real) "AAAA-MM-DD"
  entregado: boolean; // false = cargado pero todavía por entregar
  vence: string;
  tipo: "FACTURA" | "REMITO";
  numero: string | null; // N° de factura o de remito (null si todavía no se cargó / emitió)
  bruto: number; // lo que dice el pedido
  nc: number; // notas de crédito aplicadas
  monto: number; // lo que realmente se debe (bruto − nc)
  cubierta: boolean; // una NC lo cubre entero
  pagada: boolean;
  medio: string | null;
};

export function partidaDe(p: PedidoCobranza, condicion: CondicionPago): Partida {
  const cargado = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" }).format(p.creadoEn);
  const fecha = p.fechaEntrega ? deFecha(p.fechaEntrega) : cargado;
  const entregado = p.estado === "ENTREGADO";
  const bruto = importeVigente(p.items, Number(p.ivaPct), entregado ? "ENTREGADO" : "PENDIENTE", p.webTotal);
  const nc = p.ncAplicaciones.reduce((t, a) => t + Number(a.monto), 0);
  return {
    id: p.id,
    cargado,
    entregado,
    fecha,
    vence: sumarDias(fecha, DIAS[condicion]),
    tipo: p.conFactura ? "FACTURA" : "REMITO",
    numero: p.conFactura ? p.numeroFactura : p.remitoNumero ? formatoRemito(p.remitoNumero) : null,
    bruto,
    nc,
    monto: Math.max(0, Math.round((bruto - nc) * 100) / 100),
    cubierta: bruto > 0 && nc + 0.005 >= bruto,
    pagada: p.pagado && p.cobro === "COBRADO",
    medio: p.medioCobro,
  };
}

/** Días de atraso (positivo = vencida) respecto de hoy. */
export const diasDeAtraso = (vence: string, hoy: string) => Math.round((aFecha(hoy).getTime() - aFecha(vence).getTime()) / 86_400_000);
