"use server";

import { webPagado, ERROR_WEB_SIN_PAGO } from "@/lib/webpago";
import { leerCobro, marcarCobroEnTx } from "@/lib/cobrar";
import { errorSiHojaFija } from "@/lib/dias";
import { mayus, oracion, titulo } from "@/lib/mayusculas";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { IVA_ENVIO, IVA_PCT, anotarEntregaEnCuenta, sincronizarCuentaPedido, saldoCliente, importeVigente } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { aFecha, esFechaValida, hoy } from "@/lib/fechas";
import { formatoPesos, leerMonto } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";
import { importarPedidosWeb, type ResultadoImportacion } from "@/lib/empretienda";
import { productosParaCliente, type ProductoPedido } from "./datos";

export type Destino = { puntoId: string; clienteId: string; cliente: string; alias: string | null; direccion: string; barrio: string; zona: string; telefono: string };
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
    puntoId: p.id, clienteId: p.clienteId, cliente: p.cliente.nombre, alias: p.alias, direccion: titulo(p.direccion), barrio: p.barrio, zona: p.zona.nombre, telefono: p.telefono ?? "",
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

type Renglon = { ivaPct?: number | null; productoId: string | null; paquetesPor?: number; nombre: string; sku: string | null; unidad: string; cantidad: number; precioUnitario: number; sinCargo: number; descuentoPct: number; motivoSinCargo: string | null };

/** IVA elegido para un renglón (solo se usa si el pedido lleva factura). Si falta o no es una alícuota válida, queda sin tasa propia. */
const ALICUOTAS = [0, 2.5, 5, 10.5, 21, 27];
function leerIva(valor: FormDataEntryValue | null): number | null {
  const n = leerMonto(String(valor ?? ""));
  return n !== null && ALICUOTAS.includes(n) ? n : null;
}

