import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { deFecha, hoy, sumarDias } from "@/lib/fechas";
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
    db.cliente.findMany({ where: { activo: true }, include: { puntos: { where: { activo: true }, select: { barrio: true, telefono: true } } }, orderBy: { nombre: "asc" } }),
    db.pedido.findMany({ where: { clienteId: { not: null }, estado: { not: "CANCELADO" }, origen: "MAYORISTA" }, select: { clienteId: true, estado: true, creadoEn: true, fechaEntrega: true, items: { select: { nombre: true, unidad: true, cantidad: true, sinCargo: true, paquetesPor: true } } }, orderBy: { creadoEn: "asc" } }),
  ]);

  type Acum = { fechas: string[]; entregas: string[]; abiertos: (string | null)[]; paq30: number };
  const porCliente = new Map<string, Acum>();
  const hace180 = sumarDias(hoyStr, -180), hace30 = sumarDias(hoyStr, -30);
  for (const p of pedidos) {
    if (p.estado === "NO_ENTREGADO") continue; // no llegó a entregarse: no cuenta como compra
    const f = fechaAR(p.creadoEn);
    const a = porCliente.get(p.clienteId!) ?? { fechas: [], entregas: [], abiertos: [], paq30: 0 };
    a.fechas.push(f);
    if (p.estado === "PENDIENTE") a.abiertos.push(p.fechaEntrega ? deFecha(p.fechaEntrega) : null); // pedido en curso: con su día de entrega, o esperando día
    if (p.estado === "ENTREGADO") { // día en que se entregó (los comprobantes cargados a mano no tienen día: valen el de carga)
      const e = p.fechaEntrega ? deFecha(p.fechaEntrega) : f;
      a.entregas.push(e);
      if (e >= hace30) a.paq30 += bultosDe(p.items); // paquetes ENTREGADOS en los últimos 30 días
    }
    porCliente.set(p.clienteId!, a);
  }

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

  const filas: FilaCliente[] = clientes.map((c) => {
    const a = porCliente.get(c.id);
    const fechas = a?.fechas ?? [];
    const ultimo = fechas.length ? fechas[fechas.length - 1] : null; // último pedido cargado
    const entregas = [...(a?.entregas ?? [])].sort();
    const entrega = entregas.length ? entregas[entregas.length - 1] : null; // última entrega
    const tel = c.puntos.find((p) => enlaceWhatsApp(p.telefono)) ?? c.puntos.find((p) => p.telefono); // primer teléfono de WhatsApp válido de sus sucursales
    // Cada cuántos días se le entrega: de sus entregas de los últimos 180 días (un día = una entrega), el tiempo entre la primera y la última dividido por la cantidad de intervalos.
    const dias180 = [...new Set(entregas.filter((f) => f >= hace180))];
    const ritmo = dias180.length >= 2 ? Math.max(1, Math.round(dias(dias180[dias180.length - 1], dias180[0]) / (dias180.length - 1))) : null;
    const sinEntrega = entrega ? dias(hoyStr, entrega) : null; // días desde su última entrega (null = todavía no se le entregó nada)
    const dif = entrega && ultimo ? dias(entrega, ultimo) : null; // días entre el último pedido y la última entrega (negativo = hay un pedido más nuevo sin entregar)
    return {
      id: c.id, nombre: c.nombre, barrios: [...new Set(c.puntos.map((p) => p.barrio).filter(Boolean))].slice(0, 2).join(" · "),
      ultimo, entrega, sinEntrega, dif, enCurso: enCursoDe(a?.abiertos ?? []),
      ritmo, paq30: a?.paq30 ?? 0, total: fechas.length,
      telefono: tel?.telefono ?? null, wa: tel ? enlaceWhatsApp(tel.telefono) : null,
    };
  });

  const sinCurso = filas.filter((f) => f.enCurso === null); // los que tienen un pedido en curso van aparte
  const grupo = (desde: number, hasta: number) => sinCurso.filter((f) => f.sinEntrega !== null && f.sinEntrega > desde && f.sinEntrega <= hasta).length; // cada cliente cae en un solo grupo
  const resumen = {
    activos: filas.length,
    curso: filas.length - sinCurso.length,
    d7: sinCurso.filter((f) => f.sinEntrega !== null && f.sinEntrega <= 7).length,
    s7: grupo(7, 15), s15: grupo(15, 30), s30: grupo(30, 45), s45: grupo(45, Infinity),
    inactivos: sinCurso.filter((f) => f.entrega === null).length,
  };

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoComercial activa="clientes" />
        <Tablero filas={filas} resumen={resumen} />
      </main>
    </>
  );
}
