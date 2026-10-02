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

/** Para las notas importantes: primera letra en mayúscula y el resto en minúscula, se cargue como se cargue ("ENTREGAR en el VECINO" → "Entregar en el vecino"). */
export function oracion(texto: string | null | undefined) {
  const t = (texto ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase("es");
  return t ? t.charAt(0).toLocaleUpperCase("es") + t.slice(1) : "";
}