async function leerRenglones(formData: FormData): Promise<{ renglones: Renglon[] } | { error: string }> {
  const conFactura = formData.get("conFactura") === "1";
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
    if (cantidad > 0 && (precio === null || precio <= 0)) return { error: `Falta el precio de ${p.nombre}. Escribilo en el pedido.` };
    renglones.push({ productoId: p.id, nombre: p.nombre, sku: p.sku, unidad: p.unidad, cantidad, precioUnitario: precio ?? 0, sinCargo, descuentoPct, motivoSinCargo: sinCargo > 0 ? motivoSinCargo : null, ivaPct: conFactura ? (leerIva(formData.get(`iva_${p.id}`)) ?? 0) : null });
  }
  // Renglones escritos a mano ("Otro producto"): nombre libre + cantidad + precio (+ IVA si lleva factura). Los vacíos se ignoran.
  const cuantos = Math.min(30, Number(formData.get("m_total") ?? 0) || 0);
  for (let i = 0; i < cuantos; i++) {
    const nombre = mayus(String(formData.get(`mn_${i}`) ?? "")).slice(0, 80);
    if (!nombre) continue;
    const cantidad = Number(String(formData.get(`mc_${i}`) ?? "").replace(/\D/g, "") || 0);
    if (cantidad <= 0) return { error: `Falta la cantidad de “${nombre}”.` };
    const precio = leerMonto(String(formData.get(`mp_${i}`) ?? ""));
    if (precio === null || precio <= 0) return { error: `Falta el precio de “${nombre}”.` };
    const unidad = String(formData.get(`mu_${i}`) ?? "") === "unidad" ? "unidad" : "paquete"; // el cliente pide por unidad o por paquete
    const descuentoPct = leerMonto(String(formData.get(`mb_${i}`) ?? "")) ?? 0;
    if (descuentoPct < 0 || descuentoPct > 100) return { error: `La bonificación de “${nombre}” tiene que estar entre 0 y 100 %.` };
    renglones.push({ productoId: null, nombre, sku: null, unidad, cantidad, precioUnitario: precio, sinCargo: 0, descuentoPct, motivoSinCargo: null, ivaPct: conFactura ? (leerIva(formData.get(`mi_${i}`)) ?? 0) : null });
  }
  if (renglones.length === 0) return { error: "Poné la cantidad de al menos un producto." };
  // Envío: un renglón aparte (no es un producto: no suma paquetes ni lleva bonificación) que entra en el total, el remito y la cuenta.
  const envio = leerMonto(String(formData.get("envio") ?? ""));
  if (envio !== null && envio < 0) return { error: "El envío tiene que ser un monto válido." };
  if (envio) renglones.push({ productoId: null, paquetesPor: 0, nombre: "ENVÍO", sku: null, unidad: "envío", cantidad: 1, precioUnitario: envio, sinCargo: 0, descuentoPct: 0, motivoSinCargo: null, ivaPct: conFactura ? IVA_ENVIO : null });
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
  const ivaPct = conFactura ? IVA_PCT : 0; // con factura: cada renglón lleva su propio IVA; este valor solo marca que el pedido lleva IVA
  const total = importeVigente(leidos.renglones.map((r) => ({ cantidad: r.cantidad, cantidadEntregada: null, precioUnitario: r.precioUnitario, descuentoPct: r.descuentoPct, ivaPct: r.ivaPct })), ivaPct, "PENDIENTE");

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
  // Un pedido "no entregado" (de antes del flujo con silueta) también se puede corregir: al guardar vuelve a pendiente.
  if (pedido.estado !== "PENDIENTE" && pedido.estado !== "NO_ENTREGADO") return { error: "Solo se puede modificar un pedido pendiente. Reabrilo primero." };
  const hojaFija = await errorSiHojaFija(pedido.fechaEntrega);
  if (hojaFija) return { error: hojaFija };
  const leidos = await leerRenglones(formData);
  if ("error" in leidos) return { error: leidos.error };

  const conFactura = formData.get("conFactura") === "1";
  await db.$transaction(async (tx) => {
    await tx.pedidoItem.deleteMany({ where: { pedidoId } });
    await tx.pedido.update({
      where: { id: pedidoId },
      data: { conFactura, ...(pedido.estado === "NO_ENTREGADO" ? { estado: "PENDIENTE" as const } : {}), ivaPct: conFactura ? IVA_PCT : 0, nota: oracion(String(formData.get("nota") ?? "")) || null, items: { create: leidos.renglones } },
    });
    await sincronizarCuentaPedido(tx, pedidoId, usuario.id);
  });
  revalidatePath("/pedidos", "layout");
  revalidatePath(`/pedidos/${pedidoId}`);
  redirect(`/pedidos/${pedidoId}`);
}

