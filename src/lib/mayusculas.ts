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
