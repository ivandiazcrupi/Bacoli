/** Orden del reparto de un día: primero por vehículo (en el orden en que salen), después por posición en su recorrido. Sin vehículo, al final. */
type ConRuta = { ordenDia: number; ordenRuta: number; salida: { orden: number } | null };
export const porReparto = (a: ConRuta, b: ConRuta) =>
  (a.salida?.orden ?? 9999) - (b.salida?.orden ?? 9999) || a.ordenRuta - b.ordenRuta || a.ordenDia - b.ordenDia;

/** Cada paquete trae 2 unidades (pedido del dueño: 500 paquetes = 1000 unidades). */
export const UNIDADES_POR_PAQUETE = 2;

type RenglonRuta = { nombre?: string; unidad?: string; cantidad: number; sinCargo?: number; paquetesPor?: number };

/** Prepizza de tomate (incluye el combo napolitano) o de cebolla: lo único que se cuenta como pizza para producción. */
const saborDe = (nombre = ""): "tomate" | "cebolla" | null => {
  const n = nombre.toUpperCase();
  if (n.includes("PREPIZZA TOMATE") || n.includes("COMBO NAPOLITANO")) return "tomate";
  if (n.includes("PREPIZZA CEBOLLA")) return "cebolla";
  return null;
};

/**
 * Paquetes = lo que ocupa un pedido en el vehículo: la suma de sus unidades de venta (paquetes y unidades; el combo napolitano de la tienda cuenta 2 paquetes).
 * Una prepizza vendida por unidad (cliente que pide por unidad) ocupa medio paquete.
 */
export const bultosDe = (items: RenglonRuta[]) =>
  Math.ceil(items.reduce((s, i) => s + (i.cantidad + (i.sinCargo ?? 0)) * (i.paquetesPor ?? 1) * (i.unidad === "unidad" && saborDe(i.nombre) ? 1 / UNIDADES_POR_PAQUETE : 1), 0));

/**
 * Pizzas (unidades) de cada sabor, para producción. Solo cuentan PREPIZZA TOMATE (con el combo napolitano: 2 paquetes = 4 pizzas) y PREPIZZA CEBOLLA;
 * un paquete son 2 pizzas, salvo que se venda por unidad (1 pizza). Cualquier otro producto (de la tienda o escrito a mano) no cuenta como pizza.
 */
export function unidadesPorSabor(items: RenglonRuta[]) {
  const r = { tomate: 0, cebolla: 0 };
  for (const i of items) {
    const sabor = saborDe(i.nombre);
    if (!sabor) continue;
    r[sabor] += (i.cantidad + (i.sinCargo ?? 0)) * (i.paquetesPor ?? 1) * (i.unidad === "unidad" ? 1 : UNIDADES_POR_PAQUETE);
  }
  return r;
}
