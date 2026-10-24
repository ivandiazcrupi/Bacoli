// Estado de pago de un pedido de la tienda, bajo el nombre: verde si ya está pago, rojo si falta.
// Debajo, en gris chico, el día en que el pedido entró al sistema (siempre en su propia línea para que la fila no cambie de forma).
export function EstadoPagoWeb({ webOrden, pagado, medio, ingreso }: { webOrden: string | null; pagado: boolean; medio: string | null; ingreso?: string }) {
  if (!webOrden) return null;
  return (
    <>
      {pagado
        ? <span className="block text-[12px] font-semibold text-verde-700">{medio === "Sin cargo" ? "Sin cargo · no paga" : `Pagado · ${medio ?? "Transferencia"}`}</span>
        : <span className="block text-[12px] font-semibold text-rojo-700">Pendiente de pago</span>}
      {ingreso && <span className="block text-[11px] font-normal leading-tight text-stone-400" title="Día en que entró al sistema">Ingresó {ingreso}</span>}
    </>
  );
}
