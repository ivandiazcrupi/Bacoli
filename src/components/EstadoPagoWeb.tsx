// Estado de pago de un pedido de la tienda, bajo el nombre: verde si ya está pago, rojo si falta.
// Al final, en gris chico, el día en que el pedido entró al sistema.
export function EstadoPagoWeb({ webOrden, pagado, medio, ingreso }: { webOrden: string | null; pagado: boolean; medio: string | null; ingreso?: string }) {
  if (!webOrden) return null;
  const fecha = ingreso ? <span className="ml-1.5 font-normal text-stone-400" title="Día en que entró al sistema">· {ingreso}</span> : null;
  return pagado
    ? <span className="block text-[12px] font-semibold text-verde-700">Pagado · {medio ?? "Transferencia"}{fecha}</span>
    : <span className="block text-[12px] font-semibold text-rojo-700">Pendiente de pago{fecha}</span>;
}
