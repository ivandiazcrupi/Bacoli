/** Número de remito con su letra y 4 cifras (pasa a 5 solo al superar 9999): 1 → "R-0001". */
export const formatoRemito = (n: number) => `R-${String(n).padStart(4, "0")}`;

/**
 * Número de factura con su letra y exactamente 4 cifras: "123" → "F-0123". Solo se aceptan números, hasta 4 cifras
 * (cuando se llegue a 9999 se amplía). Devuelve null si está vacío y undefined si no es válido.
 */
export function normalizarFactura(texto: string): string | null | undefined {
  const t = texto.trim().replace(/^F-/i, "");
  if (!t) return null;
  if (!/^\d{1,4}$/.test(t)) return undefined;
  return `F-${t.padStart(4, "0")}`;
}

/** Lo que se escribe en el casillero de factura (sin la F-). */
export const soloNumeroFactura = (guardado: string | null | undefined) => (guardado ?? "").replace(/^F-/i, "");
