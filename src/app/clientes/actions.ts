"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { leerMonto } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";
import { esquemaCliente, esquemaSucursal, valoresDe, type EstadoForm } from "./validacion";

function datosCliente(d: ReturnType<typeof esquemaCliente.parse>) {
  return {
    ...d,
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
    data: { ...datosCliente(cliente.data), puntos: { create: sucursal.data } },
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

export async function guardarSucursal(clienteId: string, sucursalId: string | null, _: EstadoForm, formData: FormData): Promise<EstadoForm> {
  await exigirOficina();
  const valores = valoresDe(formData);
  const d = esquemaSucursal.safeParse(Object.fromEntries(formData));
  if (!d.success) return { error: d.error.issues[0].message, valores };

  if (sucursalId) {
    await db.puntoEntrega.update({ where: { id: sucursalId, clienteId }, data: d.data });
  } else {
    await db.puntoEntrega.create({ data: { ...d.data, clienteId } });
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
