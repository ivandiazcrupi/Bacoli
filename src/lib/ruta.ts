/** Orden del reparto de un día: primero por vehículo (en el orden en que salen), después por posición en su recorrido. Sin vehículo, al final. */
type ConRuta = { ordenDia: number; ordenRuta: number; salida: { orden: number } | null };
export const porReparto = (a: ConRuta, b: ConRuta) =>
  (a.salida?.orden ?? 9999) - (b.salida?.orden ?? 9999) || a.ordenRuta - b.ordenRuta || a.ordenDia - b.ordenDia;

/** Cada paquete trae 2 unidades (pedido del dueño: 500 paquetes = 1000 unidades). */
export const UNIDADES_POR_PAQUETE = 2;
/** Tope de costo de envío por pizza (pesos): la hoja de ruta avisa si una vuelta se pasa. */
export const TOPE_COSTO_POR_PIZZA = 275;

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

/**
 * Focaccias para producción, separadas por sabor. Cuentan: FOCACCIA (oliva) y FOCACCIA CHERRY, 2 de oliva por cada "COMBO NAPOLITANO + 2 FOCACCIA"
 * (el combo común no trae). Un nombre que termina en "X2" trae 2 unidades por cada una comprada ("FOCACCIA CHERRY Y ROMERO X2" = 2 cherry);
 * "OLIVA + CHERRY … X2" es un pack mixto: una de oliva y una de cherry (X2 = el total del pack, mitad y mitad).
 */
export function focacciasPorTipo(items: RenglonRuta[]) {
  const r = { oliva: 0, cherry: 0 };
  for (const i of items) {
    const nom = sinTildes((i.nombre ?? "").toUpperCase());
    const cant = i.cantidad + (i.sinCargo ?? 0);
    if (nom.includes("COMBO NAPOLITANO")) { if (nom.includes("FOCACCIA")) r.oliva += 2 * i.cantidad; continue; } // solo el combo "+ 2 FOCACCIA" las trae
    const cherry = nom.includes("CHERRY");
    const oliva = nom.includes("OLIVA");
    if (!cherry && !nom.includes("FOCACCIA")) continue;
    const xs = [...nom.matchAll(/\bX\s*(\d+)\b/g)]; // "X2" en cualquier parte del nombre (ej. "… X2 UNIDADES", "(X2)")
    const x = xs.length ? xs[xs.length - 1] : null;
    const mixto = cherry && oliva;
    const unidades = x ? Number(x[1]) : mixto ? 2 : 1; // unidades que trae cada una comprada (el pack mixto sin "X" trae 1 de cada)
    if (mixto) { r.oliva += cant * (unidades / 2); r.cherry += cant * (unidades / 2); } // pack mixto
    else if (cherry) r.cherry += cant * unidades;
    else r.oliva += cant * unidades;
  }
  return r;
}

/** Total de focaccias (oliva + cherry). */
export function focacciasDe(items: RenglonRuta[]) {
  const f = focacciasPorTipo(items);
  return f.oliva + f.cherry;
}

export const totalUnidades = (x: { tomate: number; cebolla: number; pizzas: number }) => x.tomate + x.cebolla + x.pizzas;

/** Paquetes de pizza = unidades ÷ 2 (una pizza por unidad es medio paquete): así Paquetes × 2 = Unidades siempre. */
export const bultosDe = (items: RenglonRuta[]) => totalUnidades(unidadesPorSabor(items)) / UNIDADES_POR_PAQUETE;

/** A dónde ir para "ubicar" un pedido: la hoja de ruta de su día (resaltado) o, si espera día, la lista de Pedidos. Cancelado: ningún lado. */
export function enlaceUbicar(p: { id: string; estado: string; fechaEntrega: Date | null }): string | null {
  if (p.estado === "CANCELADO") return null;
  if (p.fechaEntrega) return `/pedidos/dia/${p.fechaEntrega.toISOString().slice(0, 10)}?ver=${p.id}`;
  if (p.estado === "PENDIENTE" || p.estado === "NO_ENTREGADO") return `/pedidos?ver=${p.id}`;
  return null;
}
