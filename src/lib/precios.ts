export const redondear2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Precio por paquete (sin IVA) que le corresponde a un cliente para un producto:
 * 1. Si tiene precio especial -> ese precio, final (sin descuento encima).
 * 2. Si no -> precio de su lista menos el descuento general del cliente.
 * Devuelve null si no hay de dónde sacar un precio (sin lista o sin precio en la lista).
 */
export function precioParaCliente(opts: { especial?: number | null; precioLista?: number | null; descuentoPct?: number }): number | null {
  const { especial, precioLista, descuentoPct = 0 } = opts;
  if (especial != null) return redondear2(especial);
  return precioLista == null ? null : redondear2(precioLista * (1 - descuentoPct / 100));
}
