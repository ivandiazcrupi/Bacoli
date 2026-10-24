// Prueba de la lectura del mail de Empretienda con mails de ejemplo (datos inventados, con el mismo formato que los reales).
// Uso: npx tsx scripts/probar-mail.ts
import { htmlATexto, leerMailOrden, obtenerLocalidad } from "../src/lib/empretienda-mail";

const mail = `¡Felicidades, tienes una nueva orden!
Orden: #14107
Método de pago:
Mercado Pago
Estado del pago:
Finalizado
Método de envío:
Envíos personalizados
Detalle de la venta:
$16325.00
1 x PREPIZZA NAPOLITANA X4
SKU: -
$16325.00
Subtotal
-$3265.00
Descuento
$0.00
Envío
$13060.00
Total
Datos de envío:
Información del método de envío
Método de envío: Envíos personalizados (Envío GRATIS: CABA)
Costo: $0.00
Información del destinatario
Nombre: Julieta
Apellido: Prueba
Email: julieta.prueba@example.com
Teléfono: 541100000000
DNI: 11111111
Calle: Av. Libertador
Número: 8520
Piso: 8
Dpto: B
Ciudad: Ciudad Autonoma Buenos Aires
Provincia: CAPITAL FEDERAL
Código postal: 1429
Datos para la facturación:
Nombre completo: Julieta Prueba
Email: julieta.prueba@example.com
Calle: -
Número: -
Piso: -
Dpto: -
Ciudad: -
Provincia: -
Código postal: -`;

const r = leerMailOrden(mail);
console.log(JSON.stringify(r, null, 2));
const esperado = { orden: "14107", localidad: "SAAVEDRA", cliente: "JULIETA", direccion: "Av. Libertador - 8520 - Piso: 8 - Dpto: B", monto: 13060, estado: "PAGO MP", email: "julieta.prueba@example.com" };
for (const [k, v] of Object.entries(esperado)) if ((r as Record<string, unknown>)[k] !== v) throw new Error(`${k}: esperaba ${v} y salió ${(r as Record<string, unknown>)[k]}`);
if (r!.renglones.length !== 1 || r!.renglones[0].tomate !== 2 || r!.renglones[0].producto !== "PREPIZZA NAPOLITANA") throw new Error("productos mal");

// El mismo mail en HTML tiene que dar lo mismo
const html = mail.split("\n").map((l) => `<p style="x">${l.replace("&", "&amp;")}</p>`).join("\n");
const r2 = leerMailOrden(htmlATexto(`<html><head><style>p{}</style></head><body>${html}</body></html>`));
if (JSON.stringify(r2) !== JSON.stringify(r)) throw new Error("el HTML da distinto que el texto");

// Zonas de GBA y varios productos
console.log(obtenerLocalidad("Lomas de Zamora", "BUENOS AIRES", "1832", "Envío ZONA SUR"), "|", obtenerLocalidad("Tigre", "BUENOS AIRES", "1648", "Correo"));
const varios = leerMailOrden(mail.replace("1 x PREPIZZA NAPOLITANA X4", "2 x PREPIZZA CEBOLLA X4\n1 x COMBO NAPOLITANO\n3 x FOCACCIA CHERRY X2\n1 x PREPIZZA TOMATE + CEBOLLA"));
console.log(JSON.stringify(varios!.renglones));
console.log("OK");
