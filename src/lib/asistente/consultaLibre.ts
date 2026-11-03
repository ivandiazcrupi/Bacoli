import "server-only";
import { PrismaClient } from "@prisma/client";

// Consulta libre del asistente: la IA escribe una consulta SQL y esta función la corre CON UN USUARIO DE SOLO LECTURA de la base
// (DATABASE_URL_SOLO_LECTURA). La defensa de verdad es ese usuario (solo puede leer algunas tablas); lo de acá es un cinturón extra.

export const consultaLibreDisponible = () => !!process.env.DATABASE_URL_SOLO_LECTURA;

const MAX_FILAS = 200;
const MAX_TEXTO = 14_000; // caracteres de resultado que se le devuelven a la IA

let cliente: PrismaClient | null = null;
function soloLectura() {
  const url = process.env.DATABASE_URL_SOLO_LECTURA;
  if (!url) throw new Error("Falta DATABASE_URL_SOLO_LECTURA");
  cliente ??= new PrismaClient({ datasourceUrl: url });
  return cliente;
}

// Palabras que una consulta de lectura nunca necesita.
const PROHIBIDAS = /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|call|execute|vacuum|analyze|reset|listen|notify|lock|comment|refresh|merge|pg_sleep|pg_read_file|pg_ls_dir|lo_import|lo_export|dblink|set_config|pg_terminate_backend|pg_cancel_backend)\b|\bset\s+(session|local|role|transaction)\b/i;

// Columnas de plata: con los totales bloqueados (sin la contraseña de Estadísticas) la IA no puede leerlas.
const PLATA = /\b(precio|descuentopct|ivapct|webtotal|webextra|cobrarmonto|montocobrado|monto|total|importe|saldo|costologistica|costologisticounidad|comisionpct|comision)\b/;

/** Devuelve la consulta lista para correr, o un texto con el motivo si no se puede. */
function revisar(sql: string, bloqueado: boolean): { ok: true; sql: string } | { ok: false; error: string } {
  const sinLiterales = sql.replace(/'(?:[^']|'')*'/g, "''"); // lo que está entre comillas simples es texto, no instrucciones
  if (/--|\/\*/.test(sinLiterales)) return { ok: false, error: "No uses comentarios (-- o /* */) en la consulta." };
  const cuerpo = sinLiterales.trim().replace(/;+\s*$/, "");
  if (cuerpo.includes(";")) return { ok: false, error: "Una sola consulta por vez (sin punto y coma en el medio)." };
  if (!/^(select|with)\b/i.test(cuerpo)) return { ok: false, error: "Solo se permiten consultas SELECT (o WITH … SELECT)." };
  if (PROHIBIDAS.test(cuerpo)) return { ok: false, error: "La consulta tiene instrucciones que no están permitidas (solo lectura)." };
  if (bloqueado) {
    const plano = cuerpo.toLowerCase().replace(/"/g, "");
    if (PLATA.test(plano)) return { ok: false, error: "BLOQUEADO: los montos en pesos están bloqueados (hay que ingresar la contraseña de Estadísticas). Podés consultar cantidades, fechas y clientes, pero no columnas de plata." };
    if (/select\s+(distinct\s+)?\*|,\s*\*|\.\*|\bto_jsonb?\s*\(|\brow_to_json\s*\(/.test(plano)) return { ok: false, error: "BLOQUEADO: con los totales bloqueados hay que nombrar las columnas (sin * ni to_json), porque algunas son de plata." };
  }
  return { ok: true, sql: sql.trim().replace(/;+\s*$/, "") };
}

export type ResultadoConsulta = { ok: true; filas: unknown[]; texto: string; truncado: boolean } | { ok: false; error: string };

export async function ejecutarConsulta(sql: string, bloqueado: boolean): Promise<ResultadoConsulta> {
  const r = revisar(sql, bloqueado);
  if (!r.ok) return r;
  try {
    const filas = (await soloLectura().$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '8000'");
        return tx.$queryRawUnsafe(`SELECT * FROM (${r.sql}) AS consulta LIMIT ${MAX_FILAS + 1}`);
      },
      { timeout: 15_000, maxWait: 5_000 },
    )) as unknown[];
    let truncado = filas.length > MAX_FILAS;
    const dato = truncado ? filas.slice(0, MAX_FILAS) : filas;
    let texto = JSON.stringify(dato, (_, v) => (typeof v === "bigint" ? Number(v) : v));
    if (texto.length > MAX_TEXTO) { texto = texto.slice(0, MAX_TEXTO) + "…"; truncado = true; }
    return { ok: true, filas: dato, texto, truncado };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `La base rechazó la consulta: ${msg.replace(/\s+/g, " ").slice(0, 400)}` };
  }
}

// Para probar la revisión sin base de datos.
export const _revisarParaPruebas = revisar;
