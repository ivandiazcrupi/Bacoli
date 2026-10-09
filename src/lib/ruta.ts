/** Orden del reparto de un día: primero por vehículo (en el orden en que salen), después por posición en su recorrido. Sin vehículo, al final. */
type ConRuta = { ordenDia: number; ordenRuta: number; salida: { orden: number } | null };
export const porReparto = (a: ConRuta, b: ConRuta) =>
  (a.salida?.orden ?? 9999) - (b.salida?.orden ?? 9999) || a.ordenRuta - b.ordenRuta || a.ordenDia - b.ordenDia;

/** Cada paquete trae 2 unidades (pedido del dueño: 500 paquetes = 1000 unidades). */
export const UNIDADES_POR_PAQUETE = 2;

type RenglonRuta = { nombre?: string; unidad?: string; cantidad: number; sinCargo?: number; paquetesPor?: number };

/** Un número de paquetes con coma si es medio paquete (12,5). */
export const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));

type Clase = "tomate" | "cebolla" | "pizzas";
const sinTildes = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Qué cuenta como pizza para producción: PREPIZZA TOMATE (con el combo napolitano) y PREPIZZA CEBOLLA, y las pizzas por unidad
 * (PIZZA MUZZARELLA, PIZZA JAMÓN, PIZZA FUGAZZETA). Todo lo demás (pizzeta, focaccia, envío, productos de la tienda…) no cuenta.
 */
const claseDe = (nombre = ""): Clase | null => {
  const n = sinTildes(nombre.toUpperCase());
  if (n.includes("PREPIZZA TOMATE") || n.includes("COMBO NAPOLITANO")) return "tomate";
  if (n.includes("PREPIZZA CEBOLLA")) return "cebolla";
  if (/PIZZA (MUZZARELLA|JAMON|FUGAZZETA)/.test(n)) return "pizzas";
  return null;
};

/** Pizzas (unidades) de un renglón: un paquete son 2 pizzas; por unidad, 1 pizza (el combo napolitano son 2 paquetes = 4 pizzas). */
const pizzasDe = (i: RenglonRuta) => (i.cantidad + (i.sinCargo ?? 0)) * (i.paquetesPor ?? 1) * (i.unidad === "unidad" ? 1 : UNIDADES_POR_PAQUETE);

/**
 * Pizzas (unidades) por clase, para producción. Cualquier otro producto no suma.
 */
export function unidadesPorSabor(items: RenglonRuta[]) {
  const r = { tomate: 0, cebolla: 0, pizzas: 0 };
  for (const i of items) {
    const c = claseDe(i.nombre);
    if (c) r[c] += pizzasDe(i);
  }
  return r;
}

/** Focaccias para producción: las de FOCACCIA y 2 por cada COMBO NAPOLITANO (el combo las trae gratis). */
export function focacciasDe(items: RenglonRuta[]) {
  let n = 0;
  for (const i of items) {
    const nom = sinTildes((i.nombre ?? "").toUpperCase());
    if (nom.includes("COMBO NAPOLITANO")) n += 2 * i.cantidad;
    else if (nom.includes("FOCACCIA")) n += i.cantidad + (i.sinCargo ?? 0);
  }
  return n;
}

export const totalUnidades = (x: { tomate: number; cebolla: number; pizzas: number }) => x.tomate + x.cebolla + x.pizzas;

/** Paquetes de pizza = unidades ÷ 2 (una pizza por unidad es medio paquete): así Paquetes × 2 = Unidades siempre. */
export const bultosDe = (items: RenglonRuta[]) => totalUnidades(unidadesPorSabor(items)) / UNIDADES_POR_PAQUETE;
