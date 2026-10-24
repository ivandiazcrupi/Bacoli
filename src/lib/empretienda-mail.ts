import type { PedidoPlanilla, RenglonPlanilla } from "@/lib/empretienda";

/**
 * Lectura del mail "Tienes una nueva orden #N" de Empretienda. Reproduce, regla por regla, el script de Google que hoy llena la planilla
 * "Minorista" (extraerDatosEmail, parsearProductos y obtenerLocalidad), así lo que sale de acá es IGUAL a lo que escribe la planilla y
 * se puede comparar fila por fila antes de dejar de usar el script. Además trae el email del comprador.
 */

export type OrdenDeMail = PedidoPlanilla & { email: string; metodoPago: string; estadoPago: string; metodoEnvio: string; cp: string; ciudad: string; provincia: string; apellido: string };

/** Pasa el HTML del mail a texto con un dato por línea (como lo hace Gmail con getPlainBody). */
export function htmlATexto(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li|table|td|th)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .split("\n").map((l) => l.replace(/[ \t\u00a0]+/g, " ").trim()).filter(Boolean).join("\n");
}

// ── Barrio según el código postal de CABA (la misma tabla del script de Google) ──────────────────────
type Cp = number | [number, number];
const BARRIOS: [string, Cp[]][] = [
  ["SAN NICOLAS", [[1001, 1007]]], ["MONTSERRAT", [[1008, 1016]]], ["BALVANERA", [[1029, 1049]]], ["CONSTITUCION", [[1050, 1059]]],
  ["SAN TELMO", [[1060, 1064]]], ["PUERTO MADERO", [[1065, 1069]]], ["RETIRO", [[1070, 1076], 1099]], ["LA BOCA", [[1100, 1103]]],
  ["BARRACAS", [[1104, 1109]]], ["PARQUE PATRICIOS", [[1110, 1113]]], ["NUEVA POMPEYA", [[1114, 1119]]], ["RECOLETA", [[1120, 1133]]],
  ["PALERMO", [[1172, 1199]]], ["BELGRANO", [[1200, 1213]]], ["COLEGIALES", [[1214, 1219]]], ["NUNEZ", [[1220, 1225]]],
  ["SAAVEDRA", [[1226, 1229]]], ["VILLA URQUIZA", [[1230, 1235]]], ["VILLA PUEYRREDON", [[1240, 1243]]], ["VILLA DEVOTO", [[1244, 1248]]],
  ["VILLA DEL PARQUE", [[1249, 1252]]], ["VILLA SANTA RITA", [[1253, 1254]]], ["VILLA GENERAL MITRE", [[1255, 1257]]], ["VILLA REAL", [[1258, 1259]]],
  ["MONTE CASTRO", [[1260, 1262]]], ["VERSALLES", [[1263, 1264]]], ["FLORESTA", [[1265, 1267]]], ["VELEZ SARSFIELD", [[1268, 1269]]],
  ["LINIERS", [[1270, 1272]]], ["MATADEROS", [[1273, 1276]]], ["VILLA LUGANO", [[1277, 1279]]], ["VILLA RIACHUELO", [[1280, 1281]]],
  ["VILLA SOLDATI", [[1282, 1286]]], ["FLORES", [[1290, 1299]]], ["PARQUE CHACABUCO", [[1300, 1304]]], ["BOEDO", [[1305, 1309]]],
  ["SAN CRISTOBAL", [[1310, 1319]]], ["ALMAGRO", [[1320, 1329]]], ["CABALLITO", [[1330, 1349]]], ["VILLA CRESPO", [[1350, 1355]]],
  ["CHACARITA", [[1356, 1361]]], ["VILLA ORTUZAR", [[1362, 1363]]], ["PATERNAL", [[1364, 1369]]], ["AGRONOMIA", [[1380, 1382]]],
  ["PARQUE AVELLANEDA", [[1390, 1395]]], ["VILLA LURO", [[1396, 1398]]],
  // Códigos de la forma 14xx (en el script se pisan los anteriores si coinciden, por eso van después y en este orden)
  ["CABALLITO", [1406, 1420]], ["FLORES", [1403, 1407]], ["LINIERS", [1408, 1435, 1460]], ["VILLA LURO", [1409]], ["MATADEROS", [1410, 1436, 1461]],
  ["MONTE CASTRO", [1412, 1434]], ["VILLA URQUIZA", [1414, 1430, 1454]], ["PATERNAL", [1415]], ["AGRONOMIA", [1416]], ["VILLA PUEYRREDON", [1419, 1431, 1455]],
  ["ALMAGRO", [1421, 1443]], ["VILLA CRESPO", [1422, 1444]], ["PALERMO", [1423, 1424, 1425, 1446, [1472, 1479]]], ["COLEGIALES", [1426, 1449]],
  ["BELGRANO", [1427, 1448, 1450, 1451]], ["NUNEZ", [1428, 1452]], ["SAAVEDRA", [1429, 1453]], ["VILLA DEVOTO", [1432, 1456]], ["VILLA DEL PARQUE", [1433, 1457]],
  ["VILLA LUGANO", [1437]], ["VILLA SOLDATI", [1438]], ["VILLA RIACHUELO", [1439]], ["PARQUE CHACABUCO", [1440]], ["BOEDO", [1441]], ["SAN CRISTOBAL", [1442]],
  ["CHACARITA", [1445]], ["RECOLETA", [1447, 1471]], ["FLORESTA", [1458]], ["VELEZ SARSFIELD", [1459]], ["NUEVA POMPEYA", [1462]], ["PARQUE PATRICIOS", [1463]],
  ["BARRACAS", [1464]], ["LA BOCA", [1465]], ["SAN TELMO", [1466]], ["CONSTITUCION", [1467]], ["BALVANERA", [1468]], ["SAN NICOLAS", [1469]], ["RETIRO", [1470]],
];
const TABLA_CP = new Map<number, string>();
for (const [nombre, cps] of BARRIOS) for (const cp of cps) { if (typeof cp === "number") TABLA_CP.set(cp, nombre); else for (let n = cp[0]; n <= cp[1]; n++) TABLA_CP.set(n, nombre); }

