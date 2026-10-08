import { db } from "@/lib/db";
import { mayus, titulo } from "@/lib/mayusculas";

/**
 * Pedidos de la tienda online (Empretienda). La planilla "Minorista" se llena sola con los mails de cada orden; el sistema la lee
 * (enlace "publicado en la web" en formato CSV, solo lectura) y arma un pedido por cada N° de orden nuevo. Una vez cargado, el pedido
 * es del sistema: si después cambia la planilla, no se vuelve a leer. No tiene cuenta corriente.
 */

export type RenglonPlanilla = { producto: string; tomate: number; cebolla: number };
export type PedidoPlanilla = { orden: string; localidad: string; cliente: string; direccion: string; telefono: string; monto: number | null; estado: string; renglones: RenglonPlanilla[] };

export type ItemNuevo = { productoId: string | null; nombre: string; sku: string | null; unidad: string; cantidad: number; paquetesPor: number };

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();

/** CSV con comillas, comas y saltos de línea dentro de una celda. */
export function leerCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entre = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entre) {
      if (c === '"' && texto[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') entre = false;
      else celda += c;
    } else if (c === '"') entre = true;
    else if (c === ",") { fila.push(celda); celda = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(celda); filas.push(fila); fila = []; celda = "";
    } else celda += c;
  }
  if (celda !== "" || fila.length) { fila.push(celda); filas.push(fila); }
  return filas;
}

/** "$31.018" → 31018 · "$ 1.234,50" → 1234.5 · "31018" → 31018 */
export function leerPlata(t: string): number | null {
  const limpio = t.replace(/[^\d.,]/g, "");
  if (!limpio) return null;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(limpio)) return Number(limpio.replace(/\./g, "").replace(",", "."));
  if (limpio.includes(",")) return Number(limpio.replace(/\./g, "").replace(",", "."));
  return Number(limpio);
}

