import { db } from "@/lib/db";
import { mayus } from "@/lib/mayusculas";
import { armarItems, cargarCatalogo, limpiarDireccion } from "@/lib/empretienda";
import type { OrdenDeMail } from "@/lib/empretienda-mail";
import { aplicarBarriosAprendidos } from "@/lib/empretienda-barrios";

/**
 * Modo comparación: pone cada orden leída del mail al lado del pedido que cargó la planilla y dice en qué difieren.
 * NO crea ni cambia nada. Sirve para decidir cuándo se puede dejar de usar el script de Google.
 */

export type Diferencia = { campo: "Nombre" | "Dirección" | "Barrio" | "Teléfono" | "Total" | "Pago" | "Productos"; texto: string };
export type FilaComparacion = { orden: string; cliente: string; email: string; estado: "igual" | "difiere" | "sin-pedido"; diferencias: Diferencia[] };
export type ResumenComparacion = { filas: FilaComparacion[]; iguales: number; difieren: number; sinPedido: number; conEmail: number };

const plata = (n: number | null) => (n === null ? "—" : n.toLocaleString("es-AR", { maximumFractionDigits: 2 }));

export async function compararConSistema(ordenes: OrdenDeMail[]): Promise<ResumenComparacion> {
  const desde = Number(process.env.EMPRETIENDA_DESDE ?? "") || 0;
  const lista = await aplicarBarriosAprendidos(ordenes.filter((o) => Number(o.orden) >= desde));
  const pedidos = await db.pedido.findMany({ where: { webOrden: { in: lista.map((o) => o.orden) } }, include: { items: true } });
  const porOrden = new Map(pedidos.map((p) => [p.webOrden, p]));
  const catalogo = await cargarCatalogo();

  const filas: FilaComparacion[] = lista.map((o) => {
    const base = { orden: o.orden, cliente: o.cliente, email: o.email };
    const p = porOrden.get(o.orden);
    if (!p) return { ...base, estado: "sin-pedido", diferencias: [] };

    const dif: Diferencia[] = [];
    const sinTilde = (t: string | null) => (t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
    const cmp = (campo: Diferencia["campo"], sistema: string | null, mail: string | null) => { if (sinTilde(sistema) !== sinTilde(mail)) dif.push({ campo, texto: `sistema «${sistema ?? ""}» · mail «${mail ?? ""}»` }); };
    cmp("Nombre", p.webNombre ?? "", mayus(o.cliente.replace(/\(\s*x\d+\s*\)/i, "").trim()) || "SIN NOMBRE");
    cmp("Dirección", p.webDireccion, limpiarDireccion(o.direccion) || null);
    cmp("Barrio", p.webBarrio, mayus(o.localidad) || null);
    cmp("Teléfono", p.webTelefono, o.telefono || null);
    // El total puede haber subido si el equipo agregó algo "por fuera" al pedido: eso no cuenta como diferencia.
    const totalSistema = p.webTotal === null ? null : Number(p.webTotal) - Number(p.webExtra ?? 0);
    if (Math.abs((totalSistema ?? 0) - (o.monto ?? 0)) > 0.5) dif.push({ campo: "Total", texto: `sistema ${plata(totalSistema)} · mail ${plata(o.monto)}` });
    // El pago puede haberse confirmado a mano después (transferencia): solo se avisa si el mail dice Mercado Pago y el sistema no.
    const pagoMail = o.estado.toUpperCase().includes("MP") ? "PAGO_MP" : "PENDIENTE";
    if (pagoMail === "PAGO_MP" && p.webPago !== "PAGO_MP") dif.push({ campo: "Pago", texto: `el mail dice Mercado Pago aprobado y el sistema «${p.webPago}»` });
    if (pagoMail === "PENDIENTE" && p.webPago === "PAGO_MP") dif.push({ campo: "Pago", texto: "el sistema dice Mercado Pago y el mail lo muestra pendiente" });

    const clave = (x: { nombre: string; cantidad: number; paquetesPor: number }) => `${x.cantidad} × ${x.nombre} (${x.paquetesPor} paq.)`;
    const delMail = armarItems(o.renglones, catalogo).map(clave).sort();
    const delSistema = p.items.filter((i) => !i.nombre.includes("(POR FUERA)")).map((i) => clave({ nombre: i.nombre, cantidad: i.cantidad, paquetesPor: i.paquetesPor })).sort();
    if (delMail.join(" | ") !== delSistema.join(" | ")) dif.push({ campo: "Productos", texto: `sistema [${delSistema.join(", ")}] · mail [${delMail.join(", ")}]` });

    return { ...base, estado: dif.length ? "difiere" : "igual", diferencias: dif };
  });

  return {
    filas,
    iguales: filas.filter((f) => f.estado === "igual").length,
    difieren: filas.filter((f) => f.estado === "difiere").length,
    sinPedido: filas.filter((f) => f.estado === "sin-pedido").length,
    conEmail: filas.filter((f) => f.email).length,
  };
}
