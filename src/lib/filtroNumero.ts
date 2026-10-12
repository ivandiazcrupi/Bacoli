/** Filtro numérico de las tablas: "15" (exacto), ">15", ">=15", "<7", "<=7". Una celda sin dato (null) no cumple ningún número; mientras se escribe (ej. ">") no filtra. */
export function coincideNumero(valor: number | null, filtro: string) {
  const t = filtro.trim();
  if (!t) return true;
  const m = t.match(/^(>=|<=|>|<|=)?\s*(\d+(?:[.,]\d+)?)$/);
  if (!m) return true;
  if (valor === null) return false;
  const n = Number(m[2].replace(",", "."));
  switch (m[1]) { case ">": return valor > n; case ">=": return valor >= n; case "<": return valor < n; case "<=": return valor <= n; default: return valor === n; }
}
