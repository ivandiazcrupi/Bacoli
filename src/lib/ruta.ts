/** Orden del reparto de un día: primero por vehículo (en el orden en que salen), después por posición en su recorrido. Sin vehículo, al final. */
type ConRuta = { ordenDia: number; ordenRuta: number; salida: { orden: number } | null };
export const porReparto = (a: ConRuta, b: ConRuta) =>
  (a.salida?.orden ?? 9999) - (b.salida?.orden ?? 9999) || a.ordenRuta - b.ordenRuta || a.ordenDia - b.ordenDia;

/** Cada paquete trae 2 unidades (pedido del dueño: 500 paquetes = 1000 unidades). */
export const UNIDADES_POR_PAQUETE = 2;

/** Paquetes = lo que ocupa un pedido en el vehículo: la suma de sus unidades de venta (paquetes y unidades; el combo napolitano de la tienda cuenta 2 paquetes). */
export const bultosDe = (items: { cantidad: number; sinCargo?: number; paquetesPor?: number }[]) => items.reduce((s, i) => s + (i.cantidad + (i.sinCargo ?? 0)) * (i.paquetesPor ?? 1), 0);

/**
 * Unidades (pizzas) de cada sabor, para producción: paquetes × 2. Tomate = PREPIZZA TOMATE y el combo napolitano (trae 2 paquetes de tomate);
 * cebolla = PREPIZZA CEBOLLA; "otros" = cualquier otro producto, para que la suma siempre dé el total de unidades.
 */
export function unidadesPorSabor(items: { nombre: string; cantidad: number; sinCargo?: number; paquetesPor?: number }[]) {
  const r = { tomate: 0, cebolla: 0, otros: 0 };
  for (const i of items) {
    const u = (i.cantidad + (i.sinCargo ?? 0)) * (i.paquetesPor ?? 1) * UNIDADES_POR_PAQUETE;
    const n = i.nombre.toUpperCase();
    if (n.includes("PREPIZZA TOMATE") || n.includes("COMBO NAPOLITANO")) r.tomate += u;
    else if (n.includes("PREPIZZA CEBOLLA")) r.cebolla += u;
    else r.otros += u;
  }
  return r;
}
