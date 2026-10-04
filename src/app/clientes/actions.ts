"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mayus, titulo } from "@/lib/mayusculas";
import { leerMonto } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";
import { esquemaCliente, esquemaSucursal, valoresDe, type EstadoForm } from "./validacion";

type DatosSucursal = ReturnType<typeof esquemaSucursal.parse>;
const sucursalEnMayuscula = (d: DatosSucursal) => ({ ...d, alias: mayus(d.alias), direccion: titulo(d.direccion), barrio: mayus(d.barrio) });

function datosCliente(d: ReturnType<typeof esquemaCliente.parse>) {
  return {
    ...d,
    nombre: mayus(d.nombre),
    razonSocial: mayus(d.razonSocial),
    comisionista: mayus(d.comisionista),
    cuit: d.cuit ? d.cuit.replace(/\D/g, "") : null,
    // Si "sin límite", no se guardan los topes.
    maxPedidosImpagos: d.sinLimite ? null : d.maxPedidosImpagos,
    maxMonto: d.sinLimite ? null : d.maxMonto,
  };
}

export async function crearCliente(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  await exigirOficina();
  const valores = valoresDe(formData);
  const cliente = esquemaCliente.safeParse(Object.fromEntries(formData));
  if (!cliente.success) return { error: cliente.error.issues[0].message, valores };
  const sucursal = esquemaSucursal.safeParse(Object.fromEntries(formData));
  if (!sucursal.success) return { error: sucursal.error.issues[0].message, valores };

  const creado = await db.cliente.create({
    data: { ...datosCliente(cliente.data), puntos: { create: sucursalEnMayuscula(sucursal.data) } },
  });
  revalidatePath("/clientes");
  redirect(`/clientes/${creado.id}`);
}

export async function actualizarCliente(id: string, _: EstadoForm, formData: FormData): Promise<EstadoForm> {
  await exigirOficina();
  const valores = valoresDe(formData);
  const cliente = esquemaCliente.safeParse(Object.fromEntries(formData));
  if (!cliente.success) return { error: cliente.error.issues[0].message, valores };

  await db.cliente.update({ where: { id }, data: datosCliente(cliente.data) });
  revalidatePath(`/clientes/${id}`);
  revalidatePath("/clientes");
  return { ok: "Cambios guardados." };
}

export async function cambiarActivoCliente(formData: FormData) {
  await exigirOficina();
  const id = String(formData.get("id"));
  const c = await db.cliente.findUnique({ where: { id } });
  if (!c) return;
  await db.cliente.update({ where: { id }, data: { activo: !c.activo } });
  revalidatePath(`/clientes/${id}`);
  revalidatePath("/clientes");
}

/** Borra un cliente (con sus sucursales y precios propios) solo si nunca tuvo movimiento: sin pedidos, cuenta, notas de crédito ni facturas de ARCA. Solo dueños. */
export async function eliminarCliente(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const usuario = await exigirOficina();
  if (usuario.rol !== "DUENO") return { error: "Solo un dueño puede eliminar un cliente." };
  const id = String(formData.get("id"));
  const c = await db.cliente.findUnique({ where: { id }, include: { _count: { select: { pedidos: true, movimientos: true, notasCredito: true } } } });
  if (!c) return { error: "El cliente ya no existe." };
  const historial = c._count.pedidos + c._count.movimientos + c._count.notasCredito;
  const cuit = (c.cuit ?? "").replace(/\D/g, "");
  const facturas = cuit ? await db.comprobanteArca.count({ where: { cuitReceptor: cuit } }) : 0;
  if (historial > 0 || facturas > 0) {
    return { error: `Este cliente tiene historial (${c._count.pedidos} pedidos${facturas ? `, ${facturas} facturas de ARCA` : ""}), por eso no se puede eliminar sin perder información. Usá “Desactivar”: deja de aparecer para pedidos nuevos y no se pierde nada. Podés anotar el motivo en la Observación.` };
  }
  await db.cliente.delete({ where: { id } }); // sus sucursales y precios propios se borran con él
  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function guardarSucursal(clienteId: string, sucursalId: string | null, _: EstadoForm, formData: FormData): Promise<EstadoForm> {
  await exigirOficina();
  const valores = valoresDe(formData);
  const d = esquemaSucursal.safeParse(Object.fromEntries(formData));
  if (!d.success) return { error: d.error.issues[0].message, valores };

  if (sucursalId) {
    // El formulario ya no tiene "nombre": si no viene, se conserva el que tenía cargado.
    const { alias, ...resto } = sucursalEnMayuscula(d.data);
    await db.puntoEntrega.update({ where: { id: sucursalId, clienteId }, data: formData.has("alias") ? { ...resto, alias } : resto });
  } else {
    await db.puntoEntrega.create({ data: { ...sucursalEnMayuscula(d.data), clienteId } });
  }
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: sucursalId ? "Sucursal guardada." : "Sucursal agregada." };
}

export async function cambiarActivoSucursal(formData: FormData) {
  await exigirOficina();
  const id = String(formData.get("id"));
  const p = await db.puntoEntrega.findUnique({ where: { id } });
  if (!p) return;
  await db.puntoEntrega.update({ where: { id }, data: { activo: !p.activo } });
  revalidatePath(`/clientes/${p.clienteId}`);
}

// Borrar una sucursal: solo si nunca tuvo pedidos (si no, se rompería el historial: ahí se desactiva) y si no es la única del cliente.
export async function eliminarSucursal(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  await exigirOficina();
  const id = String(formData.get("id"));
  const p = await db.puntoEntrega.findUnique({ where: { id }, include: { _count: { select: { pedidos: true } } } });
  if (!p) return { error: "La sucursal ya no existe." };
  if (p._count.pedidos > 0) return { error: `Esta sucursal tiene ${p._count.pedidos} ${p._count.pedidos === 1 ? "pedido" : "pedidos"} en el historial, por eso no se puede eliminar. Usá “Desactivar”: deja de aparecer para pedidos nuevos y no se pierde nada.` };
  const otras = await db.puntoEntrega.count({ where: { clienteId: p.clienteId, NOT: { id } } });
  if (otras === 0) return { error: "Es la única sucursal del cliente: un cliente necesita al menos una. Agregá la otra primero, o desactivá el cliente." };
  await db.puntoEntrega.delete({ where: { id } });
  revalidatePath(`/clientes/${p.clienteId}`);
  return { ok: "Sucursal eliminada." };
}

// Campos "pe_<productoId>". Vacío = el cliente paga el precio de su lista.
export async function guardarPreciosEspeciales(clienteId: string, _: EstadoForm, formData: FormData): Promise<EstadoForm> {
  await exigirOficina();
  const valores = valoresDe(formData);
  const productos = await db.producto.findMany({ where: { activo: true } });
  const operaciones = [];
  for (const p of productos) {
    const texto = String(formData.get(`pe_${p.id}`) ?? "");
    const precio = leerMonto(texto);
    if (texto.trim() && precio === null) return { error: `${p.nombre}: "${texto}" no es un precio válido.`, valores };
    operaciones.push(
      precio === null
        ? db.precioEspecial.deleteMany({ where: { clienteId, productoId: p.id } })
        : db.precioEspecial.upsert({
            where: { clienteId_productoId: { clienteId, productoId: p.id } },
            update: { precio },
            create: { clienteId, productoId: p.id, precio },
          }),
    );
  }
  await db.$transaction(operaciones);
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/clientes");
  return { ok: "Precios especiales guardados." };
}
