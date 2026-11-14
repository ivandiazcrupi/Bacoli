/** Texto de datos (nombres, direcciones, barrios…): siempre en mayúscula, con espacios prolijos. Conserva tildes y Ñ. */
export function mayus(texto: string): string;
export function mayus(texto: string | null | undefined): string | null;
export function mayus(texto: string | null | undefined) {
  if (texto == null) return null;
  const t = texto.replace(/\s+/g, " ").trim().toLocaleUpperCase("es");
  return t;
}

/** Para leer mejor: primera letra de cada palabra en mayúscula ("MAURICIO PELLEGRINI 774" → "Mauricio Pellegrini 774"). */
export function titulo(texto: string | null | undefined) {
  if (!texto) return "";
  return texto
    .toLocaleLowerCase("es")
    .replace(/(^|[\s\-\/.(])(\p{L})/gu, (_, antes: string, letra: string) => antes + letra.toLocaleUpperCase("es"));
}

// Siglas que se dejan en mayúscula dentro de una nota.
const SIGLAS = new Set(["NC", "ND", "OC", "OP", "CABA", "IVA", "CUIT", "ARCA", "SA", "SRL", "SAS", "GBA", "NRO"]);

/**
 * Notas, comentarios de sucursal y motivos que se ven en rojo, prolijos (pedido del dueño): "EN CAJA - HACER 3 REMITOS" → "En caja - Hacer 3 remitos".
 * Mayúscula al empezar y después de punto, guion, barra, ? y !; códigos con números (OC0215…, 2B) y siglas (NC, OP, CABA…) quedan en mayúscula;
 * el guion queda con un espacio a cada lado. Se puede aplicar las veces que sea: el resultado no cambia. Se usa al guardar y al mostrar (así también las notas viejas en mayúscula).
 */
export function oracion(texto: string | null | undefined) {
  let s = (texto ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  s = s.replace(/\s*-\s*/g, " - ").replace(/(\d)\s*\/\s*(\d)/g, "$1/$2").replace(/\s+([,.;:?!])/g, "$1");
  s = s.split(" ").map((p) => {
    const limpio = p.replace(/[^\p{L}\p{N}]/gu, "");
    if (/\d/.test(limpio) || SIGLAS.has(limpio.toUpperCase())) return p.toLocaleUpperCase("es");
    return p.toLocaleLowerCase("es");
  }).join(" ");
  return s.replace(/(^|[.!?]\s+|\s-\s|\s?\/\s?)(\p{L})/gu, (_, antes: string, letra: string) => antes + letra.toLocaleUpperCase("es"));
}
