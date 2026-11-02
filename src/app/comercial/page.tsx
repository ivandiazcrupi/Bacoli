import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { deFecha, hoy, sumarDias } from "@/lib/fechas";
import { titulo } from "@/lib/mayusculas";
import { bultosDe } from "@/lib/ruta";
import { exigirOficina } from "@/lib/session";
import { enlaceWhatsApp } from "@/lib/telefonos";
import { CONTENEDOR_PEDIDOS } from "../pedidos/Encabezado";
import { EncabezadoComercial } from "./EncabezadoComercial";
import { Tablero, type FilaCliente } from "./Tablero";

const dias = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
const fechaAR = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }); // AAAA-MM-DD

// COMERCIAL: tablero general de clientes. Lo que cuenta es la ENTREGA: "sin entrega" = días desde la última vez que se le entregó
// (no desde que pidió), porque a un cliente que recibió hace 7 días no hay que llamarlo aunque haya pedido hace 30.
// Todo sale de los pedidos ya cargados (no cancelados): no cambia nada, solo se mira.
export default async function Comercial() {
  const usuario = await exigirOficina();
  const hoyStr = hoy();

  const [clientes, pedidos] = await Promise.all([
    db.cliente.findMany({ where: { activo: true }, include: { puntos: { where: { activo: true }, select: { id: true, barrio: true, direccion: true, telefono: true } } }, orderBy: { nombre: "asc" } }),
    db.pedido.findMany({ where: { clienteId: { not: null }, estado: { not: "CANCELADO" }, origen: "MAYORISTA" }, select: { clienteId: true, puntoId: true, estado: true, creadoEn: true, fechaEntrega: true, items: { select: { nombre: true, unidad: true, cantidad: true, sinCargo: true, paquetesPor: true } } }, orderBy: { creadoEn: "asc" } }),
  ]);

  type Acum = { fechas: string[]; entregas: string[]; abiertos: (string | null)[]; paq30: number };
  type PedidoFila = (typeof pedidos)[number];
  const hace180 = sumarDias(hoyStr, -180), hace30 = sumarDias(hoyStr, -30);
  // Junta los pedidos por la clave que se elija: el cliente (todas sus sucursales juntas) o cada sucursal por separado.
  const acumular = (clave: (p: PedidoFila) => string | null) => {
    const m = new Map<string, Acum>();
    for (const p of pedidos) {
      if (p.estado === "NO_ENTREGADO") continue; // no llegó a entregarse: no cuenta como compra
      const k = clave(p);
      if (!k) continue;
      const f = fechaAR(p.creadoEn);
      const a = m.get(k) ?? { fechas: [], entregas: [], abiertos: [], paq30: 0 };
      a.fechas.push(f);
      if (p.estado === "PENDIENTE") a.abiertos.push(p.fechaEntrega ? deFecha(p.fechaEntrega) : null); // pedido en curso: con su día de entrega, o esperando día
      if (p.estado === "ENTREGADO") { // día en que se entregó (los comprobantes cargados a mano no tienen día: valen el de carga)
        const e = p.fechaEntrega ? deFecha(p.fechaEntrega) : f;
        a.entregas.push(e);
        if (e >= hace30) a.paq30 += bultosDe(p.items); // paquetes ENTREGADOS en los últimos 30 días
      }
      m.set(k, a);
    }
    return m;
  };
  const porCliente = acumular((p) => p.clienteId);
  const porSucursal = acumular((p) => p.puntoId);

  const manana = sumarDias(hoyStr, 1);
  const corto = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;
  // Un cliente con un pedido en curso no hay que llamarlo: ya pidió y le llega. Se dice cuándo (o que falta marcar la entrega).
  const enCursoDe = (abiertos: (string | null)[]): string | null => {
    if (abiertos.length === 0) return null;
    const dias = abiertos.filter((d): d is string => !!d).sort();
    if (dias.length === 0) return "Pedido sin día";
    const d = dias[0];
    return d === hoyStr ? "Entrega hoy" : d === manana ? "Entrega mañana" : d > hoyStr ? `Entrega ${corto(d)}` : `Sin marcar ${corto(d)}`;
  };

  const filaDe = (id: string, clienteId: string, nombre: string, barrios: string, a: Acum | undefined, tel: { telefono: string | null } | undefined): FilaCliente => {
    const fechas = a?.fechas ?? [];
    const ultimo = fechas.length ? fechas[fechas.length - 1] : null; // último pedido cargado
    const entregas = [...(a?.entregas ?? [])].sort();
    const entrega = entregas.length ? entregas[entregas.length - 1] : null; // última entrega
    // Cada cuántos días se le entrega: de sus entregas de los últimos 180 días (un día = una entrega), el tiempo entre la primera y la última dividido por la cantidad de intervalos.
    const dias180 = [...new Set(entregas.filter((f) => f >= hace180))];
    const ritmo = dias180.length >= 2 ? Math.max(1, Math.round(dias(dias180[dias180.length - 1], dias180[0]) / (dias180.length - 1))) : null;
    const sinEntrega = entrega ? dias(hoyStr, entrega) : null; // días desde su última entrega (null = todavía no se le entregó nada)
    const dif = entrega && ultimo ? dias(entrega, ultimo) : null; // días entre el último pedido y la última entrega (negativo = hay un pedido más nuevo sin entregar)
    return {
      id, clienteId, nombre, barrios, ultimo, entrega, sinEntrega, dif, enCurso: enCursoDe(a?.abiertos ?? []),
      ritmo, paq30: a?.paq30 ?? 0, total: fechas.length,
      telefono: tel?.telefono ?? null, wa: tel ? enlaceWhatsApp(tel.telefono) : null,
    };
  };
  const primerTelefono = (puntos: { telefono: string | null }[]) => puntos.find((p) => enlaceWhatsApp(p.telefono)) ?? puntos.find((p) => p.telefono); // primer teléfono de WhatsApp válido

  // Una fila por cliente (todas sus sucursales juntas)...
  const filas: FilaCliente[] = clientes.map((c) =>
    filaDe(c.id, c.id, c.nombre, [...new Set(c.puntos.map((p) => p.barrio).filter(Boolean))].slice(0, 2).join(" · "), porCliente.get(c.id), primerTelefono(c.puntos)));
  // ...y una fila por sucursal (cada una con sus propias entregas; si no tiene teléfono propio usa el del cliente).
  const sucursales: FilaCliente[] = clientes.flatMap((c) =>
    c.puntos.map((pt) => filaDe(pt.id, c.id, c.nombre, [pt.barrio, titulo(pt.direccion)].filter(Boolean).join(" · "), porSucursal.get(pt.id), pt.telefono ? pt : primerTelefono(c.puntos))));

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoComercial activa="clientes" />
        <Tablero clientes={filas} sucursales={sucursales} />
      </main>
    </>
  );
}
