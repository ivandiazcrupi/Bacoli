"use server";

import { mayus, oracion, titulo } from "@/lib/mayusculas";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { IVA_PCT, anotarEntregaEnCuenta, sincronizarCuentaPedido, saldoCliente, importeVigente } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { aFecha, esFechaValida } from "@/lib/fechas";
import { formatoPesos, leerMonto } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";
import { importarPedidosWeb, type ResultadoImportacion } from "@/lib/empretienda";
import { productosParaCliente, type ProductoPedido } from "./datos";

export type Destino = { puntoId: string; clienteId: string; cliente: string; alias: string | null; direccion: string; barrio: string; zona: string };
export type EstadoPedidoForm = { ok?: string; error?: string; aviso?: string } | undefined;
export type DatosPedido = {
  puntoId: string;
  cliente: string;
  clienteId: string;
  sucursal: string;
  facturado: boolean;
  lista: string | null;
  productos: ProductoPedido[];
};

/** Busca sucursales por cliente, marca, sucursal, dirección o barrio: cada palabra puede coincidir con cualquiera. */
export async function buscarDestinos(q: string): Promise<Destino[]> {
  await exigirOficina();
  const palabras = q.trim().split(/\s+/).filter(Boolean).slice(0, 6);
  if (palabras.length === 0) return [];
  const puntos = await db.puntoEntrega.findMany({
    where: {
      activo: true,
      cliente: { activo: true },
      AND: palabras.map((w) => {
        const contiene = { contains: w, mode: "insensitive" as const };
        return { OR: [{ alias: contiene }, { direccion: contiene }, { barrio: contiene }, { cliente: { nombre: contiene } }, { cliente: { razonSocial: contiene } }] };
      }),
    },
    include: { cliente: true, zona: true },
    orderBy: [{ cliente: { nombre: "asc" } }, { alias: "asc" }],
    take: 20,
  });
  return puntos.map((p) => ({
    puntoId: p.id, clienteId: p.clienteId, cliente: p.cliente.nombre, alias: p.alias, direccion: titulo(p.direccion), barrio: p.barrio, zona: p.zona.nombre,
  }));
}

export async function datosNuevoPedido(puntoId: string): Promise<DatosPedido | null> {
  await exigirOficina();
  const punto = await db.puntoEntrega.findUnique({ where: { id: puntoId }, include: { cliente: { include: { listaPrecios: true } } } });
  if (!punto) return null;
  return {
    puntoId,
    cliente: punto.cliente.nombre,
    clienteId: punto.clienteId,
    sucursal: [punto.alias, titulo(punto.direccion)].filter(Boolean).join(" · "),
    facturado: punto.cliente.facturado,
    lista: punto.cliente.listaPrecios?.nombre ?? null,
    productos: await productosParaCliente(punto.clienteId),
  };
}

type Renglon = { productoId: string; nombre: string; sku: string | null; unidad: string; cantidad: number; precioUnitario: number; sinCargo: number; descuentoPct: number; motivoSinCargo: string | null };

