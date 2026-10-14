"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { mayus, titulo } from "@/lib/mayusculas";
import { cuitValido } from "@/lib/numeros";
import { exigirVendedor, vendedorDeUsuario } from "@/lib/session";

type Resultado = { ok: boolean; error?: string };

/** El pedido tiene que ser de un cliente del propio vendedor. */
async function pedidoPropio(pedidoId: string) {
  const usuario = await exigirVendedor();
  const vendedor = await vendedorDeUsuario(usuario.id);
  if (!vendedor) return { error: "Todavía no te enlazaron con tu ficha de vendedor." } as const;
  const pedido = await db.pedido.findUnique({ where: { id: pedidoId }, select: { estado: true, pagado: true, pagoAvisadoPor: true, cliente: { select: { vendedorId: true } } } });
  if (!pedido || pedido.cliente?.vendedorId !== vendedor.id) return { error: "Ese pedido no es de uno de tus clientes." } as const;
  return { pedido, vendedor } as const;
}

/**
 * El vendedor indica que el cliente pagó. NO registra ningún pago: solo deja un aviso que la oficina ve en Cuenta corriente
 * ("Diego indicó que se pagó") y confirma ella; el último OK es siempre de la oficina.
 */
export async function avisarPago(pedidoId: string): Promise<Resultado> {
  const r = await pedidoPropio(pedidoId);
  if ("error" in r) return { ok: false, error: r.error };
  if (r.pedido.estado !== "ENTREGADO") return { ok: false, error: "Solo se puede avisar el pago de un pedido ya entregado." };
  if (r.pedido.pagado) return { ok: false, error: "Ese pedido ya figura como pagado." };
  await db.pedido.update({ where: { id: pedidoId }, data: { pagoAvisadoPor: r.vendedor.nombre, pagoAvisadoEn: new Date() } });
  revalidatePath("/vendedor", "layout");
  revalidatePath("/cuentas", "layout");
  return { ok: true };
}

/** El vendedor se arrepiente: saca su aviso (mientras la oficina no lo haya confirmado). */
export async function quitarAvisoPago(pedidoId: string): Promise<Resultado> {
  const r = await pedidoPropio(pedidoId);
  if ("error" in r) return { ok: false, error: r.error };
  if (r.pedido.pagado) return { ok: false, error: "La oficina ya confirmó el pago." };
  await db.pedido.update({ where: { id: pedidoId }, data: { pagoAvisadoPor: null, pagoAvisadoEn: null } });
  revalidatePath("/vendedor", "layout");
  revalidatePath("/cuentas", "layout");
  return { ok: true };
}

export type EstadoCliente = { error?: string } | undefined;

/**
 * El vendedor carga un cliente nuevo (cuando cierra uno): queda asignado a él, con una sucursal, y sigue directo a cargarle el pedido.
 * No toca precios ni límites: eso lo ve la oficina en la ficha del cliente.
 */
export async function crearClienteVendedor(_: EstadoCliente, f: FormData): Promise<EstadoCliente> {
  const usuario = await exigirVendedor();
  const vendedor = await vendedorDeUsuario(usuario.id);
  if (!vendedor) return { error: "Todavía no te enlazaron con tu ficha de vendedor. Pedile a la oficina que lo haga." };
  const nombre = mayus(String(f.get("nombre") ?? "").trim());
  const direccion = titulo(String(f.get("direccion") ?? "").trim());
  const barrio = mayus(String(f.get("barrio") ?? "").trim());
  const zonaId = String(f.get("zonaId") ?? "");
  const cuitTxt = String(f.get("cuit") ?? "").trim();
  if (nombre.length < 2) return { error: "Falta el nombre del comercio." };
  if (!direccion) return { error: "Falta la dirección de entrega." };
  if (!barrio) return { error: "Falta el barrio." };
  if (!(await db.zona.findUnique({ where: { id: zonaId } }))) return { error: "Elegí la zona." };
  if (cuitTxt && !cuitValido(cuitTxt)) return { error: "El CUIT no es válido (son 11 números)." };
  const repetido = await db.puntoEntrega.findFirst({ where: { direccion: { equals: direccion, mode: "insensitive" }, cliente: { nombre: { equals: nombre, mode: "insensitive" } } } });
  if (repetido) return { error: "Ese cliente ya está cargado con esa dirección. Buscalo en tus clientes o consultá con la oficina." };
  const telefono = String(f.get("telefono") ?? "").trim() || null;
  const comentario = mayus(String(f.get("comentario") ?? "").trim()) || null;
  const creado = await db.cliente.create({
    data: {
      nombre, tipo: "MAYORISTA", razonSocial: mayus(String(f.get("razonSocial") ?? "").trim()) || null,
      cuit: cuitTxt ? cuitTxt.replace(/\D/g, "") : null, vendedorId: vendedor.id,
      puntos: { create: { direccion, barrio, zonaId, telefono, comentario } },
    },
    include: { puntos: { select: { id: true } } },
  });
  revalidatePath("/vendedor", "layout");
  revalidatePath("/clientes");
  redirect(`/vendedor/nuevo?punto=${creado.puntos[0].id}`);
}
