// Producción de fábrica. Todo en UNIDADES (1 paquete de prepizza = 2 unidades), igual que los contadores de la hoja de ruta.
export const PRODUCTOS_PRODUCCION = [
  { id: "TOMATE", nombre: "PREPIZZA TOMATE" },
  { id: "CEBOLLA", nombre: "PREPIZZA CEBOLLA" },
  { id: "PIZZA", nombre: "PIZZAS (muzzarella, jamón, fugazzeta)" },
  { id: "FOCACCIA_OLIVA", nombre: "FOCACCIA OLIVA" },
  { id: "FOCACCIA_CHERRY", nombre: "FOCACCIA CHERRY" },
] as const;

export type ProductoProduccion = (typeof PRODUCTOS_PRODUCCION)[number]["id"];
export const IDS_PRODUCCION: string[] = PRODUCTOS_PRODUCCION.map((p) => p.id);
export const nombreProducto = (id: string) => PRODUCTOS_PRODUCCION.find((p) => p.id === id)?.nombre ?? id;

const ZONA = "America/Argentina/Buenos_Aires";
/** Hora "13:30" (24 hs, Argentina). */
export const horaArg = (d: Date) => new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
/** Hora entera (0-23) en Argentina. */
export const horaEnteraArg = (d: Date) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: ZONA, hour: "2-digit", hourCycle: "h23" }).format(d));

export const minutosATexto = (m: number) => (m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`);

type Tanda = { producto: string; cantidad: number; desperdicio: number; inicio: Date | null; fin: Date | null };

/** Resumen de un producto: producido, desperdicio, tandas, unidades por hora y tiempo promedio de una tanda. */
export function resumirProducto(tandas: Tanda[]) {
  const cerradas = tandas.filter((t) => t.fin);
  const producido = cerradas.reduce((s, t) => s + t.cantidad, 0);
  const desperdicio = cerradas.reduce((s, t) => s + t.desperdicio, 0);
  const conTiempo = cerradas.filter((t) => t.inicio && t.fin && t.fin > t.inicio);
  const minutos = conTiempo.reduce((s, t) => s + (t.fin!.getTime() - t.inicio!.getTime()) / 60000, 0);
  const unidadesConTiempo = conTiempo.reduce((s, t) => s + t.cantidad, 0);
  return {
    producido,
    desperdicio,
    tandas: cerradas.length,
    pctDesperdicio: producido + desperdicio > 0 ? (desperdicio / (producido + desperdicio)) * 100 : 0,
    porHora: minutos > 0 ? unidadesConTiempo / (minutos / 60) : null,
    minutosPorTanda: conTiempo.length > 0 ? minutos / conTiempo.length : null,
  };
}
