/** Texto de datos (nombres, direcciones, barrios…): siempre en mayúscula, con espacios prolijos. Conserva tildes y Ñ. */
export function mayus(texto: string): string;
export function mayus(texto: string | null | undefined): string | null;
export function mayus(texto: string | null | undefined) {
  if (texto == null) return null;
  const t = texto.replace(/\s+/g, " ").trim().toLocaleUpperCase("es");
  return t;
}
