"use server";

import { conIvaLogistica } from "@/lib/ruta";
import { revalidatePath } from "next/cache";
import { sincronizarCuentaPedido } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { aFecha, esFechaValida, hoy } from "@/lib/fechas";
import { mayus, titulo } from "@/lib/mayusculas";
import { leerMonto } from "@/lib/numeros";
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

  // El costo de logística por día ya seteado de este vehículo (si no viene el campo, se conserva).
  const textoCosto = formData.has("costo") ? String(formData.get("costo") ?? "").trim() : undefined;
  const costo = textoCosto === undefined ? undefined : textoCosto ? leerMonto(textoCosto) : null;
  if (costo !== undefined && textoCosto && (costo === null || costo < 0)) return { error: "El costo de logística tiene que ser un monto válido (o dejarlo vacío para cargarlo a mano cada día).", valores };
  const datosCosto = costo === undefined ? {} : { costoLogistico: costo };

  if (vehiculoId) {
    await db.vehiculo.update({ where: { id: vehiculoId }, data: { nombre, patente, capacidad, ...datosCosto } });
    // Al cambiar el costo del vehículo se aplica directo a TODAS sus hojas de ruta (también las anteriores): la hoja recalcula el costo por unidad.
    if (costo !== undefined && costo !== null) await db.salida.updateMany({ where: { vehiculoId, fecha: { notIn: (await db.diaListo.findMany({ select: { fecha: true } })).map((d) => d.fecha) } }, data: { costoLogistica: conIvaLogistica(costo) } }); // las hojas ya "listas" no se tocan: ya pasaron por la aprobación
  } else {
    const ultimo = await db.vehiculo.aggregate({ _max: { orden: true } });
    await db.vehiculo.create({ data: { nombre, patente, capacidad, ...datosCosto, orden: (ultimo._max.orden ?? -1) + 1 } });
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

/** Eliminar un vehículo. Si nunca salió se borra de verdad; si ya repartió, se oculta para siempre (las hojas de ruta viejas conservan su nombre). */
export async function eliminarVehiculo(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  await exigirOficina();
  const id = String(formData.get("id"));
  const v = await db.vehiculo.findUnique({ where: { id }, include: { _count: { select: { salidas: true } } } });
  if (!v) return { error: "El vehículo ya no existe." };
  if (v._count.salidas > 0) {
    const enHojaAbierta = await db.salida.count({ where: { vehiculoId: id, fecha: { gte: aFecha(hoy()) } } });
    if (enHojaAbierta > 0) return { error: "Este vehículo está en una hoja de ruta de hoy o de un día que viene. Sacalo de esos días primero." };
    await db.vehiculo.update({ where: { id }, data: { eliminado: true, activo: false } });
  } else {
    await db.vehiculo.delete({ where: { id } });
  }
  refrescar();
  return { ok: "Vehículo eliminado." };
}

// ---------- Hoja de ruta de un día: qué vehículos salen y qué pedidos lleva cada uno ----------

/** El día se puede reorganizar solo mientras no está lista ni cerrada su hoja de ruta. */
async function diaAbierto(fecha: Date | null) {
  if (!fecha) return true;
  const [cerrado, listo] = await Promise.all([db.diaCerrado.findUnique({ where: { fecha } }), db.diaListo.findUnique({ where: { fecha } })]);
  return !cerrado && !listo;
}

export async function agregarSalida(fecha: string, vehiculoId: string, repartidorId: string | null): Promise<Resultado> {
  await exigirOficina();
  if (!esFechaValida(fecha)) return { ok: false, error: "Fecha inválida." };
  if (!(await diaAbierto(aFecha(fecha)))) return { ok: false, error: "La hoja de ese día está lista o cerrada: hay que reabrirla para moverla." };
  if (fecha < hoy()) return { ok: false, error: "Ese día ya pasó: no se le suman camionetas." };
  const vehiculo = await db.vehiculo.findUnique({ where: { id: vehiculoId } });
  if (!vehiculo || !vehiculo.activo) return { ok: false, error: "Ese vehículo no está disponible." };
  if (await db.salida.findUnique({ where: { fecha_vehiculoId: { fecha: aFecha(fecha), vehiculoId } } })) return { ok: false, error: "Ese vehículo ya sale ese día." };
  const ultimo = await db.salida.aggregate({ where: { fecha: aFecha(fecha) }, _max: { orden: true } });
  await db.salida.create({ data: { fecha: aFecha(fecha), vehiculoId, repartidorId: repartidorId || null, costoLogistica: vehiculo.costoLogistico === null ? null : conIvaLogistica(Number(vehiculo.costoLogistico)), orden: (ultimo._max.orden ?? -1) + 1 } });
  refrescar();
  return { ok: true };
}

/** Saca un vehículo del día. Sus pedidos no se borran: quedan en el día, "sin vehículo". */
export async function quitarSalida(salidaId: string): Promise<Resultado> {
  await exigirOficina();
  const salida = await db.salida.findUnique({ where: { id: salidaId } });
  if (!salida) return { ok: false, error: "Ese vehículo ya no está en el día." };
  if (!(await diaAbierto(salida.fecha))) return { ok: false, error: "La hoja de ese día está lista o cerrada: hay que reabrirla para moverla." };
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
  if (!(await diaAbierto(salida.fecha))) return { ok: false, error: "La hoja de ese día está lista o cerrada: hay que reabrirla para moverla." };
  await db.salida.update({ where: { id: salidaId }, data: { repartidorId: repartidorId || null } });
  refrescar();
  return { ok: true };
}

/** Horario del reparto (opcional, solo informativo): vacío = sin horario. Se puede cargar con la hoja lista; solo se frena con el día cerrado. */
export async function guardarHorario(salidaId: string, inicio: string, fin: string): Promise<Resultado> {
  await exigirOficina();
  const ok = (h: string) => h === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
  if (!ok(inicio) || !ok(fin)) return { ok: false, error: "El horario tiene que ser una hora válida." };
  const salida = await db.salida.findUnique({ where: { id: salidaId } });
  if (!salida) return { ok: false, error: "Ese vehículo ya no está en el día." };
  if (await db.diaCerrado.findUnique({ where: { fecha: salida.fecha } })) return { ok: false, error: "El día está cerrado." };
  await db.salida.update({ where: { id: salidaId }, data: { horaInicio: inicio || null, horaFin: fin || null } });
  refrescar();
  return { ok: true };
}

/** Costo de logística de esa vuelta (en pesos; vacío = sin cargar, y entonces no se puede dejar lista la hoja ni imprimirla). Lo carga cualquiera de oficina; solo se frena con el día cerrado. */
export async function guardarCostoLogistica(salidaId: string, texto: string): Promise<Resultado> {
  await exigirOficina();
  const costo = texto.trim() ? leerMonto(texto) : null;
  if (texto.trim() && (costo === null || costo < 0)) return { ok: false, error: "El costo tiene que ser un monto válido." };
  const salida = await db.salida.findUnique({ where: { id: salidaId }, include: { vehiculo: { select: { costoLogistico: true } } } });
  if (!salida) return { ok: false, error: "Ese vehículo ya no está en el día." };
  if (salida.vehiculo.costoLogistico !== null) return { ok: false, error: "El costo de este vehículo viene de Vehículos y no se cambia desde la hoja de ruta." };
  if (await db.diaCerrado.findUnique({ where: { fecha: salida.fecha } })) return { ok: false, error: "El día está cerrado." };
  if (salida.costoLogistica !== null && (await db.diaListo.findUnique({ where: { fecha: salida.fecha } }))) return { ok: false, error: "La hoja está lista: para cambiar el costo hay que volver a armarla." };
  await db.salida.update({ where: { id: salidaId }, data: { costoLogistica: costo } });
  refrescar();
  return { ok: true };
}

/** Costo de logística por unidad que no hay que pasar (el "tope"); vacío = el de siempre. Lo cambia cualquiera de oficina. */
export async function guardarCostoLogisticoUnidad(texto: string): Promise<Resultado> {
  await exigirOficina();
  const valor = texto.trim() ? leerMonto(texto) : null;
  if (texto.trim() && (valor === null || valor <= 0)) return { ok: false, error: "Tiene que ser un monto mayor a 0 (o dejarlo vacío para usar el de siempre)." };
  await db.empresa.upsert({ where: { id: "principal" }, update: { costoLogisticoUnidad: valor }, create: { id: "principal", costoLogisticoUnidad: valor } });
  refrescar();
  return { ok: true };
}

/** Pone un pedido del día en un vehículo (al final de su recorrido) o lo deja "sin vehículo" (salidaId = null). */
export async function asignarAVehiculo(pedidoId: string, salidaId: string | null): Promise<Resultado> {
  const usuario = await exigirOficina();
  const pedido = await db.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido || pedido.estado === "CANCELADO") return { ok: false, error: "No se puede mover ese pedido." };
  if (!pedido.fechaEntrega) return { ok: false, error: "Primero asignale un día al pedido." };
  if (!(await diaAbierto(pedido.fechaEntrega))) return { ok: false, error: "La hoja de ese día está lista o cerrada: hay que reabrirla para moverla." };
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
  if (!(await diaAbierto(salida.fecha))) return { ok: false, error: "La hoja de ese día está lista o cerrada: hay que reabrirla para moverla." };
  await db.$transaction(ordenIds.map((id, i) => db.pedido.updateMany({ where: { id, salidaId }, data: { ordenRuta: i } })));
  return { ok: true };
}

