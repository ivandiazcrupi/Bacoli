/** Orden del reparto de un día: primero por vehículo (en el orden en que salen), después por posición en su recorrido. Sin vehículo, al final. */
type ConRuta = { ordenDia: number; ordenRuta: number; salida: { orden: number } | null };
export const porReparto = (a: ConRuta, b: ConRuta) =>
  (a.salida?.orden ?? 9999) - (b.salida?.orden ?? 9999) || a.ordenRuta - b.ordenRuta || a.ordenDia - b.ordenDia;

/** Paquetes = lo que ocupa un pedido en el vehículo: la suma de sus unidades de venta (paquetes y unidades; el combo napolitano de la tienda cuenta 2 paquetes). */
export const bultosDe = (items: { cantidad: number; paquetesPor?: number }[]) => items.reduce((s, i) => s + i.cantidad * (i.paquetesPor ?? 1), 0);
