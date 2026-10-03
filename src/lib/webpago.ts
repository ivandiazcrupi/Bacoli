/** Pago de un pedido de la tienda online. Los minoristas pagan solo por transferencia y antes de salir de fábrica. */
export type PagoWeb = "PENDIENTE" | "PAGO_MP" | "PAGO_TRANSFERENCIA";

export function webPagado(webOrden: string | null, webPago: string | null): boolean {
  return !!webOrden && !!webPago && webPago !== "PENDIENTE";
}

export function textoPagoWeb(webPago: string | null): string | null {
  if (webPago === "PAGO_MP") return "Mercado Pago";
  if (webPago === "PAGO_TRANSFERENCIA") return "Transferencia";
  return null;
}

export const ERROR_WEB_SIN_PAGO = "Este pedido de la tienda todavía no está pago: no sale de fábrica hasta confirmar la transferencia.";