/** Devuelve un pedido a la lista de PEDIDOS (sin día y sin vehículo). */
export async function devolverAPedidos(pedidoId: string): Promise<Resultado> {
  const usuario = await exigirOficina();
  const pedido = await db.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido || pedido.estado === "CANCELADO") return { ok: false, error: "No se puede mover ese pedido." };
  if (pedido.estado === "ENTREGADO") return { ok: false, error: "Un pedido entregado no se puede mover." };
  if (!(await diaAbierto(pedido.fechaEntrega))) return { ok: false, error: "La hoja de ese día está lista o cerrada: hay que reabrirla para moverla." };
  // Un "no entregado" que vuelve a Pedidos se reactiva (pendiente) y vuelve a contar en la cuenta.
  await db.$transaction(async (tx) => {
    await tx.pedido.update({ where: { id: pedidoId }, data: { fechaEntrega: null, salidaId: null, ordenRuta: 0, ...(pedido.estado === "NO_ENTREGADO" ? { estado: "PENDIENTE" } : {}) } });
    if (pedido.estado === "NO_ENTREGADO") await sincronizarCuentaPedido(tx, pedidoId, usuario.id);
  });
  refrescar();
  return { ok: true };
}

/** Sube o baja una camioneta dentro de la hoja de ese día (para dejar arriba la que se agregó última). Solo con la hoja todavía en armado. */
export async function moverSalida(salidaId: string, sentido: "arriba" | "abajo"): Promise<Resultado> {
  await exigirOficina();
  const salida = await db.salida.findUnique({ where: { id: salidaId } });
  if (!salida) return { ok: false, error: "Ese vehículo ya no está en el día." };
  if (!(await diaAbierto(salida.fecha))) return { ok: false, error: "La hoja de ese día está lista o cerrada: hay que reabrirla para moverla." };
  const todas = await db.salida.findMany({ where: { fecha: salida.fecha }, orderBy: [{ orden: "asc" }, { id: "asc" }] });
  const i = todas.findIndex((x) => x.id === salidaId);
  const j = sentido === "arriba" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= todas.length) return { ok: true };
  [todas[i], todas[j]] = [todas[j], todas[i]];
  await db.$transaction(todas.map((x, n) => db.salida.update({ where: { id: x.id }, data: { orden: n } })));
  refrescar();
  return { ok: true };
}