async function leerRenglones(formData: FormData): Promise<{ renglones: Renglon[] } | { error: string }> {
  const productos = await db.producto.findMany({ where: { activo: true } });
  const renglones: Renglon[] = [];
  for (const p of productos) {
    const cantidad = Number(String(formData.get(`q_${p.id}`) ?? "0").replace(/\D/g, "") || 0);
    const sinCargo = Number(String(formData.get(`sc_${p.id}`) ?? "0").replace(/\D/g, "") || 0);
    if (cantidad <= 0 && sinCargo <= 0) continue;
    const motivoSinCargo = String(formData.get(`scm_${p.id}`) ?? "").trim() || null;
    if (sinCargo > 0 && !motivoSinCargo) return { error: `Falta el motivo de los paquetes sin cargo de ${p.nombre}.` };
    const descuentoPct = leerMonto(String(formData.get(`bd_${p.id}`) ?? "")) ?? 0;
    if (descuentoPct < 0 || descuentoPct > 100) return { error: `La bonificación de ${p.nombre} tiene que estar entre 0 y 100 %.` };
    const precio = leerMonto(String(formData.get(`pr_${p.id}`) ?? ""));
    // Un renglón que es solo "sin cargo" (recambio) no necesita precio.
    if (cantidad > 0 && (precio === null || precio <= 0)) return { error: `Falta el precio de ${p.nombre}. Cargalo en el pedido o en Precios.` };
    renglones.push({ productoId: p.id, nombre: p.nombre, sku: p.sku, unidad: p.unidad, cantidad, precioUnitario: precio ?? 0, sinCargo, descuentoPct, motivoSinCargo: sinCargo > 0 ? motivoSinCargo : null });
  }
  if (renglones.length === 0) return { error: "Poné la cantidad de al menos un producto." };
  return { renglones };
}

export async function crearPedido(_: EstadoPedidoForm, formData: FormData): Promise<EstadoPedidoForm> {
  const usuario = await exigirOficina();
  const puntoId = String(formData.get("puntoId") ?? "");
  const punto = await db.puntoEntrega.findUnique({ where: { id: puntoId }, include: { cliente: true } });
  if (!punto) return { error: "Elegí el cliente y la sucursal." };
  const leidos = await leerRenglones(formData);
  if ("error" in leidos) return { error: leidos.error };

  const conFactura = formData.get("conFactura") === "1";
  const ivaPct = conFactura ? IVA_PCT : 0;
  const total = importeVigente(leidos.renglones.map((r) => ({ cantidad: r.cantidad, cantidadEntregada: null, precioUnitario: r.precioUnitario, descuentoPct: r.descuentoPct })), ivaPct, "PENDIENTE");

  // Límites de deuda del cliente: se avisa y solo un dueño puede autorizar (no se bloquea a "cuenta sin límite").
  const cliente = punto.cliente;
  let autorizadoPorId: string | null = null;
  if (!cliente.sinLimite && (cliente.maxMonto !== null || cliente.maxPedidosImpagos !== null)) {
    const saldo = await saldoCliente(db, cliente.id);
    const impagos = await db.pedido.count({ where: { clienteId: cliente.id, pagado: false, estado: { in: ["PENDIENTE", "ENTREGADO"] } } });
    const motivos: string[] = [];
    if (cliente.maxMonto !== null && saldo + total > Number(cliente.maxMonto)) {
      motivos.push(`con este pedido debería ${formatoPesos(saldo + total)} y su máximo es ${formatoPesos(Number(cliente.maxMonto))}`);
    }
    if (cliente.maxPedidosImpagos !== null && impagos >= cliente.maxPedidosImpagos) {
      motivos.push(`ya tiene ${impagos} ${impagos === 1 ? "pedido sin pagar" : "pedidos sin pagar"} y su máximo es ${cliente.maxPedidosImpagos}`);
    }
    if (motivos.length) {
      if (usuario.rol !== "DUENO") return { aviso: `Este cliente pasó su límite: ${motivos.join("; ")}. Necesita la autorización de un dueño.` };
      if (formData.get("autorizar") !== "1") return { aviso: `Este cliente pasó su límite: ${motivos.join("; ")}.` };
      autorizadoPorId = usuario.id;
    }
  }

  const ultimo = await db.pedido.aggregate({ where: { fechaEntrega: null }, _max: { ordenDia: true } });
  await db.$transaction(async (tx) => {
    const pedido = await tx.pedido.create({
      data: {
        clienteId: cliente.id,
        puntoId,
        conFactura,
        ivaPct,
        nota: oracion(String(formData.get("nota") ?? "")) || null,
        ordenDia: (ultimo._max.ordenDia ?? -1) + 1,
        creadoPorId: usuario.id,
        autorizadoPorId,
        items: { create: leidos.renglones },
      },
    });
    await sincronizarCuentaPedido(tx, pedido.id, usuario.id);
  });
  revalidatePath("/pedidos", "layout");
  return { ok: `Pedido de ${cliente.nombre} cargado. Quedó en la lista de Pedidos, esperando día.` };
}

