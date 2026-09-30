import { mayus } from "./mayusculas";
import { cuitValido } from "./numeros";

// ---------- Lectura del CSV ----------

/** Lee un CSV (separado por ; o ,), con comillas y BOM. Devuelve filas como objetos con encabezados normalizados. */
export function leerCsv(texto: string): Record<string, string>[] {
  const t = texto.replace(/^﻿/, "");
  const primera = t.split(/\r?\n/, 1)[0] ?? "";
  const sep = (primera.match(/;/g)?.length ?? 0) >= (primera.match(/,/g)?.length ?? 0) ? ";" : ",";

  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entreComillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (entreComillas) {
      if (c === '"' && t[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') entreComillas = false;
      else celda += c;
    } else if (c === '"') entreComillas = true;
    else if (c === sep) { fila.push(celda); celda = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      fila.push(celda); celda = "";
      if (fila.some((x) => x.trim())) filas.push(fila);
      fila = [];
    } else celda += c;
  }
  fila.push(celda);
  if (fila.some((x) => x.trim())) filas.push(fila);
  if (filas.length < 2) return [];

  const encabezados = filas[0].map((h) => norm(h).toLowerCase());
  return filas.slice(1).map((f) => Object.fromEntries(encabezados.map((h, i) => [h, (f[i] ?? "").trim()])));
}

// ---------- Normalización ----------

export const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

// Quita tildes pero conserva la Ñ ("NUÑEZ").
function normBarrioBase(s: string) {
  return s
    .normalize("NFC")
    .replace(/[ñÑ]/g, "\u0001")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0001/g, "Ñ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const ALIAS_BARRIO: Record<string, string> = {
  "BERAZARETGUI": "BERAZATEGUI",
  "ING. MASTWICHZ": "ING. MASCHWITZ",
  "MASCHWITZ": "ING. MASCHWITZ",
  "PQE. AVELLANEDA": "PARQUE AVELLANEDA",
  "PQE. CHACABUCO": "PARQUE CHACABUCO",
  "PQUE CHACABUCO": "PARQUE CHACABUCO",
  "V. DEL PARQUE": "VILLA DEL PARQUE",
  "VILLA PUEYRR.": "VILLA PUEYRREDON",
  "MARMOL": "JOSE MARMOL",
  "M. ARGENTINAS": "MALVINAS ARGENTINAS",
  "R. DE ESCALADA": "REMEDIOS DE ESCALADA",
  "MICROCENTRO": "CENTRO",
  "LOMAS": "LOMAS DE ZAMORA",
};

/** Unifica variantes del mismo barrio: quita "(2)" o " 2" finales, abreviaturas y errores de tipeo conocidos. */
export function barrioCanonico(texto: string) {
  let b = normBarrioBase(texto).replace(/\s*\(\d+\)\s*$/, "").replace(/\s+\d+$/, "").trim();
  b = ALIAS_BARRIO[b] ?? b;
  return b;
}

export function tituloBarrio(canonico: string) {
  const chicas = new Set(["DE", "DEL", "LA", "LAS", "LOS", "Y"]);
  return canonico
    .toLowerCase()
    .split(" ")
    .map((p, i) => (i > 0 && chicas.has(p.toUpperCase()) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

// ---------- Propuesta de zona por barrio (se puede corregir en la vista previa) ----------

const ZONAS_PROPUESTAS: Record<string, string[]> = {
  CABA: [
    "ALMAGRO", "BALVANERA", "BARRACAS", "BARRIO NORTE", "BELGRANO", "BOEDO", "CABALLITO", "CAÑITAS", "CENTRO", "CHACARITA",
    "COLEGIALES", "DEVOTO", "FLORES", "FLORESTA", "LA BOCA", "LINIERS", "MATADEROS", "MONSERRAT", "MONTE CASTRO", "NUÑEZ", "ONCE",
    "PALERMO", "PARQUE AVELLANEDA", "PARQUE CHACABUCO", "PARQUE PATRICIOS", "PASEO LA PLAZA", "PATERNAL", "PUERTO MADERO",
    "RECOLETA", "RETIRO", "SAAVEDRA", "SALGUERO", "SAN CRISTOBAL", "SAN NICOLAS", "SAN TELMO", "SCALABRINI ORTIZ", "VILLA CRESPO",
    "VILLA DEL PARQUE", "VILLA DEVOTO", "VILLA GRAL MITRE", "VILLA LUGANO", "VILLA LURO", "VILLA ORTUZAR", "VILLA PUEYRREDON",
    "VILLA URQUIZA", "MARKET BERUTI",
  ],
  "ZONA NORTE": [
    "BECCAR", "BENAVIDEZ", "BOULOGNE", "CAMPANA", "DEL VISO", "ESCOBAR", "FLORIDA", "GARIN", "GENERAL PACHECO", "ING. MASCHWITZ",
    "LA LUCILA", "LOMA VERDE", "MALVINAS ARGENTINAS", "MANUEL ALBERTI", "MARTINEZ", "MUNRO", "NORDELTA", "OLIVOS", "PACHECO",
    "PILAR", "SAN FERNANDO", "SAN ISIDRO", "SAN MARTIN", "TIGRE", "TORTUGAS", "TORTUGUITAS", "VICENTE LOPEZ", "VICTORIA",
    "VILLA BALLESTER", "VILLA LYNCH", "ZARATE",
  ],
  "ZONA OESTE": ["BELLA VISTA", "CASEROS", "CASTELAR", "HURLINGHAM", "ITUZAINGO", "LA REJA", "LUJAN", "MERLO", "MORENO", "MORON", "RAMOS MEJIA", "SAN JUSTO", "SAN MIGUEL", "VILLA TESEI"],
  "ZONA SUR": [
    "ADROGUE", "AVELLANEDA", "BANFIELD", "BERAZATEGUI", "BERNAL", "BRANDSEN", "CANNING", "CITY BELL", "DON BOSCO", "FLORENCIO VARELA",
    "JOSE MARMOL", "LA PLATA", "LANUS", "LOMAS DE ZAMORA", "MONTE GRANDE", "QUILMES", "REMEDIOS DE ESCALADA", "SAN VICENTE", "TEMPERLEY", "WILDE",
  ],
};

const ZONA_POR_BARRIO = new Map<string, string>(
  Object.entries(ZONAS_PROPUESTAS).flatMap(([zona, barrios]) => barrios.map((b) => [normBarrioBase(b), zona] as const)),
);

export function zonaPropuesta(barrioCanon: string): string | null {
  return ZONA_POR_BARRIO.get(barrioCanon) ?? null;
}

// ---------- Análisis ----------

export type Opciones = {
  marcas: string[]; // nombres de marca que se agrupan en un solo cliente (ej. VACALIN)
  separarMismoCuit: boolean; // false = las franquicias con el mismo CUIT quedan en un solo cliente
  bajaYContactar: "DESACTIVADOS" | "NO_IMPORTAR";
};

export const MARCAS_INICIALES = ["VACALIN", "PARMEGIANO", "ABASTECEDOR", "BAQUIANO"];
export const OPCIONES_INICIALES: Opciones = { marcas: MARCAS_INICIALES, separarMismoCuit: false, bajaYContactar: "DESACTIVADOS" };

export type SucursalImport = { alias: string | null; direccion: string; barrio: string; telefono: string | null; activo: boolean };
export type ClienteImport = {
  nombre: string;
  tipo: "MAYORISTA";
  lista: string; // lista de precios: "Distribuidor", el nombre de la marca si existe una lista así, o "Mayorista"
  marca: string | null;
  razonSocial: string | null;
  cuit: string | null;
  activo: boolean;
  comisionista: string | null;
  comisionPct: number | null;
  sucursales: SucursalImport[];
};
export type Analisis = {
  clientes: ClienteImport[];
  excluidos: { nombre: string; motivo: string }[];
  avisos: string[];
  barrios: { barrio: string; titulo: string; filas: number; propuesta: string | null }[];
};

type Fila = {
  nombre: string;
  tipo: "MAYORISTA" | "DISTRIBUIDOR";
  migue: boolean;
  direccion: string;
  barrio: string;
  telefono: string | null;
  razon: string | null;
  cuit: string | null;
  estado: "ACTIVO" | "BAJA" | "CONTACTAR";
};

const limpiar = (s: string) => s.replace(/\s+/g, " ").trim();
const soloDigitos = (s: string) => s.replace(/\D/g, "");

export function analizar(filasCsv: Record<string, string>[], opciones: Opciones): Analisis {
  const avisos: string[] = [];
  const excluidos: Analisis["excluidos"] = [];
  const filas: Fila[] = [];

  for (const f of filasCsv) {
    const nombre = mayus(f["nombre"] ?? "");
    if (!nombre) {
      avisos.push(`Fila sin nombre (dirección "${f["direccion"] ?? ""}"): no se importó.`);
      continue;
    }
    const tipoTexto = norm(f["cliente"] ?? "");

    if (/COBRO|MUESTRA/.test(tipoTexto)) {
      excluidos.push({ nombre, motivo: `No es un cliente ("${f["cliente"]}"): irá como parada de cobranza o muestra en la hoja de ruta.` });
      continue;
    }

    // Dirección: se quitan las notas entre paréntesis (horarios, avisos).
    let direccion = mayus((f["direccion"] ?? "").replace(/\([^)]*\)/g, ""));
    if ((f["direccion"] ?? "").includes("(")) avisos.push(`${nombre}: se quitó una nota de la dirección ("${f["direccion"]}").`);
    if (!direccion || /^MAYOR\.?$/i.test(direccion)) {
      avisos.push(`${nombre}: sin dirección válida ("${f["direccion"] ?? ""}"). Se carga como "Sin dirección".`);
      direccion = "SIN DIRECCIÓN";
    }

    const cuitTexto = f["cuit"] ?? "";
    let cuit: string | null = null;
    if (cuitTexto.trim()) {
      if (cuitValido(cuitTexto)) cuit = soloDigitos(cuitTexto);
      else avisos.push(`${nombre}: el CUIT "${cuitTexto}" no es válido y no se importó.`);
    }

    const razonCruda = mayus(f["razon social"] ?? "");
    const razon = razonCruda && !/ENVIO/i.test(norm(razonCruda)) && !/^[\d\s()+-]+$/.test(razonCruda) ? razonCruda : null;

    const estadoTexto = norm(f["estado"] ?? "");
    const estado: Fila["estado"] = /BAJA/.test(estadoTexto) ? "BAJA" : /CONTACT|PERSONALM/.test(estadoTexto) ? "CONTACTAR" : "ACTIVO";
    if (estadoTexto && !/^(ACTIVO|BAJA|CONTACTAR)$/.test(estadoTexto)) avisos.push(`${nombre}: estado raro "${f["estado"]}" (se interpretó como ${estado.toLowerCase()}).`);

    let tel = limpiar(f["telefono"] ?? "");
    if (/\bhs?\b/i.test(tel)) {
      avisos.push(`${nombre}: el teléfono "${tel}" parece un horario y no se importó.`);
      tel = "";
    }
    filas.push({
      nombre,
      tipo: /DIST/.test(tipoTexto) ? "DISTRIBUIDOR" : "MAYORISTA",
      migue: /MIGUE/.test(tipoTexto),
      direccion,
      barrio: barrioCanonico(f["zona"] ?? "") || "SIN BARRIO",
      telefono: /\d/.test(tel) ? tel : null,
      razon,
      cuit,
      estado,
    });
  }

  // Si hay razón social igual a la de otra fila con CUIT válido, se hereda ese CUIT (corrige CUIT mal escritos o vacíos).
  const cuitPorRazon = new Map<string, string>();
  for (const f of filas) if (f.cuit && f.razon) cuitPorRazon.set(norm(f.razon), f.cuit);
  for (const f of filas) if (!f.cuit && f.razon && cuitPorRazon.has(norm(f.razon))) f.cuit = cuitPorRazon.get(norm(f.razon))!;

  const marcas = opciones.marcas.map((m) => norm(m)).filter(Boolean);
  const marcaDe = (nombre: string) => marcas.find((m) => { const n = norm(nombre); return n === m || n.startsWith(m + " ") || n.startsWith(m + "-"); });

  const grupos = new Map<string, { marca?: string; filas: Fila[] }>();
  filas.forEach((f, i) => {
    const marca = marcaDe(f.nombre);
    // Marca: un cliente por CUIT (las filas sin CUIT son el cliente "principal"). Otros nombres: solo si son idénticos.
    const clave = marca
      ? `M|${marca}|${f.cuit ? (opciones.separarMismoCuit ? `fila${i}` : f.cuit) : ""}`
      : `N|${norm(f.nombre)}`;
    if (!grupos.has(clave)) grupos.set(clave, { marca, filas: [] });
    grupos.get(clave)!.filas.push(f);
  });

  const clientes: ClienteImport[] = [];
  for (const g of grupos.values()) {
    const activasOSinBaja = opciones.bajaYContactar === "NO_IMPORTAR" ? g.filas.filter((f) => f.estado === "ACTIVO") : g.filas;
    if (activasOSinBaja.length === 0) {
      excluidos.push({ nombre: g.filas[0].nombre, motivo: "Estado baja o contactar, y elegiste no importarlos." });
      continue;
    }
    const cuits = [...new Set(activasOSinBaja.map((f) => f.cuit).filter((x): x is string => !!x))];
    if (!g.marca && cuits.length > 1) avisos.push(`${activasOSinBaja[0].nombre}: sus filas tienen CUITs distintos (${cuits.join(", ")}). Se usó el primero.`);
    const razon = activasOSinBaja.map((f) => f.razon).find(Boolean) ?? null;

    let nombre = activasOSinBaja[0].nombre;
    if (g.marca) {
      const base = g.marca;
      nombre = !cuits[0] ? base : razon && norm(razon).startsWith(base) ? razon : `${base} - ${razon ?? `CUIT ${cuits[0]}`}`;
    }

    const migue = activasOSinBaja.some((f) => f.migue);
    const sucursales = activasOSinBaja.map((f) => {
      let alias: string | null = null;
      if (g.marca) {
        const resto = limpiar(f.nombre.replace(new RegExp(`^${g.marca.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*-?\\s*`, "i"), ""));
        alias = resto ? mayus(resto) : null;
      }
      return { alias, direccion: f.direccion, barrio: f.barrio, telefono: f.telefono, activo: f.estado === "ACTIVO" };
    });

    clientes.push({
      nombre,
      tipo: "MAYORISTA",
      lista: activasOSinBaja.some((f) => f.tipo === "DISTRIBUIDOR") ? "Distribuidor" : g.marca ? g.marca : "Mayorista",
      marca: g.marca ?? null,
      razonSocial: razon,
      cuit: cuits[0] ?? null,
      activo: sucursales.some((s) => s.activo),
      comisionista: migue ? "Migue" : null,
      comisionPct: migue ? 8 : null,
      sucursales,
    });
  }

  const conteoBarrios = new Map<string, number>();
  for (const c of clientes) for (const s of c.sucursales) conteoBarrios.set(s.barrio, (conteoBarrios.get(s.barrio) ?? 0) + 1);
  const barrios = [...conteoBarrios.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "es"))
    .map(([barrio, filas]) => ({ barrio, titulo: tituloBarrio(barrio), filas, propuesta: zonaPropuesta(barrio) }));

  clientes.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return { clientes, excluidos, avisos, barrios };
}
