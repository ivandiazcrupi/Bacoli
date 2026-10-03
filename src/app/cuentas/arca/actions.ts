"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { decodificar, esLibroIvaAlicuotas, esLibroIvaVentas, leerArchivoArca, leerLibroIvaVentas } from "@/lib/arca";
import { cargarFacturas } from "@/lib/facturas";
import { exigirOficina } from "@/lib/session";
import { deshacerCobro, registrarCobro } from "../../pedidos/dia/actions";
import type { MedioPago } from "@prisma/client";

export type EstadoArca = { ok?: string; error?: string; avisos?: string[] } | undefined;

// Trae el archivo "Mis Comprobantes Emitidos" de ARCA. Por ahora solo guarda los comprobantes para compararlos con los pedidos:
// no cambia la cuenta corriente ni los pedidos. Subir el mismo archivo dos veces no duplica nada.
export async function importarArca(_: EstadoArca, formData: FormData): Promise<EstadoArca> {
  const usuario = await exigirOficina();
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elegí el archivo que bajaste de ARCA." };
  if (archivo.size > 8_000_000) return { error: "El archivo es demasiado grande (más de 8 MB)." };
  const texto = decodificar(await archivo.arrayBuffer());
  if (esLibroIvaAlicuotas(texto)) return { error: "Ese es el archivo de ALÍCUOTAS. Subí el de VENTAS (el que trae el nombre y el importe de cada comprobante)." };
  const lectura = esLibroIvaVentas(texto) ? leerLibroIvaVentas(texto) : leerArchivoArca(texto);
  if (lectura.filas.length === 0) return { error: lectura.errores[0] ?? "No encontré comprobantes en el archivo." };

  const existentes = await db.comprobanteArca.findMany({ where: { numero: { in: [...new Set(lectura.filas.map((f) => f.numero))] } }, select: { tipo: true, puntoVenta: true, numero: true } });
  const ya = new Set(existentes.map((e) => `${e.tipo}-${e.puntoVenta}-${e.numero}`));
  const nuevas = lectura.filas.filter((f) => !ya.has(`${f.tipo}-${f.puntoVenta}-${f.numero}`));
  if (nuevas.length) {
    await db.comprobanteArca.createMany({
      data: nuevas.map((f) => ({ tipo: f.tipo, puntoVenta: f.puntoVenta, numero: f.numero, fecha: new Date(`${f.fecha}T00:00:00Z`), cuitReceptor: f.cuitReceptor, razonSocial: f.razonSocial, total: f.total, cae: f.cae, esNotaCredito: f.esNotaCredito, importadoPor: usuario.nombre })),
      skipDuplicates: true,
    });
  }
  revalidatePath("/cuentas", "layout");
  const avisos = [...lectura.errores.slice(0, 5), ...(lectura.ignoradas ? [`${lectura.ignoradas} notas de débito ignoradas.`] : [])];
  return { ok: `Listo: ${nuevas.length} comprobantes nuevos${lectura.filas.length - nuevas.length ? ` y ${lectura.filas.length - nuevas.length} que ya estaban` : ""}.`, avisos };
}

/** A qué sucursal (y con qué aclaración) va una factura de ARCA: lo decide una persona, porque ARCA solo sabe la razón social. */
export async function guardarDatosArca(id: string, puntoId: string, observacion: string): Promise<{ ok: boolean }> {
  await exigirOficina();
  await db.comprobanteArca.update({ where: { id }, data: { puntoId: puntoId || null, observacion: observacion.trim().slice(0, 150) || null } });
  revalidatePath("/cuentas/arca");
  return { ok: true };
}

type Resultado = { ok: boolean; error?: string };
const MEDIOS: MedioPago[] = ["EFECTIVO", "TRANSFERENCIA", "CHEQUE", "OTRO"];
const redondear2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Registra el cobro de varias facturas con el mismo medio. Si la factura corresponde a un pedido entregado, también queda cobrado el pedido (hoja de ruta y cuenta del cliente al día). */
export async function registrarPagosArca(ids: string[], medio: string, obs: string): Promise<Resultado> {
  const usuario = await exigirOficina();
  if (!MEDIOS.includes(medio as MedioPago)) return { ok: false, error: "Elegí cómo pagó." };
  if (ids.length === 0) return { ok: false, error: "Elegí al menos una factura." };
  const { filas } = await cargarFacturas();
  for (const id of ids) {
    const f = filas.find((x) => x.id === id);
    if (!f || f.esNc) return { ok: false, error: "Una de las facturas elegidas no existe." };
    if (f.pagada) continue;
    if (f.pedidoId && f.pedidoEntregado) await registrarCobro(f.pedidoId, medio); // si el pedido no se puede cobrar ahora, igual se marca la factura
    await db.comprobanteArca.update({ where: { id }, data: { pagado: true, medioCobro: medio as MedioPago, pagadoEn: new Date(), obsCobro: obs.trim().slice(0, 150) || null } });
  }
  void usuario;
  revalidatePath("/cuentas", "layout");
  return { ok: true };
}

export async function deshacerPagoArca(id: string): Promise<Resultado> {
  await exigirOficina();
  const { filas } = await cargarFacturas();
  const f = filas.find((x) => x.id === id);
  if (!f) return { ok: false, error: "No encontré la factura." };
  if (f.pedidoId) await deshacerCobro(f.pedidoId);
  await db.comprobanteArca.update({ where: { id }, data: { pagado: false, medioCobro: null, pagadoEn: null, obsCobro: null } });
  revalidatePath("/cuentas", "layout");
  return { ok: true };
}

/** Aplica una nota de crédito de ARCA a una factura del mismo cliente (mismo CUIT). Aplica lo que entre: el menor entre lo que le queda a la nota y lo que le falta a la factura. */
export async function aplicarNc(ncId: string, facturaId: string): Promise<Resultado> {
  const usuario = await exigirOficina();
  const { filas } = await cargarFacturas();
  const nc = filas.find((x) => x.id === ncId && x.esNc);
  const fc = filas.find((x) => x.id === facturaId && !x.esNc);
  if (!nc || !fc) return { ok: false, error: "No encontré la nota o la factura." };
  if (!nc.cuit || nc.cuit !== fc.cuit) return { ok: false, error: "La nota y la factura tienen que ser del mismo CUIT." };
  const monto = redondear2(Math.min(nc.saldo, fc.saldo));
  if (!(monto > 0)) return { ok: false, error: nc.saldo <= 0 ? "Esta nota ya está aplicada por completo." : "Esa factura ya está cubierta por notas de crédito." };
  await db.aplicacionNcArca.create({ data: { ncId, facturaId, monto, creadoPor: usuario.nombre } });
  revalidatePath("/cuentas", "layout");
  return { ok: true };
}

export async function quitarAplicacionNc(id: string): Promise<Resultado> {
  await exigirOficina();
  await db.aplicacionNcArca.delete({ where: { id } }).catch(() => null);
  revalidatePath("/cuentas", "layout");
  return { ok: true };
}
