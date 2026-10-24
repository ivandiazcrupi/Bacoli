// Prueba de la comparación mail ↔ pedido con un pedido inventado en la base local. Uso: npx tsx scripts/probar-comparacion.ts
import { db } from "../src/lib/db";
import { leerMailOrden } from "../src/lib/empretienda-mail";
import { compararConSistema } from "../src/lib/empretienda-comparar";

async function main() {
  process.env.EMPRETIENDA_DESDE = "1";
  const tomate = await db.producto.findFirst({ where: { sku: "PPT01" } });
  if (!tomate) throw new Error("Falta el producto PPT01 (corré npm run db:seed)");
  await db.pedido.deleteMany({ where: { webOrden: "99001" } });
  await db.pedido.create({ data: { origen: "WEB", estado: "PENDIENTE", conFactura: false, ivaPct: 0, creadoPorId: "prueba", webOrden: "99001", webNombre: "JULIETA", webDireccion: "Av. Libertador 8520 - Piso 8 - Dpto B", webBarrio: "SAAVEDRA", webTelefono: "541100000000", webTotal: 13060, webPago: "PAGO_MP", items: { create: [{ productoId: tomate.id, nombre: tomate.nombre, sku: tomate.sku, unidad: "paquete", cantidad: 2, paquetesPor: 1, precioUnitario: 0 }] } } });
  const mail = (orden: string, tel: string) => leerMailOrden(`Orden: #${orden}\nMétodo de pago:\nMercado Pago\nEstado del pago:\nFinalizado\nMétodo de envío:\nEnvíos personalizados\n1 x PREPIZZA NAPOLITANA X4\nSKU: -\n$13060.00\nTotal\nNombre: Julieta\nEmail: j@example.com\nTeléfono: ${tel}\nCalle: Av. Libertador\nNúmero: 8520\nPiso: 8\nDpto: B\nCiudad: Ciudad Autonoma Buenos Aires\nProvincia: CAPITAL FEDERAL\nCódigo postal: 1429`)!;
  const r = await compararConSistema([mail("99001", "541100000000"), mail("99002", "541100000000")]);
  console.log(JSON.stringify(r.filas, null, 1));
  const r2 = await compararConSistema([mail("99001", "541199999999")]);
  console.log(r2.filas[0].estado, r2.filas[0].diferencias);
  await db.pedido.deleteMany({ where: { webOrden: "99001" } });
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