/** Carga a mano un pedido minorista (de la tienda, pero que llegó por otro lado, ej. WhatsApp). Queda igual que los de la tienda: pagos por transferencia, sin cuenta corriente. */
export async function crearPedidoWebManual(_: EstadoPedidoForm, formData: FormData): Promise<EstadoPedidoForm> {
  const usuario = await exigirOficina();
  const nombre = mayus(String(formData.get("nombre") ?? ""));
  if (!nombre) return { error: "Falta el nombre." };
  const direccion = titulo(String(formData.get("direccion") ?? "").trim());
  if (!direccion) return { error: "Falta la dirección de entrega." };
  const total = leerMonto(String(formData.get("total") ?? ""));
  if (total === null || total <= 0) return { error: "Poné el total que paga el cliente (con el envío, si lo lleva)." };

  const productos = await db.producto.findMany({ where: { activo: true } });
  const items: Prisma.PedidoItemCreateWithoutPedidoInput[] = [];
  for (const p of productos) {
    const cantidad = Number(String(formData.get(`q_${p.id}`) ?? "0").replace(/\D/g, "") || 0);
    if (cantidad > 0) items.push({ producto: { connect: { id: p.id } }, nombre: p.nombre, sku: p.sku, unidad: p.unidad, cantidad, precioUnitario: 0 });
  }
  // Producto de la tienda que no está en el catálogo, escrito a mano (si no pone cantidad, se toma 1).
  const otroNombre = mayus(String(formData.get("otro_nombre") ?? "")).slice(0, 80);
  if (otroNombre) {
    const cantidadOtro = Number(String(formData.get("otro_cantidad") ?? "").replace(/\D/g, "") || 1);
    items.push({ nombre: otroNombre, sku: null, unidad: "unidad", cantidad: cantidadOtro, precioUnitario: 0 });
  }
  if (items.length === 0) return { error: "Poné la cantidad de al menos un producto." };

  const pagoElegido = String(formData.get("pago") ?? (formData.get("pagado") === "1" ? "PAGO_TRANSFERENCIA" : "PENDIENTE"));
  const webPago = pagoElegido === "PAGO_MP" ? "PAGO_MP" : pagoElegido === "PAGO_TRANSFERENCIA" ? "PAGO_TRANSFERENCIA" : "PENDIENTE";
  // N° de orden de la tienda (opcional): si lo trae, se usa ese (no puede repetirse); si no, uno propio M-1, M-2…
  const ordenTienda = String(formData.get("orden") ?? "").trim().replace(/\s+/g, "").slice(0, 20);
  if (ordenTienda && (await db.pedido.findUnique({ where: { webOrden: ordenTienda }, select: { id: true } }))) return { error: `El N° de orden ${ordenTienda} ya está cargado. Revisá que no sea un pedido repetido.` };
  const ultimo = await db.pedido.aggregate({ where: { fechaEntrega: null }, _max: { ordenDia: true } });
  const numero = await db.$transaction(async (tx) => {
    const n = ordenTienda ? { ultimo: 0 } : await tx.numerador.upsert({ where: { id: "WEB_MANUAL" }, update: { ultimo: { increment: 1 } }, create: { id: "WEB_MANUAL", ultimo: 1 } });
    await tx.pedido.create({
      data: {
        origen: "WEB",
        estado: "PENDIENTE",
        conFactura: false,
        ivaPct: 0,
        creadoPorId: usuario.id,
        ordenDia: (ultimo._max.ordenDia ?? -1) + 1,
        webOrden: ordenTienda || `M-${n.ultimo}`,
        webNombre: nombre,
        webDireccion: direccion,
        webBarrio: mayus(String(formData.get("barrio") ?? "")) || null,
        webTelefono: String(formData.get("telefono") ?? "").trim() || null,
        webTotal: total,
        webPago,
        ...(webPago === "PAGO_TRANSFERENCIA" ? { webPagoPor: usuario.nombre, webPagoEn: new Date() } : {}),
        nota: oracion(String(formData.get("nota") ?? "")) || null,
        items: { create: items },
      },
    });
    return ordenTienda || `M-${n.ultimo}`;
  });
  revalidatePath("/pedidos", "layout");
  return { ok: `Pedido minorista de ${nombre} cargado (N° ${numero}). Quedó en Pedidos → Minoristas (web), esperando día.` };
}

/** Lee los datos de una cobranza del formulario (nombre, dirección y monto son obligatorios). */
function leerCobranza(formData: FormData) {
  const nombre = mayus(String(formData.get("nombre") ?? ""));
  if (!nombre) return { error: "Falta el nombre de a quién se le cobra." };
  const direccion = titulo(String(formData.get("direccion") ?? "").trim());
  if (!direccion) return { error: "Falta la dirección donde se cobra." };
  const monto = leerMonto(String(formData.get("monto") ?? ""));
  if (monto === null || monto <= 0) return { error: "Poné cuánta plata hay que cobrar." };
  return {
    nombre, direccion, monto,
    barrio: mayus(String(formData.get("barrio") ?? "")) || null,
    telefono: String(formData.get("telefono") ?? "").trim() || null,
    nota: oracion(String(formData.get("nota") ?? "")) || null,
  };
}

/**
 * Carga una cobranza: una parada de la hoja de ruta para ir a cobrar un monto a una dirección. No lleva productos, no suma carga ni
 * facturación y NO pasa por la cuenta corriente (no se enlaza a ningún cliente: los datos se copian en el pedido).
 */
