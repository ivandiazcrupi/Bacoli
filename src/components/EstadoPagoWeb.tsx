// Estado de pago de un pedido de la tienda, bajo el nombre: verde si ya está pago, rojo si falta.
export function EstadoPagoWeb({ webOrden, pagado, medio }: { webOrden: string | null; pagado: boolean; medio: string | null }) {
  if (!webOrden) return null;
  return pagado
    ? <span className="block text-[12px] font-semibold text-verde-700">Pagado · {medio ?? "Transferencia"}</span>
    : <span className="block text-[12px] font-semibold text-rojo-700">Pendiente de pago</span>;
}
