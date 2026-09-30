/** Número de remito con su letra: 1 → "R-000001". */
export const formatoRemito = (n: number) => `R-${String(n).padStart(6, "0")}`;