export async function crearCobranza(_: EstadoPedidoForm, formData: FormData): Promise<EstadoPedidoForm> {
  const usuario = await exigirOficina();
  const d = leerCobranza(formData);
  if ("error" in d) return { error: d.error };
  const ultimo = await db.pedido.aggregate({ where: { fechaEntrega: null }, _max: { ordenDia: true } });
  await db.pedido.create({
    data: {
      origen: "COBRANZA", estado: "PENDIENTE", conFactura: false, ivaPct: 0, creadoPorId: usuario.id,
      ordenDia: (ultimo._max.ordenDia ?? -1) + 1,
      webNombre: d.nombre, webDireccion: d.direccion, webBarrio: d.barrio, webTelefono: d.telefono,
      cobrarMonto: d.monto, nota: d.nota,
    },
  });
  revalidatePath("/pedidos", "layout");
  return { ok: `Cobranza de ${d.nombre} por $ ${d.monto.toLocaleString("es-AR")} cargada. Quedó en Pedidos → Cobranzas, esperando día.` };
}

/** Modifica una cobranza que todavía no se cobró (a quién, dónde, cuánto, nota). */
export async function actualizarCobranza(pedidoId: string, _: EstadoPedidoForm, formData: FormData): Promise<EstadoPedidoForm> {
  await exigirOficina();
  const pedido = await db.pedido.findUnique({ where: { id: pedidoId }, select: { origen: true, estado: true, fechaEntrega: true } });
  if (!pedido || pedido.origen !== "COBRANZA") return { error: "No encontré la cobranza." };
  if (pedido.estado === "ENTREGADO") return { error: "Esa cobranza ya se cobró. Deshacé el cobro desde la hoja de ruta para modificarla." };
  if (await errorSiHojaFija(pedido.fechaEntrega)) return { error: "La hoja de ruta de ese día ya está lista o cerrada: volvela a armar para modificar la cobranza." };
  const d = leerCobranza(formData);
  if ("error" in d) return { error: d.error };
  await db.pedido.update({ where: { id: pedidoId }, data: { webNombre: d.nombre, webDireccion: d.direccion, webBarrio: d.barrio, webTelefono: d.telefono, cobrarMonto: d.monto, nota: d.nota } });
  revalidatePath("/pedidos", "layout");
  return { ok: "Cobranza guardada." };
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

  // Agregado por fuera ("sumame 2 paquetes más"): renglones nuevos marcados "(POR FUERA)" y, si se cobra algo, el total sube y el pago vuelve a pendiente.
  const montoExtra = Math.max(0, leerMonto(String(formData.get("extra_monto") ?? "")) ?? 0);
  const productosExtra = await db.producto.findMany({ where: { activo: true, sku: { in: ["PPT01", "PPC02"] } } });
  const nuevos: Prisma.PedidoItemCreateWithoutPedidoInput[] = [];
  for (const p of productosExtra) {
    const q = Number(String(formData.get(`x_${p.id}`) ?? "0").replace(/\D/g, "") || 0);
    if (q > 0) nuevos.push({ producto: { connect: { id: p.id } }, nombre: `${p.nombre} (POR FUERA)`, sku: p.sku, unidad: p.unidad, cantidad: q, precioUnitario: 0 });
  }
  const otro = mayus(String(formData.get("x_otro_nombre") ?? "")).slice(0, 70);
  if (otro) nuevos.push({ nombre: `${otro} (POR FUERA)`, sku: null, unidad: "unidad", cantidad: Number(String(formData.get("x_otro_cantidad") ?? "").replace(/\D/g, "") || 1), precioUnitario: 0 });
  if (montoExtra > 0 && nuevos.length === 0) return { error: "Elegí qué producto se agregó por fuera (o dejá el monto vacío)." };
  const volverAPendiente = montoExtra > 0 && (pedido.webPago === "PAGO_MP" || pedido.webPago === "PAGO_TRANSFERENCIA");

  await db.$transaction(async (tx) => {
    for (const c of cantidades) {
      if (c.cantidad === 0) await tx.pedidoItem.delete({ where: { id: c.id } });
      else await tx.pedidoItem.update({ where: { id: c.id }, data: { cantidad: c.cantidad } });
    }
    for (const n of nuevos) await tx.pedidoItem.create({ data: { ...n, pedido: { connect: { id: pedidoId } } } });
    await tx.pedido.update({
      where: { id: pedidoId },
      data: {
        ...(montoExtra > 0 ? { webExtra: Number(pedido.webExtra ?? 0) + montoExtra } : {}),
        ...(volverAPendiente ? { webPago: "PENDIENTE", webPagoPor: null, webPagoEn: null } : {}),
        webNombre: nombre,
        webBarrio: mayus(String(formData.get("barrio") ?? "")) || null,
        webDireccion: titulo(String(formData.get("direccion") ?? "").trim()) || null,
        webTelefono: String(formData.get("telefono") ?? "").trim() || null,
        webTotal: total + montoExtra,
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
  if (destino !== "bandeja" && destino < hoy()) return { ok: false, error: "Ese día ya pasó: no se le suman pedidos." };
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
  const usuario = await exigirOficina();
  if (!esFechaValida(fecha)) return { ok: false, error: "Fecha inválida." };
  if (fecha < hoy()) return { ok: false, error: "Ese día ya pasó: no se le suman pedidos. Elegí hoy o un día que viene." };
  const pedido = await db.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido || pedido.estado === "CANCELADO") return { ok: false, error: "No se puede asignar ese pedido." };
  if (pedido.estado === "ENTREGADO") return { ok: false, error: "Un pedido entregado no se puede mover." };
  // Ni se le suman pedidos a una hoja lista o cerrada, ni se saca un pedido de ella (para eso está "No entregado").
  const errorDestino = await errorSiHojaFija(aFecha(fecha));
  if (errorDestino) return { ok: false, error: errorDestino };
  const errorOrigen = await errorSiHojaFija(pedido.fechaEntrega);
  if (errorOrigen) return { ok: false, error: errorOrigen };
  const ultimo = await db.pedido.aggregate({ where: { fechaEntrega: aFecha(fecha) }, _max: { ordenDia: true } });
  await db.$transaction(async (tx) => {
    // al cambiar de día deja el vehículo; un "no entregado" se reactiva (pendiente) y vuelve a contar en la cuenta
    await tx.pedido.update({ where: { id: pedidoId }, data: { fechaEntrega: aFecha(fecha), ordenDia: (ultimo._max.ordenDia ?? -1) + 1, salidaId: null, ordenRuta: 0, ...(pedido.estado === "NO_ENTREGADO" ? { estado: "PENDIENTE" } : {}) } });
    if (pedido.estado === "NO_ENTREGADO") await sincronizarCuentaPedido(tx, pedidoId, usuario.id);
  });
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

  const cobro = leerCobro(String(formData.get("cobro") ?? ""));
  if (pedido.webOrden && !webPagado(pedido.webOrden, pedido.webPago)) return { error: ERROR_WEB_SIN_PAGO };
  if (!cobro && !webPagado(pedido.webOrden, pedido.webPago)) return { error: "Elegí cómo se cobra antes de confirmar la entrega." };

  const entregas = pedido.items.map((i) => ({ id: i.id, cantidad: i.cantidad, entregada: Math.min(i.cantidad, Number(String(formData.get(`e_${i.id}`) ?? i.cantidad).replace(/\D/g, "") || 0)) }));
  if (entregas.every((e) => e.entregada === 0) && pedido.items.every((i) => i.sinCargo === 0)) return { error: "No se entregó nada. Si no se pudo entregar, usá \"No entregado\"." };

  let errorCobro: string | null = null;
  await db.$transaction(async (tx) => {
    // Si ya estaba cobrado (se está corrigiendo la entrega), el cobro anterior se anula y se marca el nuevo.
    if (pedido.cobro === "COBRADO" && pedido.clienteId && pedido.montoCobrado) {
      await tx.movimientoCuenta.create({ data: { clienteId: pedido.clienteId, pedidoId, tipo: "ANULACION_PAGO", monto: pedido.montoCobrado, medio: pedido.medioCobro, nota: "Cobro anulado", usuarioId: usuario.id } });
    }
    for (const e of entregas) await tx.pedidoItem.update({ where: { id: e.id }, data: { cantidadEntregada: e.entregada } });
    await tx.pedido.update({ where: { id: pedidoId }, data: { estado: "ENTREGADO", cobro: null, medioCobro: null, montoCobrado: null, pagado: false } });
    if (pedido.estado !== "ENTREGADO") await anotarEntregaEnCuenta(tx, pedidoId, pedido.clienteId, usuario.id);
    await sincronizarCuentaPedido(tx, pedidoId, usuario.id);
    errorCobro = await marcarCobroEnTx(tx, pedidoId, cobro, usuario.id);
    if (errorCobro) throw new Error(errorCobro);
  }).catch((e) => {
    if (!errorCobro) throw e;
  });
  if (errorCobro) return { error: errorCobro };
  refrescar(pedidoId);
  return { ok: entregas.some((e) => e.entregada < e.cantidad) ? "Entrega parcial guardada." : "Entregado." };
}

export async function reabrirPedido(formData: FormData) {
  await cambiarEstado(String(formData.get("id")), { estado: "PENDIENTE" }, true);
}
export async function cancelarPedido(formData: FormData) {
  const id = String(formData.get("id"));
  const pedido = await db.pedido.findUnique({ where: { id }, select: { clienteId: true, cobro: true, estado: true, fechaEntrega: true, conFactura: true, numeroFactura: true } });
  // Una factura ya emitida (con número) no se anula "porque sí": se anula con una nota de crédito (CUENTA CORRIENTE), así no se pierde de la cuenta ni de la numeración.
  if (pedido?.conFactura && pedido.numeroFactura?.trim()) {
    // ...salvo que las notas de crédito (no anuladas) ya cubran toda la factura: ahí el pedido sí se puede cancelar.
    const completo = await db.pedido.findUnique({ where: { id }, include: { items: true, ncAplicaciones: { where: { nota: { anuladaEn: null } } } } });
    const total = completo ? importeVigente(completo.items, Number(completo.ivaPct), completo.estado === "ENTREGADO" ? "ENTREGADO" : "PENDIENTE", completo.webTotal) : 0;
    const cubierto = completo?.ncAplicaciones.reduce((t, a) => t + Number(a.monto), 0) ?? 0;
    if (!(total > 0 && cubierto >= total - 0.01)) return;
  }
  if (await errorSiHojaFija(pedido?.fechaEntrega)) return; // con la hoja lista o cerrada no se cancela: se usa "No entregado" o se reabre la hoja
  // Un pedido ya cobrado no se cancela hasta deshacer el cobro (si no, el pago quedaría suelto como saldo a favor).
  if (pedido?.clienteId && pedido.estado === "ENTREGADO" && pedido.cobro === "COBRADO") return;
  await cambiarEstado(id, { estado: "CANCELADO", fechaEntrega: null, salida: { disconnect: true } }, true);
}

/** Confirma que llegó la transferencia de un pedido de la tienda online: recién ahí puede asignarse a un día y salir. */
export async function confirmarPagoWeb(pedidoId: string): Promise<{ ok: boolean; error?: string }> {
  return marcarPagoWeb(pedidoId, true);
}

/** Cambia el estado de pago de un pedido de la tienda (transferencia): confirmado o vuelve a pendiente. No toca los de Mercado Pago ni los ya entregados. */
export async function marcarPagoWeb(pedidoId: string, pagado: boolean): Promise<{ ok: boolean; error?: string }> {
  const usuario = await exigirOficina();
  const pedido = await db.pedido.findUnique({ where: { id: pedidoId }, select: { webOrden: true, webPago: true, estado: true } });
  if (!pedido?.webOrden) return { ok: false, error: "Solo los pedidos de la tienda online tienen estado de pago." };
  if (pedido.estado === "CANCELADO") return { ok: false, error: "El pedido está cancelado." };
  if (pedido.estado === "ENTREGADO") return { ok: false, error: "El pedido ya se entregó: primero deshacé la entrega." };
  if (pedido.webPago === "PAGO_MP") return { ok: false, error: "Este pedido se pagó con Mercado Pago." };
  await db.pedido.update({ where: { id: pedidoId }, data: { webPago: pagado ? "PAGO_TRANSFERENCIA" : "PENDIENTE", webPagoPor: pagado ? usuario.nombre : null, webPagoEn: pagado ? new Date() : null } });
  revalidatePath("/pedidos", "layout");
  revalidatePath(`/pedidos/${pedidoId}`);
  return { ok: true };
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
