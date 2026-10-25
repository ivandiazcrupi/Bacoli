/** Lee un monto escrito a la argentina ("3.500", "3.500,50", "3500.5"). Devuelve null si está vacío o no es válido. */
export function leerMonto(texto: string | undefined | null): number | null {
  if (!texto) return null;
  let t = texto.replace(/[\s$]/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function formatoPesos(n: number | string | { toString(): string }) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(Number(n));
}

/** CUIT válido: 11 dígitos con dígito verificador correcto. Acepta guiones. */
export function cuitValido(texto: string) {
  const d = texto.replace(/\D/g, "");
  if (d.length !== 11) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(d[i]), 0);
  const resto = 11 - (suma % 11);
  const verificador = resto === 11 ? 0 : resto === 10 ? 9 : resto;
  return verificador === Number(d[10]);
}

/** Mientras se escribe un monto: pone el punto de miles solo ("100000" → "100.000"; los decimales van con coma: "1.500,5"). */
export function milesEscribiendo(texto: string) {
  const [ent, ...resto] = texto.replace(/[^\d,]/g, "").split(",");
  const miles = ent.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return resto.length ? `${miles},${resto.join("").slice(0, 2)}` : miles;
}

/** Un monto que viene de la base ("110000" o "110000.5") listo para mostrar en un campo: "110.000" / "110.000,5". */
export function milesDeBase(valor: string | number | null | undefined) {
  if (valor === null || valor === undefined || valor === "") return "";
  const n = Number(valor);
  return Number.isFinite(n) ? n.toLocaleString("es-AR", { maximumFractionDigits: 2 }) : "";
}
