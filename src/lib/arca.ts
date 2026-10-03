// Lectura del archivo "Mis Comprobantes Emitidos" de ARCA (CSV). Tolera separador ; , o tabulación, comillas, fechas AAAA-MM-DD o DD/MM/AAAA
// y montos con coma o punto. Las columnas se buscan por su nombre, no por su posición.

export type FilaArca = {
  tipo: number;
  puntoVenta: number;
  numero: number;
  fecha: string; // AAAA-MM-DD
  cuitReceptor: string | null;
  razonSocial: string | null;
  total: number;
  cae: string | null;
  esNotaCredito: boolean;
};

// Códigos de comprobante de ARCA.
const NC = new Set([3, 8, 13, 53, 21, 203, 208, 213]); // notas de crédito (A, B, C, M, E y de crédito electrónica)
const ND = new Set([2, 7, 12, 52, 20, 202, 207, 212]); // notas de débito: se ignoran por ahora

const limpiar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Texto del archivo: UTF-8 y, si trae caracteres rotos, Windows-1252 (como suele bajar ARCA). */
export function decodificar(bytes: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(bytes) : utf8.replace(/^﻿/, "");
}

function filasCsv(texto: string): string[][] {
  const primera = texto.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", "\t", ","].map((c) => [c, primera.split(c).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let entre = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entre) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') entre = false;
      else campo += c;
    } else if (c === '"') entre = true;
    else if (c === sep) { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.some((x) => x.trim() !== "")) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  fila.push(campo);
  if (fila.some((x) => x.trim() !== "")) filas.push(fila);
  return filas;
}

export function leerNumeroArca(t: string): number {
  let s = t.trim().replace(/[^\d.,-]/g, "");
  if (!s) return NaN;
  const coma = s.lastIndexOf(","), punto = s.lastIndexOf(".");
  if (coma >= 0 && punto >= 0) s = coma > punto ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (coma >= 0) s = s.replace(",", ".");
  else if (punto >= 0 && !/^-?\d+\.\d{1,2}$/.test(s)) s = s.replace(/\./g, ""); // 1.234.567 = miles
  return Number(s);
}

function fechaIso(t: string): string | null {
  const s = t.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

export type ResultadoLectura = { filas: FilaArca[]; ignoradas: number; errores: string[] };

export function leerArchivoArca(texto: string): ResultadoLectura {
  const filas = filasCsv(texto);
  if (filas.length < 2) return { filas: [], ignoradas: 0, errores: ["El archivo está vacío o no tiene filas."] };
  const enc = filas[0].map(limpiar);
  const col = (...claves: string[]) => enc.findIndex((h) => claves.every((c) => h.includes(c)));
  const iFecha = col("fecha");
  const iTipo = enc.findIndex((h) => h.startsWith("tipo") && !h.includes("doc") && !h.includes("cambio"));
  const iPto = col("punto", "venta");
  const iNum = enc.findIndex((h) => h.includes("numero") && (h.includes("desde") || !h.includes("hasta")));
  const iCae = col("autoriz");
  const iDoc = enc.findIndex((h) => h.includes("nro") && h.includes("doc"));
  const iDen = col("denominacion");
  const iTotal = enc.findIndex((h) => h.includes("total") && h.startsWith("imp"));
  const faltan = [["fecha", iFecha], ["tipo de comprobante", iTipo], ["punto de venta", iPto], ["número", iNum], ["importe total", iTotal]].filter(([, i]) => i === -1).map(([n]) => n);
  if (faltan.length) return { filas: [], ignoradas: 0, errores: [`No encontré estas columnas en el archivo: ${faltan.join(", ")}. ¿Es el de "Mis Comprobantes Emitidos"?`] };

  const salida: FilaArca[] = [];
  const errores: string[] = [];
  let ignoradas = 0;
  filas.slice(1).forEach((f, n) => {
    const tipo = parseInt(f[iTipo] ?? "", 10);
    const fecha = fechaIso(f[iFecha] ?? "");
    const numero = parseInt((f[iNum] ?? "").replace(/\D/g, ""), 10);
    const pto = parseInt((f[iPto] ?? "").replace(/\D/g, ""), 10);
    const total = leerNumeroArca(f[iTotal] ?? "");
    if (!Number.isFinite(tipo) || !fecha || !Number.isFinite(numero) || !Number.isFinite(pto) || !Number.isFinite(total)) {
      errores.push(`Fila ${n + 2}: no se pudo leer (${(f.slice(0, 4).join(" | ")).slice(0, 80)}).`);
      return;
    }
    if (ND.has(tipo)) { ignoradas++; return; }
    const esNc = NC.has(tipo);
    const cuit = iDoc >= 0 ? (f[iDoc] ?? "").replace(/\D/g, "") : "";
    salida.push({ tipo, puntoVenta: pto, numero, fecha, cuitReceptor: cuit || null, razonSocial: iDen >= 0 ? (f[iDen] ?? "").trim() || null : null, total: Math.abs(total), cae: iCae >= 0 ? (f[iCae] ?? "").trim() || null : null, esNotaCredito: esNc });
  });
  return { filas: salida, ignoradas, errores };
}

const LETRA: Record<number, string> = { 1: "A", 3: "A", 6: "B", 8: "B", 11: "C", 13: "C", 51: "M", 53: "M" };
export const nombreComprobante = (tipo: number) => `${NC.has(tipo) ? "Nota de crédito" : "Factura"} ${LETRA[tipo] ?? ""}`.trim();
