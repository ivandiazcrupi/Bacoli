"use server";

import { revalidatePath } from "next/cache";
import { sincronizarCuentaPedido } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { aFecha, esFechaValida, hoy } from "@/lib/fechas";
import { mayus, titulo } from "@/lib/mayusculas";
import { exigirOficina } from "@/lib/session";
import { valoresDe, type EstadoForm } from "../../clientes/validacion";

export type Resultado = { ok: boolean; error?: string };
const refrescar = () => revalidatePath("/pedidos", "layout");

// ---------- Vehículos (los carga el equipo; la capacidad máxima, en paquetes, la define cada uno) ----------

export async function guardarVehiculo(vehiculoId: string | null, _: EstadoForm, formData: FormData): Promise<EstadoForm> {
  await exigirOficina();
  const valores = valoresDe(formData);
  const nombre = titulo(String(formData.get("nombre") ?? "").replace(/\s+/g, " ").trim()); // "Camioneta 1": minúscula con la primera letra de cada palabra en mayúscula
  if (nombre.length < 2) return { error: "Falta el nombre del vehículo.", valores };
  const patente = mayus(String(formData.get("patente") ?? "")) || null;
  const textoCapacidad = String(formData.get("capacidad") ?? "").replace(/\D/g, "");
  const capacidad = textoCapacidad ? Number(textoCapacidad) : null;
  if (capacidad !== null && capacidad < 1) return { error: "La capacidad tiene que ser mayor a 0 (o dejarla vacía = sin tope).", valores };

  if (vehiculoId) {
    await db.vehiculo.update({ where: { id: vehiculoId }, data: { nombre, patente, capacidad } });
  } else {
    const ultimo = await db.vehiculo.aggregate({ _max: { orden: true } });
    await db.vehiculo.create({ data: { nombre, patente, capacidad, orden: (ultimo._max.orden ?? -1) + 1 } });
  }
  refrescar();
  return { ok: vehiculoId ? "Vehículo guardado." : "Vehículo agregado." };
}

export async function cambiarActivoVehiculo(formData: FormData) {
  await exigirOficina();
  const id = String(formData.get("id"));
  const v = await db.vehiculo.findUnique({ where: { id } });
  if (!v) return;
  await db.vehiculo.update({ where: { id }, data: { activo: !v.activo } });
  refrescar();
}

/** Borrar un vehículo: solo si nunca salió (si no, se pierde el historial: ahí se desactiva). */
export async function eliminarVehiculo(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  await exigirOficina();
  const id = String(formData.get("id"));
  const v = await db.vehiculo.findUnique({ where: { id }, include: { _count: { select: { salidas: true } } } });
  if (!v) return { error: "El vehículo ya no existe." };
  if (v._count.salidas > 0) return { error: "Este vehículo ya salió a repartir, por eso no se puede eliminar. Usá “Desactivar”: deja de ofrecerse y no se pierde el historial." };
  await db.vehiculo.delete({ where: { id } });
  refrescar();
  return { ok: "Vehículo eliminado." };
}

// ---------- Hoja de ruta de un día: qué vehículos salen y qué pedidos lleva cada uno ----------

async function diaAbierto(fecha: Date | null) {
  if (!fecha) return true;
  return !(await db.diaCerrado.findUnique({ where: { fecha } }));
}

export async function agregarSalida(fecha: string, vehiculoId: string, repartidorId: string | null): Promise<Resultado> {
  await exigirOficina();
  if (!esFechaValida(fecha)) return { ok: false, error: "Fecha inválida." };
  if (!(await diaAbierto(aFecha(fecha)))) return { ok: false, error: "Ese día está cerrado. Un dueño puede reabrirlo." };
  if (fecha < hoy()) return { ok: false, error: "Ese día ya pasó: no se le suman camionetas." };
  const vehiculo = await db.vehiculo.findUnique({ where: { id: vehiculoId } });
  if (!vehiculo || !vehiculo.activo) return { ok: false, error: "Ese vehículo no está disponible." };
  if (await db.salida.findUnique({ where: { fecha_vehiculoId: { fecha: aFecha(fecha), vehiculoId } } })) return { ok: false, error: "Ese vehículo ya sale ese día." };
  const ultimo = await db.salida.aggregate({ where: { fecha: aFecha(fecha) }, _max: { orden: true } });
  await db.salida.create({ data: { fecha: aFecha(fecha), vehiculoId, repartidorId: repartidorId || null, orden: (ultimo._max.orden ?? -1) + 1 } });
  refrescar();
  return { ok: true };
}

