/** Número de remito con su letra y 4 cifras (pasa a 5 solo al superar 9999): 1 → "R-0001". */
export const formatoRemito = (n: number) => `R-${String(n).padStart(4, "0")}`;

/**
 * Número de factura con su letra y 4 cifras: "123" → "F-0123". Se escriben solo los números; se ignoran letras, guiones y ceros de más.
 * Devuelve null si está vacío y undefined si no tiene ningún número.
 */
export function normalizarFactura(texto: string): string | null | undefined {
  const t = texto.trim();
  if (!t) return null;
  const digitos = t.replace(/\D/g, "").replace(/^0+/, "");
  if (!digitos) return t.replace(/\D/g, "") ? "F-0000" : undefined;
  return `F-${digitos.padStart(4, "0")}`;
}

/** Lo que se escribe en el casillero de factura (sin la F-). */
export const soloNumeroFactura = (guardado: string | null | undefined) => (guardado ?? "").replace(/^F-/i, "");