/** Guarda el orden de los vehículos tal como los dejó el equipo arrastrándolos. */
export async function ordenarVehiculos(ids: string[]): Promise<Resultado> {
  await exigirOficina();
  await db.$transaction(ids.map((id, n) => db.vehiculo.update({ where: { id }, data: { orden: n } })));
  refrescar();
  return { ok: true };
}

/** Cambia la camioneta de una vuelta (ej. cambió el repartidor a mitad del día) sin tocar los pedidos ni su recorrido. Pasa a valer la capacidad y el costo (con IVA) de la nueva camioneta. Se puede con la hoja armando o lista; cerrada no. */
export async function cambiarVehiculoSalida(salidaId: string, vehiculoId: string): Promise<Resultado> {
  await exigirOficina();
  const salida = await db.salida.findUnique({ where: { id: salidaId } });
  if (!salida) return { ok: false, error: "Esa vuelta ya no está en el día." };
  if (await db.diaCerrado.findUnique({ where: { fecha: salida.fecha } })) return { ok: false, error: "El día está cerrado." };
  const vehiculo = await db.vehiculo.findUnique({ where: { id: vehiculoId } });
  if (!vehiculo || !vehiculo.activo || vehiculo.eliminado) return { ok: false, error: "Ese vehículo no está disponible." };
  if (vehiculo.id === salida.vehiculoId) return { ok: true };
  if (await db.salida.findFirst({ where: { fecha: salida.fecha, vehiculoId } })) return { ok: false, error: "Ese vehículo ya sale ese día." };
  await db.salida.update({ where: { id: salidaId }, data: { vehiculoId, costoLogistica: vehiculo.costoLogistico === null ? null : conIvaLogistica(Number(vehiculo.costoLogistico)) } });
  refrescar();
  return { ok: true };
}
