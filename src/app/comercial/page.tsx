import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { hoy, sumarDias } from "@/lib/fechas";
import { bultosDe } from "@/lib/ruta";
import { exigirOficina } from "@/lib/session";
import { enlaceWhatsApp } from "@/lib/telefonos";
import { CONTENEDOR_PEDIDOS } from "../pedidos/Encabezado";
import { EncabezadoComercial } from "./EncabezadoComercial";
import { Tablero, type FilaCliente } from "./Tablero";

const dias = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
const fechaAR = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }); // AAAA-MM-DD

// COMERCIAL: tablero general de clientes. Quién pide, quién dejó de pedir, qué clientes llevan tiempo sin pedir.
// Todo sale de los pedidos ya cargados (no cancelados): no cambia nada, solo se mira.
export default async function Comercial() {
  const usuario = await exigirOficina();
  const hoyStr = hoy();

  const [clientes, pedidos] = await Promise.all([
    db.cliente.findMany({ where: { activo: true }, include: { puntos: { where: { activo: true }, select: { barrio: true, telefono: true } } }, orderBy: { nombre: "asc" } }),
    db.pedido.findMany({ where: { clienteId: { not: null }, estado: { not: "CANCELADO" }, origen: "MAYORISTA" }, select: { clienteId: true, estado: true, creadoEn: true, items: { select: { nombre: true, unidad: true, cantidad: true, sinCargo: true, paquetesPor: true } } }, orderBy: { creadoEn: "asc" } }),
  ]);

  type Acum = { fechas: string[]; paq30: number };
  const porCliente = new Map<string, Acum>();
  const hace180 = sumarDias(hoyStr, -180), hace30 = sumarDias(hoyStr, -30);
  for (const p of pedidos) {
    if (p.estado === "NO_ENTREGADO") continue; // no llegó a entregarse: no cuenta como compra
    const f = fechaAR(p.creadoEn);
    const a = porCliente.get(p.clienteId!) ?? { fechas: [], paq30: 0 };
    a.fechas.push(f);
    if (f >= hace30) a.paq30 += bultosDe(p.items);
    porCliente.set(p.clienteId!, a);
  }

  const filas: FilaCliente[] = clientes.map((c) => {
    const a = porCliente.get(c.id);
    const fechas = a?.fechas ?? [];
    const ultimo = fechas.length ? fechas[fechas.length - 1] : null;
    const tel = c.puntos.find((p) => enlaceWhatsApp(p.telefono)) ?? c.puntos.find((p) => p.telefono); // primer teléfono de WhatsApp válido de sus sucursales
    // Cada cuántos días suele pedir: de sus pedidos de los últimos 180 días (un día = un pedido), el tiempo entre el primero y el último dividido por la cantidad de intervalos.
    const dias180 = [...new Set(fechas.filter((f) => f >= hace180))];
    const ritmo = dias180.length >= 2 ? Math.max(1, Math.round(dias(dias180[dias180.length - 1], dias180[0]) / (dias180.length - 1))) : null;
    const sinPedir = ultimo ? dias(hoyStr, ultimo) : null; // días desde su último pedido (null = nunca pidió)
    return {
      id: c.id, nombre: c.nombre, barrios: [...new Set(c.puntos.map((p) => p.barrio).filter(Boolean))].slice(0, 2).join(" · "),
      ultimo, sinPedir,
      ritmo, paq30: a?.paq30 ?? 0, total: fechas.length,
      telefono: tel?.telefono ?? null, wa: tel ? enlaceWhatsApp(tel.telefono) : null,
    };
  });

  const grupo = (desde: number, hasta: number) => filas.filter((f) => f.sinPedir !== null && f.sinPedir > desde && f.sinPedir <= hasta).length; // cada cliente cae en un solo grupo
  const resumen = {
    activos: filas.length,
    d7: filas.filter((f) => f.sinPedir !== null && f.sinPedir <= 7).length,
    s7: grupo(7, 15), s15: grupo(15, 30), s30: grupo(30, 45), s45: grupo(45, Infinity),
    inactivos: filas.filter((f) => f.ultimo === null).length,
  };

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoComercial activa="clientes" derecha={<Link href="/comercial/graficos" className="flex h-10 items-center gap-2 rounded-lg bg-stone-800 px-5 text-sm font-bold uppercase tracking-wide text-white hover:bg-stone-700">Gráficos ›</Link>} />
        <Tablero filas={filas} resumen={resumen} />
      </main>
    </>
  );
}