/** Localidad que va a la columna "Localidad" (= barrio del pedido): zona del GBA si el envío la trae, barrio de CABA por código postal, o la ciudad. */
export function obtenerLocalidad(ciudad: string, provincia: string, cp: string, metodoEnvio: string): string {
  const cpNum = parseInt(String(cp).replace(/[^0-9]/g, ""), 10);
  const prov = String(provincia || "").toUpperCase();
  const envio = String(metodoEnvio || "").toUpperCase();
  const ciudadStr = String(ciudad || "").trim().toUpperCase();
  let zona = "";
  if (envio.includes("ZONA NORTE")) zona = "ZONA NORTE";
  else if (envio.includes("ZONA SUR")) zona = "ZONA SUR";
  else if (envio.includes("ZONA OESTE")) zona = "ZONA OESTE";
  else if (envio.includes("ZONA ESTE")) zona = "ZONA ESTE";
  if (zona) return ciudadStr ? `${ciudadStr} / ${zona}` : zona;
  const esCaba = prov.includes("CAPITAL") || prov.includes("CABA") || envio.includes("CABA") || (cpNum >= 1000 && cpNum <= 1499);
  if (esCaba) return TABLA_CP.get(cpNum) ?? (ciudadStr || "CABA");
  return ciudadStr;
}

// ── Productos ───────────────────────────────────────────────────────────────────────────────────────
function limpiarNombre(nombre: string) {
  return nombre.replace(/x4/gi, "").replace(/x2/gi, "").replace(/x1/gi, "").replace(/\(SKU:[^)]*\)/gi, "").replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
}

