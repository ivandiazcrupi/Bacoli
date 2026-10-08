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

/** Notas importantes y comentarios que se ven en rojo: SIEMPRE en mayúscula, se carguen como se carguen (pedido del dueño). Se aplica al guardar y al mostrar (así también las ya cargadas). */
export function oracion(texto: string | null | undefined) {
  return (texto ?? "").replace(/\s+/g, " ").trim().toLocaleUpperCase("es");
}