export async function actualizarPedido(pedidoId: string, _: EstadoPedidoForm, formData: FormData): Promise<EstadoPedidoForm> {
  const usuario = await exigirOficina();
  const pedido = await db.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido) return { error: "No encontré el pedido." };
  if (pedido.estado !== "PENDIENTE") return { error: "Solo se puede modificar un pedido pendiente. Reabrilo primero." };
  const leidos = await leerRenglones(formData);
  if ("error" in leidos) return { error: leidos.error };

  const conFactura = formData.get("conFactura") === "1";
  await db.$transaction(async (tx) => {
    await tx.pedidoItem.deleteMany({ where: { pedidoId } });
    await tx.pedido.update({
      where: { id: pedidoId },
      data: { conFactura, ivaPct: conFactura ? IVA_PCT : 0, nota: oracion(String(formData.get("nota") ?? "")) || null, items: { create: leidos.renglones } },
    });
    await sincronizarCuentaPedido(tx, pedidoId, usuario.id);
  });
  revalidatePath("/pedidos", "layout");
  revalidatePath(`/pedidos/${pedidoId}`);
  redirect(`/pedidos/${pedidoId}`);
}

/** Modifica un pedido de la tienda online: datos de entrega, cantidades de cada renglón (en 0 se saca), total pagado y nota. */
export async function actualizarPedidoWeb(pedidoId: string, _: EstadoPedidoForm, formData: FormData): Promise<EstadoPedidoForm> {
  await exigirOficina();
  const pedido = await db.pedido.findUnique({ where: { id: pedidoId }, include: { items: true } });
  if (!pedido || pedido.origen !== "WEB") return { error: "No encontré el pedido de la tienda." };
  if (pedido.estado !== "PENDIENTE") return { error: "Solo se puede modificar un pedido pendiente. Reabrilo primero." };

  const nombre = mayus(String(formData.get("nombre") ?? ""));
  if (!nombre) return { error: "Falta el nombre." };
  const total = leerMonto(String(formData.get("total") ?? ""));
  if (total === null || total < 0) return { error: "El total tiene que ser un monto válido." };
  const cantidades = pedido.items.map((i) => ({ id: i.id, cantidad: Number(String(formData.get(`q_${i.id}`) ?? i.cantidad).replace(/\D/g, "") || 0) }));
  if (cantidades.every((c) => c.cantidad === 0)) return { error: "El pedido tiene que llevar al menos un producto." };

  await db.$transaction(async (tx) => {
    for (const c of cantidades) {
      if (c.cantidad === 0) await tx.pedidoItem.delete({ where: { id: c.id } });
      else await tx.pedidoItem.update({ where: { id: c.id }, data: { cantidad: c.cantidad } });
    }
    await tx.pedido.update({
      where: { id: pedidoId },
      data: {
        webNombre: nombre,
        webBarrio: mayus(String(formData.get("barrio") ?? "")) || null,
        webDireccion: titulo(String(formData.get("direccion") ?? "").trim()) || null,
        webTelefono: String(formData.get("telefono") ?? "").trim() || null,
        webTotal: total,
        nota: oracion(String(formData.get("nota") ?? "")) || null,
      },
    });
  });
  revalidatePath("/pedidos", "layout");
  revalidatePath(`/pedidos/${pedidoId}`);
  redirect(`/pedidos/${pedidoId}`);
}