/** De las líneas "2 x PREPIZZA NAPOLITANA X4" a los renglones de la planilla (producto, paquetes de tomate, paquetes de cebolla). */
export function parsearProductos(texto: string): RenglonPlanilla[] {
  const principales: RenglonPlanilla[] = [];
  const otros: RenglonPlanilla[] = [];
  for (const crudo of texto.split("\n")) {
    const linea = crudo.trim();
    if (!linea) continue;
    const m = linea.match(/^(\d+)\s*[xX]\s+(.+)/);
    if (!m) continue;
    const cant = parseInt(m[1], 10);
    const item = m[2].trim().toUpperCase().replace(/Eleg[ií]\s+.+/gi, "").trim();
    const nombre = limpiarNombre(item);
    if (item.includes("PREPIZZA TOMATE + CEBOLLA") || item.includes("TOMATE + CEBOLLA")) principales.push({ producto: nombre, tomate: cant, cebolla: cant });
    else if (item.includes("COMBO NAPOLITANO")) principales.push({ producto: `${cant} x ${nombre}`, tomate: cant * 2, cebolla: 0 });
    else if (item.includes("PREPIZZA NAPOLITANA")) principales.push({ producto: nombre, tomate: cant * 2, cebolla: 0 });
    else if (item.includes("PREPIZZA CEBOLLA")) principales.push({ producto: nombre, tomate: 0, cebolla: cant * 2 });
    else if (nombre.length > 2) otros.push({ producto: `${cant} x ${nombre}`, tomate: 0, cebolla: 0 });
  }
  const prioridad = (p: RenglonPlanilla) => (p.tomate > 0 && p.cebolla === 0 ? 1 : p.cebolla > 0 && p.tomate === 0 ? 2 : p.tomate > 0 && p.cebolla > 0 ? 3 : 4);
  principales.sort((a, b) => prioridad(a) - prioridad(b)); // sort estable: mismo orden que el script
  return [...principales, ...otros];
}

// ── El mail completo ────────────────────────────────────────────────────────────────────────────────
/** Lee un mail de orden (ya pasado a texto, una línea por dato). Devuelve null si no es una orden. */
export function leerMailOrden(cuerpo: string): OrdenDeMail | null {
  const extraer = (patron: RegExp) => { const m = cuerpo.match(patron); return m ? m[1].trim() : ""; };
  const orden = extraer(/Orden:\s*#?(\d+)/i);
  if (!orden) return null;
  const metodoPago = extraer(/M.todo de pago:\s*([^\n]+)/i);
  const estadoPago = extraer(/Estado del pago:\s*([^\n]+)/i);
  const metodoEnvio = extraer(/M.todo de env.o:\s*([^\n]+)/i);
  const nombre = extraer(/Nombre:\s*([^\n]+)/i);
  const apellido = extraer(/Apellido:\s*([^\n]+)/i);
  const email = extraer(/E-?mail:\s*([^\s<>]+@[^\s<>]+)/i);
  const telefono = extraer(/Tel.fono:\s*([^\n]+)/i);
  const valor = (v: string) => (v === "-" ? "" : v);
  const calle = valor(extraer(/Calle:\s*([^\n]+)/i));
  const numero = valor(extraer(/N.mero:\s*([^\n]+)/i));
  const piso = valor(extraer(/Piso:\s*([^\n]+)/i));
  const dpto = valor(extraer(/Dpto:\s*([^\n]+)/i));
  const ciudad = extraer(/Ciudad:\s*([^\n]+)/i);
  const provincia = extraer(/Provincia:\s*([^\n]+)/i);
  const cp = extraer(/C.digo postal:\s*([^\n]+)/i);
  const total = (cuerpo.match(/([\d.,]+)\s*\nTotal/i) ?? [])[1] ?? "";
  const direccion = [calle, numero, piso ? `Piso: ${piso}` : "", dpto ? `Dpto: ${dpto}` : ""].filter(Boolean).join(" - ");

  let productosTexto = "";
  for (const crudo of cuerpo.split("\n")) {
    const l = crudo.trim();
    if (/^\d+\s*[xX]\s+[A-Za-z].+/.test(l) && !l.toUpperCase().includes("SKU")) productosTexto += `${l}\n`;
  }
  let renglones = parsearProductos(productosTexto);
  if (renglones.length === 0) renglones = [{ producto: productosTexto.trim().substring(0, 60), tomate: 0, cebolla: 0 }];

  const mp = metodoPago.toUpperCase(), ep = estadoPago.toUpperCase();
  let estado = "";
  if (mp.includes("MERCADO")) estado = ep.includes("FINALIZADO") || ep.includes("APROBADO") ? "PAGO MP" : "PENDIENTE";
  else if (mp.includes("TRANSFER")) estado = "PENDIENTE";

  const monto = parseFloat(String(total).replace(/[^0-9.]/g, ""));
  return {
    orden,
    localidad: obtenerLocalidad(ciudad, provincia, cp, metodoEnvio),
    cliente: nombre.toUpperCase().split(" ")[0] ?? "", // como el script: solo el primer nombre
    direccion,
    telefono,
    monto: Number.isFinite(monto) ? monto : null,
    estado,
    renglones,
    email, metodoPago, estadoPago, metodoEnvio, cp, ciudad, provincia, apellido,
  };
}
