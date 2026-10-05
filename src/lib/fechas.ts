// Fechas de calendario ("2026-10-06") sin hora, para el tablero de la semana. Todo en UTC para que no corra un día.

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export const aFecha = (s: string) => new Date(`${s}T00:00:00Z`);
export const deFecha = (d: Date) => d.toISOString().slice(0, 10);

/** Hoy en Argentina, como "YYYY-MM-DD". */
export function hoy() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

export function sumarDias(s: string, n: number) {
  const d = aFecha(s);
  d.setUTCDate(d.getUTCDate() + n);
  return deFecha(d);
}

/**
 * Primer día (martes) de la semana de esa fecha. La semana de BACOLI va de MARTES a LUNES: se produce hasta el sábado y esa
 * producción se entrega el lunes siguiente. El domingo no se reparte: queda dentro de la semana que termina el lunes.
 */
export function inicioSemana(s: string) {
  const dia = aFecha(s).getUTCDay(); // 0 = domingo
  return sumarDias(s, -((dia - 2 + 7) % 7));
}

/** Los seis días de reparto de la semana que empieza ese martes: MAR · MIÉ · JUE · VIE · SÁB · LUN (el domingo no va). */
export const diasDeSemana = (inicio: string) => [0, 1, 2, 3, 4, 6].map((n) => sumarDias(inicio, n));

/** Último día (lunes) de la semana que empieza ese martes. */
export const finDeSemana = (inicio: string) => sumarDias(inicio, 6);

/**
 * Martes de la semana que se muestra al entrar: la de hoy. Los lunes (último día de la semana, cuando ya se está armando la que
 * viene) se abre la semana siguiente; el lunes de hoy se ve con la flecha ←.
 */
export function semanaDeTrabajo() {
  const h = hoy();
  return aFecha(h).getUTCDay() === 1 ? sumarDias(h, 1) : inicioSemana(h);
}

export function esFechaValida(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(aFecha(s).getTime()) && deFecha(aFecha(s)) === s;
}

export const nombreDia = (s: string) => DIAS[aFecha(s).getUTCDay()];
export const diaMes = (s: string) => `${aFecha(s).getUTCDate()}/${aFecha(s).getUTCMonth() + 1}`;