/** Mueve un pedido a "bandeja" o a un día ("YYYY-MM-DD") y guarda el orden de esa columna (el número de la hoja del día). */
export async function moverPedido(pedidoId: string, destino: string, ordenIds: string[]): Promise<{ ok: boolean; error?: string }> {
  const usuario = await exigirOficina();
  if (destino !== "bandeja" && !esFechaValida(destino)) return { ok: false, error: "Fecha inválida." };
  if (!ordenIds.includes(pedidoId) || ordenIds.length > 300) return { ok: false, error: "Pedido inválido." };
  const pedido = await db.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido || pedido.estado === "CANCELADO") return { ok: false, error: "No se puede mover ese pedido." };
  if (pedido.estado === "ENTREGADO") return { ok: false, error: "Un pedido entregado no se puede mover." };
  const cerrados = await db.diaCerrado.findMany({ where: { fecha: { in: [pedido.fechaEntrega, destino === "bandeja" ? null : aFecha(destino)].filter((f): f is Date => !!f) } } });
  if (cerrados.length) return { ok: false, error: "Ese día está cerrado. Un dueño puede reabrirlo." };

  await db.$transaction(async (tx) => {
    await tx.pedido.update({
      where: { id: pedidoId },
      data: { fechaEntrega: destino === "bandeja" ? null : aFecha(destino), ...(pedido.estado === "NO_ENTREGADO" ? { estado: "PENDIENTE" } : {}) },
    });
    if (pedido.estado === "NO_ENTREGADO") await sincronizarCuentaPedido(tx, pedidoId, usuario.id); // vuelve a contar en la cuenta
    for (const [indice, id] of ordenIds.entries()) await tx.pedido.update({ where: { id }, data: { ordenDia: indice } });
  });
  return { ok: true };
}

/** Asigna un pedido sin día a un día, al final de la lista del reparto. Sirve para el botón del día y para arrastrar. */
export async function asignarADia(pedidoId: string, fecha: string): Promise<{ ok: boolean; error?: string }> {
  await exigirOficina();
  if (!esFechaValida(fecha)) return { ok: false, error: "Fecha inválida." };
  const pedido = await db.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido || pedido.estado === "CANCELADO") return { ok: false, error: "No se puede asignar ese pedido." };
  if (pedido.estado === "ENTREGADO") return { ok: false, error: "Un pedido entregado no se puede mover." };
  if (await db.diaCerrado.findUnique({ where: { fecha: aFecha(fecha) } })) return { ok: false, error: "Ese día está cerrado. Un dueño puede reabrirlo." };
  const ultimo = await db.pedido.aggregate({ where: { fechaEntrega: aFecha(fecha) }, _max: { ordenDia: true } });
  await db.pedido.update({ where: { id: pedidoId }, data: { fechaEntrega: aFecha(fecha), ordenDia: (ultimo._max.ordenDia ?? -1) + 1, salidaId: null, ordenRuta: 0 } }); // al cambiar de día deja el vehículo
  revalidatePath("/pedidos", "layout");
  return { ok: true };
}

const refrescar = (id: string) => {
  revalidatePath("/pedidos", "layout");
  revalidatePath(`/pedidos/${id}`);
};

async function cambiarEstado(pedidoId: string, cambios: Prisma.PedidoUpdateInput, borrarEntregas = false) {
  const usuario = await exigirOficina();
  await db.$transaction(async (tx) => {
    // Si deja de estar entregado y tenía el cobro marcado, el cobro se deshace solo (con su anulación en la cuenta).
    const actual = await tx.pedido.findUnique({ where: { id: pedidoId }, select: { cobro: true, medioCobro: true, montoCobrado: true, clienteId: true } });
    let limpiar: Prisma.PedidoUpdateInput = {};
    if (cambios.estado && cambios.estado !== "ENTREGADO" && actual?.cobro) {
      if (actual.cobro === "COBRADO" && actual.clienteId && actual.montoCobrado) {
        await tx.movimientoCuenta.create({ data: { clienteId: actual.clienteId, pedidoId, tipo: "ANULACION_PAGO", monto: actual.montoCobrado, medio: actual.medioCobro, nota: "Cobro anulado", usuarioId: usuario.id } });
      }
      limpiar = { cobro: null, medioCobro: null, montoCobrado: null, pagado: false };
    }
    await tx.pedido.update({ where: { id: pedidoId }, data: { ...cambios, ...limpiar } });
    if (borrarEntregas) await tx.pedidoItem.updateMany({ where: { pedidoId }, data: { cantidadEntregada: null } });
    await sincronizarCuentaPedido(tx, pedidoId, usuario.id);
  });
  refrescar(pedidoId);
}