/** Saca un vehículo del día. Sus pedidos no se borran: quedan en el día, "sin vehículo". */
export async function quitarSalida(salidaId: string): Promise<Resultado> {
  await exigirOficina();
  const salida = await db.salida.findUnique({ where: { id: salidaId } });
  if (!salida) return { ok: false, error: "Ese vehículo ya no está en el día." };
  if (!(await diaAbierto(salida.fecha))) return { ok: false, error: "Ese día está cerrado. Un dueño puede reabrirlo." };
  await db.$transaction([
    db.pedido.updateMany({ where: { salidaId }, data: { salidaId: null, ordenRuta: 0 } }),
    db.salida.delete({ where: { id: salidaId } }),
  ]);
  refrescar();
  return { ok: true };
}

export async function cambiarRepartidor(salidaId: string, repartidorId: string | null): Promise<Resultado> {
  await exigirOficina();
  const salida = await db.salida.findUnique({ where: { id: salidaId } });
  if (!salida) return { ok: false, error: "Ese vehículo ya no está en el día." };
  if (!(await diaAbierto(salida.fecha))) return { ok: false, error: "Ese día está cerrado. Un dueño puede reabrirlo." };
  await db.salida.update({ where: { id: salidaId }, data: { repartidorId: repartidorId || null } });
  refrescar();
  return { ok: true };
}

/** Pone un pedido del día en un vehículo (al final de su recorrido) o lo deja "sin vehículo" (salidaId = null). */
export async function asignarAVehiculo(pedidoId: string, salidaId: string | null): Promise<Resultado> {
  const usuario = await exigirOficina();
  const pedido = await db.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido || pedido.estado === "CANCELADO") return { ok: false, error: "No se puede mover ese pedido." };
  if (!pedido.fechaEntrega) return { ok: false, error: "Primero asignale un día al pedido." };
  if (!(await diaAbierto(pedido.fechaEntrega))) return { ok: false, error: "Ese día está cerrado. Un dueño puede reabrirlo." };
  if (salidaId === null) {
    await db.pedido.update({ where: { id: pedidoId }, data: { salidaId: null, ordenRuta: 0 } });
  } else {
    const salida = await db.salida.findUnique({ where: { id: salidaId } });
    if (!salida || salida.fecha.getTime() !== pedido.fechaEntrega.getTime()) return { ok: false, error: "Ese vehículo no sale el día del pedido." };
    const ultimo = await db.pedido.aggregate({ where: { salidaId }, _max: { ordenRuta: true } });
    await db.$transaction(async (tx) => {
      await tx.pedido.update({ where: { id: pedidoId }, data: { salidaId, ordenRuta: (ultimo._max.ordenRuta ?? -1) + 1, ...(pedido.estado === "NO_ENTREGADO" ? { estado: "PENDIENTE" } : {}) } });
      if (pedido.estado === "NO_ENTREGADO") await sincronizarCuentaPedido(tx, pedidoId, usuario.id);
    });
  }
  refrescar();
  return { ok: true };
}

/** Guarda el orden del recorrido de un vehículo (el número 1, 2, 3… de la hoja de ruta). */
export async function ordenarSalida(salidaId: string, ordenIds: string[]): Promise<Resultado> {
  await exigirOficina();
  if (ordenIds.length > 300) return { ok: false, error: "Demasiados pedidos." };
  const salida = await db.salida.findUnique({ where: { id: salidaId } });
  if (!salida) return { ok: false, error: "Ese vehículo ya no está en el día." };
  if (!(await diaAbierto(salida.fecha))) return { ok: false, error: "Ese día está cerrado. Un dueño puede reabrirlo." };
  await db.$transaction(ordenIds.map((id, i) => db.pedido.updateMany({ where: { id, salidaId }, data: { ordenRuta: i } })));
  return { ok: true };
}

/** Devuelve un pedido a la lista de PEDIDOS (sin día y sin vehículo). */
export async function devolverAPedidos(pedidoId: string): Promise<Resultado> {
  const usuario = await exigirOficina();
  const pedido = await db.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido || pedido.estado === "CANCELADO") return { ok: false, error: "No se puede mover ese pedido." };
  if (pedido.estado === "ENTREGADO") return { ok: false, error: "Un pedido entregado no se puede mover." };
  if (!(await diaAbierto(pedido.fechaEntrega))) return { ok: false, error: "Ese día está cerrado. Un dueño puede reabrirlo." };
  // Un "no entregado" que vuelve a Pedidos se reactiva (pendiente) y vuelve a contar en la cuenta.
  await db.$transaction(async (tx) => {
    await tx.pedido.update({ where: { id: pedidoId }, data: { fechaEntrega: null, salidaId: null, ordenRuta: 0, ...(pedido.estado === "NO_ENTREGADO" ? { estado: "PENDIENTE" } : {}) } });
    if (pedido.estado === "NO_ENTREGADO") await sincronizarCuentaPedido(tx, pedidoId, usuario.id);
  });
  refrescar();
  return { ok: true };
}