const entero = (t: string) => {
  const n = parseInt(String(t ?? "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};

/** Agrupa las filas de la planilla: un pedido empieza en la fila que trae el N° de pedido y sigue en las de abajo que tienen producto. */
export function leerPlanilla(csv: string): PedidoPlanilla[] {
  const filas = leerCsv(csv);
  const cabecera = filas.findIndex((f) => f.some((c) => sinTildes(c) === "PEDIDO") && f.some((c) => sinTildes(c) === "PRODUCTO"));
  if (cabecera < 0) return [];
  const idx = (nombre: string) => filas[cabecera].findIndex((c) => sinTildes(c) === nombre);
  const col = { localidad: idx("LOCALIDAD"), cliente: idx("CLIENTE"), pedido: idx("PEDIDO"), direccion: idx("DIRECCION"), telefono: idx("TELEFONO"), producto: idx("PRODUCTO"), tomate: idx("TOMATE"), cebolla: idx("CEBOLLA"), monto: idx("MONTO"), estado: idx("ESTADO") };
  const dato = (f: string[], i: number) => (i >= 0 ? (f[i] ?? "").trim() : "");

  const pedidos: PedidoPlanilla[] = [];
  let actual: PedidoPlanilla | null = null;
  for (const f of filas.slice(cabecera + 1)) {
    const orden = dato(f, col.pedido).replace(/[^\d]/g, "");
    if (orden) {
      actual = {
        orden,
        localidad: dato(f, col.localidad),
        cliente: dato(f, col.cliente),
        direccion: dato(f, col.direccion),
        telefono: dato(f, col.telefono),
        monto: leerPlata(dato(f, col.monto)),
        estado: dato(f, col.estado),
        renglones: [],
      };
      pedidos.push(actual);
    }
    const producto = dato(f, col.producto);
    if (actual && producto) actual.renglones.push({ producto, tomate: entero(dato(f, col.tomate)), cebolla: entero(dato(f, col.cebolla)) });
  }
  return pedidos;
}

type Catalogo = { tomate: { id: string; nombre: string; sku: string | null } | null; cebolla: { id: string; nombre: string; sku: string | null } | null };

/**
 * De los renglones de la planilla a los renglones del pedido. La tienda siempre vende en paquetes:
 * "Prepizza Napolitana" = paquetes de PREPIZZA TOMATE · "Prepizza Cebolla" = paquetes de PREPIZZA CEBOLLA ·
 * "Tomate + Cebolla" = un paquete de cada una · "Combo Napolitano" = un renglón propio que ocupa 2 paquetes ·
 * cualquier otro producto de la tienda queda cargado con su nombre.
 */
export function armarItems(renglones: RenglonPlanilla[], cat: Catalogo): ItemNuevo[] {
  const deCatalogo = new Map<string, ItemNuevo>();
  const otros: ItemNuevo[] = [];
  const sumar = (p: Catalogo["tomate"], cantidad: number) => {
    if (!p || cantidad <= 0) return;
    const previo = deCatalogo.get(p.id);
    if (previo) previo.cantidad += cantidad;
    else deCatalogo.set(p.id, { productoId: p.id, nombre: p.nombre, sku: p.sku, unidad: "paquete", cantidad, paquetesPor: 1 });
  };
  for (const r of renglones) {
    const texto = sinTildes(r.producto);
    const prefijo = r.producto.match(/^\s*(\d+)\s*[xX]\s+(.+)$/);
    const cantidadTexto = prefijo ? Number(prefijo[1]) : 1;
    if (texto.includes("COMBO") && /NAPOLITANO|MADRE|FOCACCIA/.test(texto)) {
      // Semana de la madre: la tienda le cambió el nombre y trae 2 focaccias gratis. Se carga siempre con el nombre del sistema.
      const conFocaccia = /FOCACCIA|MADRE/.test(texto);
      otros.push({ productoId: null, nombre: conFocaccia ? "COMBO NAPOLITANO + 2 FOCACCIA" : "COMBO NAPOLITANO", sku: null, unidad: "combo", cantidad: cantidadTexto, paquetesPor: 2 });
    } else if (texto.includes("TOMATE + CEBOLLA")) {
      sumar(cat.tomate, r.tomate || cantidadTexto);
      sumar(cat.cebolla, r.cebolla || cantidadTexto);
    } else if (texto.includes("PREPIZZA NAPOLITANA")) {
      sumar(cat.tomate, r.tomate || cantidadTexto);
    } else if (texto.includes("PREPIZZA CEBOLLA")) {
      sumar(cat.cebolla, r.cebolla || cantidadTexto);
    } else {
      const nombre = mayus((prefijo ? prefijo[2] : r.producto).replace(/\s+/g, " "));
      if (nombre) otros.push({ productoId: null, nombre, sku: null, unidad: "unidad", cantidad: cantidadTexto, paquetesPor: 1 });
    }
  }
  return [...deCatalogo.values(), ...otros];
}

/** "Zamudio - 3024 - Piso: 4 - Dpto: B" → "Zamudio 3024 - Piso 4 - Dpto B". Si no tiene ese formato, queda como vino. */
export function limpiarDireccion(t: string) {
  const partes = t.split(" - ").map((x) => x.trim()).filter(Boolean);
  if (partes.length >= 2 && /^\d+[A-Za-z]?$/.test(partes[1])) {
    const resto = partes.slice(2).map((x) => x.replace(/^(Piso|Dpto):\s*/i, (m) => m.replace(":", "").trim() + " "));
    return [`${titulo(partes[0])} ${partes[1]}`, ...resto].join(" - ");
  }
  return titulo(t);
}

export type ResultadoImportacion = { ok: boolean; nuevos: number; yaCargados: number; mensaje: string };

/** Crea un pedido por cada orden nueva (a partir de EMPRETIENDA_DESDE). Es seguro correrlo varias veces: nunca repite un N° de orden. */
export async function importarPedidosWeb(csvManual?: string): Promise<ResultadoImportacion> {
  const url = process.env.EMPRETIENDA_CSV_URL;
  const desde = Number(process.env.EMPRETIENDA_DESDE ?? "");
  if (!csvManual && !url) return { ok: false, nuevos: 0, yaCargados: 0, mensaje: "Falta conectar la planilla de la tienda (variable EMPRETIENDA_CSV_URL)." };
  if (!Number.isFinite(desde) || desde <= 0) return { ok: false, nuevos: 0, yaCargados: 0, mensaje: "Falta indicar desde qué N° de orden traer pedidos (variable EMPRETIENDA_DESDE), para no cargar los viejos." };

  let csv = csvManual;
  if (!csv) {
    try {
      const r = await fetch(url!, { cache: "no-store", signal: AbortSignal.timeout(25_000) });
      if (!r.ok) return { ok: false, nuevos: 0, yaCargados: 0, mensaje: `No se pudo leer la planilla (error ${r.status}).` };
      csv = await r.text();
    } catch {
      return { ok: false, nuevos: 0, yaCargados: 0, mensaje: "No se pudo leer la planilla de la tienda. Probá de nuevo en unos minutos." };
    }
  }

  const pedidos = leerPlanilla(csv).filter((p) => Number(p.orden) >= desde).sort((a, b) => Number(a.orden) - Number(b.orden));
  if (pedidos.length === 0) return { ok: true, nuevos: 0, yaCargados: 0, mensaje: "No hay pedidos nuevos en la tienda." };

  const existentes = new Set((await db.pedido.findMany({ where: { webOrden: { in: pedidos.map((p) => p.orden) } }, select: { webOrden: true } })).map((p) => p.webOrden));
  const productos = await db.producto.findMany({ where: { OR: [{ sku: { in: ["PPT01", "PPC02"] } }, { nombre: { in: ["PREPIZZA TOMATE", "PREPIZZA CEBOLLA"] } }] } });
  const buscar = (sku: string, nombre: string) => productos.find((p) => p.sku === sku) ?? productos.find((p) => p.nombre === nombre) ?? null;
  const catalogo: Catalogo = { tomate: buscar("PPT01", "PREPIZZA TOMATE"), cebolla: buscar("PPC02", "PREPIZZA CEBOLLA") };

  let nuevos = 0;
  let yaCargados = 0;
  for (const p of pedidos) {
    if (existentes.has(p.orden)) { yaCargados++; continue; }
    const items = armarItems(p.renglones, catalogo);
    if (items.length === 0) continue;
    try {
      await db.pedido.create({
        data: {
          origen: "WEB",
          estado: "PENDIENTE",
          conFactura: false,
          ivaPct: 0,
          creadoPorId: "empretienda",
          webOrden: p.orden,
          webNombre: mayus(p.cliente.replace(/\(\s*x\d+\s*\)/i, "").trim()) || "SIN NOMBRE",
          webDireccion: limpiarDireccion(p.direccion) || null,
          webBarrio: mayus(p.localidad) || null,
          webTelefono: p.telefono || null,
          webTotal: p.monto,
          webPago: sinTildes(p.estado).includes("MP") ? "PAGO_MP" : "PENDIENTE",
          items: { create: items.map((i) => ({ productoId: i.productoId, nombre: i.nombre, sku: i.sku, unidad: i.unidad, cantidad: i.cantidad, paquetesPor: i.paquetesPor, precioUnitario: 0 })) },
        },
      });
      nuevos++;
    } catch {
      yaCargados++; // otra copia del sistema lo cargó justo antes: el N° de orden es único
    }
  }
  return { ok: true, nuevos, yaCargados, mensaje: nuevos ? `Se cargaron ${nuevos} ${nuevos === 1 ? "pedido nuevo" : "pedidos nuevos"} de la tienda.` : "No hay pedidos nuevos en la tienda." };
}