export async function marcarEntregado(pedidoId: string, _: EstadoPedidoForm, formData: FormData): Promise<EstadoPedidoForm> {
  const usuario = await exigirOficina();
  const pedido = await db.pedido.findUnique({ where: { id: pedidoId }, include: { items: true } });
  if (!pedido) return { error: "No encontré el pedido." };
  if (pedido.estado === "CANCELADO") return { error: "El pedido está cancelado." };

  if (pedido.conFactura && !pedido.numeroFactura?.trim()) return { error: "Este pedido lleva factura: cargá primero el N° de factura y después confirmá la entrega." };

  const entregas = pedido.items.map((i) => ({ id: i.id, cantidad: i.cantidad, entregada: Math.min(i.cantidad, Number(String(formData.get(`e_${i.id}`) ?? i.cantidad).replace(/\D/g, "") || 0)) }));
  if (entregas.every((e) => e.entregada === 0) && pedido.items.every((i) => i.sinCargo === 0)) return { error: "No se entregó nada. Si no se pudo entregar, usá \"No entregado\"." };

  await db.$transaction(async (tx) => {
    for (const e of entregas) await tx.pedidoItem.update({ where: { id: e.id }, data: { cantidadEntregada: e.entregada } });
    await tx.pedido.update({ where: { id: pedidoId }, data: { estado: "ENTREGADO" } });
    if (pedido.estado !== "ENTREGADO") await anotarEntregaEnCuenta(tx, pedidoId, pedido.clienteId, usuario.id);
    await sincronizarCuentaPedido(tx, pedidoId, usuario.id);
  });
  refrescar(pedidoId);
  return { ok: entregas.some((e) => e.entregada < e.cantidad) ? "Entrega parcial guardada." : "Entregado." };
}

export async function marcarNoEntregado(formData: FormData) {
  await cambiarEstado(String(formData.get("id")), { estado: "NO_ENTREGADO" }, true);
}
export async function reabrirPedido(formData: FormData) {
  await cambiarEstado(String(formData.get("id")), { estado: "PENDIENTE" }, true);
}
export async function cancelarPedido(formData: FormData) {
  const id = String(formData.get("id"));
  const pedido = await db.pedido.findUnique({ where: { id }, select: { clienteId: true, cobro: true, estado: true } });
  // Un pedido ya cobrado no se cancela hasta deshacer el cobro (si no, el pago quedaría suelto como saldo a favor).
  if (pedido?.clienteId && pedido.estado === "ENTREGADO" && pedido.cobro === "COBRADO") return;
  await cambiarEstado(id, { estado: "CANCELADO", fechaEntrega: null, salida: { disconnect: true } }, true);
}

/** Botón "Traer pedidos ahora": lee la planilla de la tienda online y carga los pedidos nuevos. */
export async function traerPedidosWeb(): Promise<ResultadoImportacion> {
  await exigirOficina();
  const r = await importarPedidosWeb();
  revalidatePath("/pedidos", "layout");
  return r;
}

/** Observación del pedido (se edita desde el resumen). Queda en formato oración y se ve en rojo debajo de la dirección. */
export async function guardarNotaPedido(pedidoId: string, texto: string): Promise<{ ok: boolean; texto: string }> {
  await exigirOficina();
  const nota = oracion(texto);
  await db.pedido.update({ where: { id: pedidoId }, data: { nota: nota || null } });
  revalidatePath("/pedidos", "layout");
  return { ok: true, texto: nota };
}
