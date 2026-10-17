import { errorSiHojaFija } from "@/lib/dias";

/**
 * ¿Puede el vendedor modificar este pedido? Solo si es de mayorista, sigue pendiente (aunque ya esté asignado a un día y a una camioneta),
 * todavía no tiene remito ni N° de factura y la hoja de ruta de su día se sigue armando (no está lista ni cerrada).
 * Devuelve el motivo en palabras simples, o null si se puede.
 */
export async function errorEdicionVendedor(p: { estado: string; origen: string; remitoNumero: number | null; numeroFactura: string | null; fechaEntrega: Date | null }): Promise<string | null> {
  if (p.origen !== "MAYORISTA") return "Este pedido no se puede modificar desde acá.";
  if (p.estado !== "PENDIENTE") return "El pedido ya se entregó o se canceló: no se puede modificar.";
  if (p.remitoNumero || p.numeroFactura) return "El pedido ya tiene remito o factura emitida: pedile a la oficina que lo modifique.";
  return (await errorSiHojaFija(p.fechaEntrega)) ? "La hoja de ruta de ese día ya está lista para salir: pedile a la oficina que lo modifique." : null;
}
